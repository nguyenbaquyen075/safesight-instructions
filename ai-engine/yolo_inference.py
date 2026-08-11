# SPDX-License-Identifier: MIT

import cv2
import json
import requests
import time
import os
import signal
import sys
import atexit
from ppe_tracker import PPEViolationTracker

def _load_dotenv_local():
    """Đọc .env.local (KEY=VALUE) ở gốc repo nếu có, không ghi đè biến đã
    set qua shell. Tự parse thay vì thêm dependency python-dotenv chỉ để
    đọc vài dòng KEY=VALUE."""
    if not os.path.exists(".env.local"):
        return
    with open(".env.local", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv_local()

# Configuration
BRIDGE_URL = "http://localhost:4001/detections"
NEXT_API_URL = os.environ.get("NEXT_API_URL", "http://localhost:3000") + "/api/violations"
AI_ENGINE_SECRET = os.environ.get("AI_ENGINE_SECRET", "")
SNAPSHOT_DIR = "public/snapshots"

# PPE thiếu -> (type, severity) khớp src/types/enums.ts (ViolationType/Severity)
PPE_VIOLATION_MAP = {
    "helmet": ("hard_hat", "critical"),
    "vest": ("safety_vest", "high"),
}


def _pct_to_ratio(pct_str: str) -> float:
    return float(pct_str.rstrip("%")) / 100


def _draw_violation_box(frame, bbox_pct, label):
    """Khoanh khung đỏ + nhãn quanh ĐÚNG người/đối tượng đang vi phạm trong ảnh chụp."""
    h, w = frame.shape[:2]
    x1 = int(_pct_to_ratio(bbox_pct["left"]) * w)
    y1 = int(_pct_to_ratio(bbox_pct["top"]) * h)
    bw = int(_pct_to_ratio(bbox_pct["width"]) * w)
    bh = int(_pct_to_ratio(bbox_pct["height"]) * h)
    cv2.rectangle(frame, (x1, y1), (x1 + bw, y1 + bh), (0, 0, 255), 3)
    cv2.putText(frame, label, (x1, max(y1 - 10, 20)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2, cv2.LINE_AA)
    return frame


def report_violation(cam_id, detection):
    """Ghi 1 Violation vào DB qua API Next.js (POST /api/violations).

    Chỉ gọi khi: có PPE bị thiếu khớp map, và đã có snapshot bằng chứng
    (snapshotUrl được yolo_inference.py gắn vào detection ở vòng lặp chính).
    """
    vtype = severity = None
    for ppe in ("helmet", "vest"):  # helmet ưu tiên vì nghiêm trọng hơn
        if ppe in detection.get("missingPpe", []):
            vtype, severity = PPE_VIOLATION_MAP[ppe]
            break
    snapshot_url = detection.get("snapshotUrl")
    if not vtype or not snapshot_url:
        return

    bbox = detection["bbox"]
    try:
        session.post(NEXT_API_URL, json={
            "cameraId": cam_id,
            "type": vtype,
            "severity": severity,
            "confidence": detection["confidence"],
            "bboxData": [{
                "x": _pct_to_ratio(bbox["left"]),
                "y": _pct_to_ratio(bbox["top"]),
                "width": _pct_to_ratio(bbox["width"]),
                "height": _pct_to_ratio(bbox["height"]),
                "label": detection["label"],
                "confidence": detection["confidence"],
            }],
            "snapshotUrl": snapshot_url,
        }, headers={"X-AI-Engine-Secret": AI_ENGINE_SECRET}, timeout=1.0)
    except requests.exceptions.RequestException:
        pass

# NGUỒN DUY NHẤT gán video cho từng camera — DÙNG CHUNG với dashboard
# (src/data/camera-videos.json). Sửa 1 file này là cả YOLO lẫn frontend cùng đổi,
# nên BẤT KỲ video nào gán cho 1 ô đều được YOLO tự phân tích -> tự bắt lỗi, khỏi sửa 2 nơi.
CAMERA_VIDEO_FILE = "src/data/camera-videos.json"


def load_video_camera_map():
    """Đọc {cam-id: 'ten.mp4'} -> gom thành {đường-dẫn-video: [các cam dùng nó]}."""
    with open(CAMERA_VIDEO_FILE, encoding="utf-8") as f:
        cam_to_video = json.load(f)
    video_to_cams = {}
    for cam_id, filename in cam_to_video.items():
        path = f"public/videos/{filename}"
        video_to_cams.setdefault(path, []).append(cam_id)
    return video_to_cams

# Model MỚI: 11 lớp (Person, helmet, vest, gloves, boots, goggles + no_*)
# Đặt file ppe_multiclass.pt (đổi tên từ best.pt của Colab) vào gốc repo.
MODEL_PATH = "ppe_multiclass.pt"

# Dùng 1 kết nối HTTP tái sử dụng (keep-alive) cho nhẹ
session = requests.Session()


def clear_snapshots():
    """Xoá toàn bộ ảnh vi phạm đã bắt — ảnh chỉ tồn tại TRONG LÚC chạy dự án."""
    if not os.path.isdir(SNAPSHOT_DIR):
        return
    removed = 0
    for name in os.listdir(SNAPSHOT_DIR):
        if name.startswith("violation_") and name.endswith(".jpg"):
            try:
                os.remove(os.path.join(SNAPSHOT_DIR, name))
                removed += 1
            except OSError:
                pass
    if removed:
        print(f"🧹 Đã xoá {removed} ảnh vi phạm.")


# Khi TẮT dự án (Ctrl+C / kill / thoát) -> tự dọn ảnh
atexit.register(clear_snapshots)
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))


