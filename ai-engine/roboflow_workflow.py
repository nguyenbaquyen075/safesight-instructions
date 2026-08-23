# SPDX-License-Identifier: MIT
"""Gọi Roboflow Workflow để nhận diện PPE trên MỘT ẢNH TĨNH (không phải luồng video).

Hỗ trợ 2 workflow (xem WORKFLOWS bên dưới):
  - "Detech PPE vdetech-ppe-7qydu-vnlwm-1-yolo26n-t2 Logic"  -> key 'detech-ppe' (mặc định)
  - "PPEs vppes-kaxsi-ea9pf-1-yolo11n-t1 Logic"              -> key 'ppes-kaxsi'

Dùng khi cần đối chiếu/kiểm thử kết quả của model trên cloud, còn pipeline
camera trực tiếp vẫn chạy model local ppe_multiclass.pt qua ppe_tracker.py
(gọi cloud từng frame sẽ tốn credit và trễ mạng).

Định nghĩa CẢ HAI workflow (nguồn sự thật, lấy từ Roboflow API — giống hệt nhau):
  - inputs : image (InferenceImage) — KHÔNG có parameter nào khác
  - outputs: predictions  -> {"image": {...}, "predictions": [...]}
  - steps  : một block roboflow_core/inner_workflow@v1 bọc model tương ứng

Lưu ý: tên workflow có chữ "Logic" nhưng spec KHÔNG có block logic nào — nó
trả về prediction thô của model, việc xét đủ/thiếu PPE vẫn nằm ở ppe_tracker.py.

VÌ SAO gọi REST bằng requests thay vì package chính chủ `inference-sdk`
(InferenceHTTPClient)? KHÔNG phải do lười — `inference-sdk` khai báo
requires_python ">=3.10,<3.13", còn .venv của dự án chạy Python 3.14.2 (bản đang
gánh torch 2.13 + ultralytics 8.4 cho AI engine). pip không tìm được bản nào hợp
lệ. Muốn dùng SDK thì phải hạ Python và dựng lại toàn bộ venv — lớn hơn hẳn phạm
vi một client HTTP. Đoạn POST dưới đây làm đúng những gì SDK làm: cùng endpoint,
cùng payload, có timeout/retry/typed error. ĐỪNG đổi sang SDK mà không kiểm tra
lại phiên bản Python trước.

Chạy thử: .venv/bin/python ai-engine/test_roboflow_workflow.py
"""

import base64
import os
import time

import cv2
import requests

from env_local import load_dotenv_local

WORKSPACE_NAME = "les-workspace-puz7q"

# Hai workflow cùng workspace. Đã đối chiếu spec qua Roboflow API: cấu trúc GIỐNG HỆT
# nhau — input `image` (InferenceImage), KHÔNG parameter, output `predictions`
# (JsonField) — chỉ khác model bọc bên trong. Nên dùng chung một client thay vì tách
# file thứ hai gần như trùng lặp.
#
#   detech-ppe : model detech-ppe-7qydu-vnlwm-1-yolo26n-t2 (train từ dataset Detech PPE)
#   ppes-kaxsi : model ppes-kaxsi-ea9pf-1-yolo11n-t1       (train từ dataset ppes-kaxsi)
#
# ⚠️ Hai model KHÁC TỪ VỰNG lớp: detech-ppe trả 'gloves' (số nhiều) khớp ppe_tracker.py,
# còn ppes-kaxsi trả 'glove' (số ít). Muốn map sang ppe_tracker phải chuẩn hoá tên trước.
WORKFLOWS = {
    "detech-ppe": "detech-ppe-vdetech-ppe-7qydu-vnlwm-1-yolo26n-t2-logic",
    "ppes-kaxsi": "ppes-vppes-kaxsi-ea9pf-1-yolo11n-t1-logic",
}
DEFAULT_WORKFLOW = "detech-ppe"


def _endpoint(workflow):
    """Tên workflow -> URL. Chỉ nhận key trong WORKFLOWS, không ghép chuỗi tuỳ ý."""
    try:
        slug = WORKFLOWS[workflow]
    except KeyError:
        raise RoboflowWorkflowError(
            f"Workflow không hợp lệ: {workflow!r}. Chọn một trong {sorted(WORKFLOWS)}"
        ) from None
    return f"https://serverless.roboflow.com/{WORKSPACE_NAME}/workflows/{slug}"

# Tên output do chính workflow khai báo — đọc theo key này, không đoán tên khác.
OUTPUT_NAME = "predictions"

# Thu nhỏ cạnh dài của frame trước khi gửi. Model phía Roboflow vốn chạy ở 640 nên
# gửi ảnh 1920 chỉ tốn băng thông: đo thực tế trên samples1.mp4 cho thấy payload
# 287KB -> 61KB và độ trễ trung vị 8447ms -> 1618ms (nhanh ~5 lần), bbox không đổi
# vì trả theo phần trăm. Tăng số này nếu cần bắt vật rất nhỏ/ở xa.
MAX_IMAGE_SIDE = 640

# Dùng lại 1 kết nối keep-alive, giống session trong yolo_inference.py
_session = requests.Session()


class RoboflowWorkflowError(RuntimeError):
    """Gọi workflow thất bại. .status_code = mã HTTP nếu lỗi đến từ server."""

    def __init__(self, message, status_code=None):
        super().__init__(message)
        self.status_code = status_code


def _as_workflow_image(image):
    """Đổi ảnh đầu vào thành payload {"type": ..., "value": ...} mà Roboflow hiểu.

    Nhận: URL https, frame OpenCV (numpy BGR), bytes JPEG/PNG, hoặc đường dẫn file.
    URL http:// thường bị Roboflow từ chối nên chỉ chấp nhận https.
    """
    if isinstance(image, str) and image.startswith("https://"):
        return {"type": "url", "value": image}
    if isinstance(image, str) and image.startswith("http://"):
        raise RoboflowWorkflowError("Roboflow chỉ nhận URL https://, không nhận http://")

    if hasattr(image, "shape"):  # frame OpenCV
        h, w = image.shape[:2]
        scale = MAX_IMAGE_SIDE / max(h, w)
        if scale < 1:
            image = cv2.resize(image, (int(w * scale), int(h * scale)),
                               interpolation=cv2.INTER_AREA)
        ok, buf = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
        if not ok:
            raise RoboflowWorkflowError("Không encode được frame sang JPEG")
        raw = buf.tobytes()
    elif isinstance(image, (bytes, bytearray)):
        raw = bytes(image)
    else:
        with open(image, "rb") as f:  # đường dẫn file
            raw = f.read()

    return {"type": "base64", "value": base64.b64encode(raw).decode()}


def _parse_detections(entry):
    """Bóc list detection từ 1 entry kết quả, parse phòng thủ theo key thật.

    Trả bbox theo dạng phần trăm "left/top/width/height" GIỐNG _bbox_pct() trong
    ppe_tracker.py, để dùng lại được ngay với dashboard và _draw_violation_box().
    Roboflow trả x,y là TÂM box (pixel) nên phải quy về góc trên-trái.
    """
    block = entry.get(OUTPUT_NAME) or {}
    raw = block.get("predictions") or []
    if not raw:
        # Không detect được gì -> Roboflow trả image {"width": null, "height": null}.
        # Đây là frame TRẮNG hợp lệ, KHÔNG phải lỗi — thiếu nhánh này thì mọi frame
        # không có người/PPE đều bị đếm nhầm thành "gọi API thất bại".
        return []

    size = block.get("image") or {}
    img_w = size.get("width") or 0
    img_h = size.get("height") or 0
    if not img_w or not img_h:
        raise RoboflowWorkflowError("Kết quả thiếu kích thước ảnh, không quy đổi được bbox")

    detections = []
    for p in raw:
        # Chỉ lấy đúng field cần dùng — bỏ detection_id/parent_id/points cho payload nhẹ.
        w = float(p.get("width", 0))
        h = float(p.get("height", 0))
        x = float(p.get("x", 0))
        y = float(p.get("y", 0))
        detections.append({
            "class": p.get("class"),
            "confidence": float(p.get("confidence", 0)),
            "bbox": {
                "left": f"{((x - w / 2) / img_w) * 100}%",
                "top": f"{((y - h / 2) / img_h) * 100}%",
                "width": f"{(w / img_w) * 100}%",
                "height": f"{(h / img_h) * 100}%",
            },
        })
    return detections


def detect_ppe(image, timeout=30, retries=2, workflow=DEFAULT_WORKFLOW):
    """Chạy workflow trên 1 ảnh -> list detection [{class, confidence, bbox%}].

    image  : URL https, frame OpenCV, bytes ảnh, hoặc đường dẫn file.
    workflow: key trong WORKFLOWS ('detech-ppe' mặc định, hoặc 'ppes-kaxsi').
    timeout: giây cho mỗi request.
    retries: số lần thử LẠI khi lỗi mạng / 429 / 5xx (backoff 1s, 2s...).
             Lỗi 4xx khác (sai API key, ảnh hỏng) fail ngay, thử lại vô ích.

    Raise RoboflowWorkflowError nếu thiếu API key hoặc gọi thất bại.
    """
    load_dotenv_local()
    api_key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not api_key:
        raise RoboflowWorkflowError(
            "Thiếu ROBOFLOW_API_KEY — thêm vào .env.local (lấy ở app.roboflow.com/settings/api)"
        )

    endpoint = _endpoint(workflow)
    payload = {"api_key": api_key, "inputs": {"image": _as_workflow_image(image)}}

    for attempt in range(retries + 1):
        try:
            resp = _session.post(endpoint, json=payload, timeout=timeout)
            if resp.status_code == 429 or resp.status_code >= 500:
                raise RoboflowWorkflowError(
                    f"Roboflow trả {resp.status_code}", resp.status_code
                )
            if resp.status_code != 200:
                # 4xx -> lỗi của request, không thử lại. Cắt ngắn body kẻo lộ/nặng log.
                raise RoboflowWorkflowError(
                    f"Roboflow trả {resp.status_code}: {resp.text[:300]}", resp.status_code
                ) from None
            data = resp.json()
            break
        except (requests.exceptions.RequestException, RoboflowWorkflowError) as e:
            retryable = isinstance(e, requests.exceptions.RequestException) or (
                e.status_code == 429 or (e.status_code or 0) >= 500
            )
            if not retryable or attempt == retries:
                if isinstance(e, RoboflowWorkflowError):
                    raise
                raise RoboflowWorkflowError(f"Không gọi được Roboflow: {e}") from e
            time.sleep(2 ** attempt)

    entries = data.get("outputs")
    if not isinstance(entries, list) or not entries:
        raise RoboflowWorkflowError("Kết quả không có 'outputs' hợp lệ")
    # Gửi 1 ảnh -> lấy entry đầu tiên.
    return _parse_detections(entries[0])