def run_inference():
    print(f"🚀 Initializing Integrated PPE Tracking Engine...")
    print(f"📦 Using Model: {MODEL_PATH}")

    if not os.path.exists(MODEL_PATH):
        print(f"❌ Error: Model file {MODEL_PATH} not found!")
        return

    clear_snapshots()  # bắt đầu chạy -> xoá sạch ảnh cũ, bắt lại từ đầu

    # Mở 1 luồng (video + tracker RIÊNG) cho mỗi video trong map.
    # Mỗi video có tracker riêng để trạng thái theo dõi (track ID) không lẫn giữa các video.
    streams = []
    for video_path, cams in load_video_camera_map().items():
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"⚠️ Không mở được {video_path} — bỏ qua {cams}.")
            continue
        tracker = PPEViolationTracker(
            model_path=MODEL_PATH,
            confidence=0.25,       # Ngưỡng thấp hơn -> bắt cả vật nhỏ/mờ như GIÀY
            min_height_ratio=0.0,  # TẮT lọc kích thước — hiện tất cả khung, kể cả vật nhỏ/xa
            imgsz=640              # Nét cao -> bắt mũ/vật nhỏ chắc tay hơn (ưu tiên CHÍNH XÁC).
                                   # Video đã cắt còn cảnh đứng nên bù lại phần chậm.
        )
        streams.append({"path": video_path, "cap": cap, "tracker": tracker, "cams": cams})
        print(f"🎥 {video_path} -> {cams}")

    if not streams:
        print("❌ Error: Không mở được video nào (thử camera 0)...")
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ Không có nguồn video.")
            return
        streams.append({"path": "camera-0", "cap": cap,
                        "tracker": PPEViolationTracker(model_path=MODEL_PATH, confidence=0.25,
                                                       min_height_ratio=0.0, imgsz=640),
                        "cams": ["cam-001"]})

    print(f"✅ Starting real-time tracking trên {len(streams)} luồng...")

    # ponytail: set không tự dọn -> phình dần nếu chạy 24/7 nhiều ngày; nếu cần chạy dài hạn,
    # dọn định kỳ theo track đã biến mất khỏi tracker (không còn trong results.boxes.id).
    written_violations = set()    # (cameraId, trackId) đã ghi DB -> khỏi ghi lặp mỗi frame

    while True:
        for st in streams:
            cap = st["cap"]
            success, frame = cap.read()
            if not success:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # hết video -> quay lại đầu
                continue

            # Phân tích ĐÚNG video của luồng này -> khung khớp người trong ô đó
            detections = st["tracker"].process_frame(frame)

            violations = [d for d in detections if d.get('isViolation')]

            # Gửi toạ độ detections sang bridge cho CÁC camera dùng video này
            for cam_id in st["cams"]:
                try:
                    session.post(BRIDGE_URL, json={
                        "cameraId": cam_id,
                        "detections": detections
                    }, timeout=0.1)
                except:
                    pass

                # Ghi Violation vào DB — chỉ khi đã CHỐT (đủ conf + đủ 3s liên tục,
                # xem PPEViolationTracker.CONFIRM_CONF/CONFIRM_DELAY), mỗi (camera, trackId) 1 lần.
                # Ảnh chụp riêng cho ĐÚNG lúc/ĐÚNG người này, khoanh khung đỏ quanh người vi phạm
                # — không dùng ảnh throttle cũ nữa để tránh gắn nhầm ảnh người khác.
                for d in violations:
                    if d.get('type') != 'person' or not d.get('confirmed'):
                        continue
                    key = (cam_id, d.get('trackId'))
                    if key[1] is None or key in written_violations:
                        continue
                    if not os.path.exists(SNAPSHOT_DIR):
                        os.makedirs(SNAPSHOT_DIR)
                    timestamp = time.strftime("%Y%m%d-%H%M%S")
                    filename = f"violation_{cam_id}_{timestamp}.jpg"
                    annotated = _draw_violation_box(frame.copy(), d["bbox"], d["label"])
                    cv2.imwrite(f"{SNAPSHOT_DIR}/{filename}", annotated)
                    d['snapshotUrl'] = f"/snapshots/{filename}"
                    report_violation(cam_id, d)
                    written_violations.add(key)

        # Small delay to throttle CPU
        time.sleep(0.01)

    for st in streams:
        st["cap"].release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run_inference()
