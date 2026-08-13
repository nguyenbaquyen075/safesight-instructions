# SPDX-License-Identifier: MIT

import cv2
import json
import re
import requests
import sqlite3
import time
import os
import signal
import sys
import atexit
import threading
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

def _open_db_readonly():
    """Mở file SQLite của Next.js (prisma/dev.db) chỉ để ĐỌC. Đọc THẲNG file thay vì
    gọi API /api/cameras vì tiến trình này khởi động TRƯỚC khi Next.js kịp sẵn sàng
    (xem dev-all.sh) — gọi HTTP lúc đó sẽ lỗi. Trả None nếu chưa có DB (chưa chạy
    `npm run db:seed` / db chưa được tạo)."""
    db_url = os.environ.get("DATABASE_URL", "")
    db_path = db_url[len("file:"):] if db_url.startswith("file:") else db_url
    db_path = db_path[2:] if db_path.startswith("./") else db_path
    if not db_path or not os.path.exists(db_path):
        return None
    try:
        return sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    except sqlite3.Error as e:
        print(f"⚠️ Không mở được DB: {e}")
        return None


def load_real_camera_overrides():
    """Đọc bảng Camera THẬT (thêm qua Settings > Giám sát trên web) để biết camera
    nào dùng nguồn sống (webcam/RTSP) thay vì video demo — cam không có trong DB
    vẫn phát video demo như cũ (camera-videos.json).

    Quy ước lưu trong cột rtspUrl (khớp src/lib/camera-source.ts):
      "webcam:0"    -> webcam theo index 0
      "rtsp://..."  -> camera IP thật qua RTSP

    QUAN TRỌNG: camera DEMO (cam-001, cam-002...) cũng có sẵn 1 giá trị rtspUrl
    kiểu "rtsp://192.168.x.x..." trong DB — đó là dữ liệu GIẢ, seed chỉ để khớp
    khoá ngoại (FK) cho bảng Violation, KHÔNG PHẢI camera thật cần kết nối. Phải
    loại các cam-id đã có trong camera-videos.json (bộ camera demo) ra khỏi đây,
    nếu không sẽ cố mở nhầm URL rtsp giả -> treo 30s/lần rồi lỗi.

    Camera thật có status khác 'ONLINE' (người dùng "đóng" camera qua Cài đặt >
    Giám sát) -> BỎ QUA, không mở nguồn -> AI ngừng phân tích camera đó.
    """
    conn = _open_db_readonly()
    if conn is None:
        return {}
    try:
        rows = conn.execute("SELECT id, rtspUrl, status FROM Camera").fetchall()
    except sqlite3.Error as e:
        print(f"⚠️ Không đọc được camera thật từ DB: {e}")
        return {}
    finally:
        conn.close()

    try:
        with open(CAMERA_VIDEO_FILE, encoding="utf-8") as f:
            demo_cam_ids = set(json.load(f).keys())
    except (OSError, json.JSONDecodeError):
        demo_cam_ids = set()

    overrides = {}
    for cam_id, rtsp_url, status in rows:
        if cam_id in demo_cam_ids:
            continue  # camera DEMO -> luôn dùng video mẫu, bỏ qua dù rtspUrl trông giống thật
        if (status or "").upper() != "ONLINE":
            print(f"⏸️  Camera {cam_id} đang tắt (status={status}) — bỏ qua.")
            continue
        webcam_match = re.match(r"^webcam:(\d+)$", rtsp_url or "")
        if webcam_match:
            overrides[cam_id] = int(webcam_match.group(1))
        elif (rtsp_url or "").startswith("rtsp://"):
            overrides[cam_id] = rtsp_url
    return overrides

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
            "occurrenceCount": detection.get("occurrenceCount", 1),
        }, headers={"X-AI-Engine-Secret": AI_ENGINE_SECRET}, timeout=1.0)
    except requests.exceptions.RequestException:
        pass

# NGUỒN DUY NHẤT gán video cho từng camera — DÙNG CHUNG với dashboard
# (src/data/camera-videos.json). Sửa 1 file này là cả YOLO lẫn frontend cùng đổi,
# nên BẤT KỲ video nào gán cho 1 ô đều được YOLO tự phân tích -> tự bắt lỗi, khỏi sửa 2 nơi.
CAMERA_VIDEO_FILE = "src/data/camera-videos.json"


def load_video_camera_map():
    """Đọc {cam-id: 'ten.mp4'} -> gom thành {đường-dẫn-video: [các cam dùng nó]}.

    Camera demo đã bị XOÁ (qua Cài đặt > Giám sát, mất row trong bảng Camera) sẽ
    bị loại khỏi đây -> AI ngừng phân tích, không hiện trên lưới xem trực tiếp nữa,
    dù camera-videos.json vẫn còn ghi (khỏi phải đồng bộ xoá ở 2 nơi)."""
    with open(CAMERA_VIDEO_FILE, encoding="utf-8") as f:
        cam_to_video = json.load(f)

    conn = _open_db_readonly()
    if conn is not None:
        try:
            existing_ids = {row[0] for row in conn.execute("SELECT id FROM Camera")}
            cam_to_video = {cid: fn for cid, fn in cam_to_video.items() if cid in existing_ids}
        except sqlite3.Error as e:
            print(f"⚠️ Không đọc được danh sách camera từ DB, dùng nguyên camera-videos.json: {e}")
        finally:
            conn.close()

    video_to_cams = {}
    for cam_id, filename in cam_to_video.items():
        path = f"public/videos/{filename}"
        video_to_cams.setdefault(path, []).append(cam_id)
    return video_to_cams

class RTSPStream:
    """Đọc luồng RTSP (camera IP thật) trong 1 thread riêng, luôn giữ frame MỚI
    NHẤT (không dồn buffer -> đỡ trễ hình) và tự reconnect khi mạng rớt.

    .read() trả về (success, frame) giống hệt cv2.VideoCapture để dùng thay thế
    được ngay trong vòng lặp chính, không cần biết nguồn là gì.
    """

    def __init__(self, url):
        self.url = url
        self.cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
        self.frame = None
        self.running = True
        self.thread = threading.Thread(target=self._reader, daemon=True)
        self.thread.start()

    def _reader(self):
        while self.running:
            ret, frame = self.cap.read()
            if not ret:
                self.cap.release()
                time.sleep(2)
                self.cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
                continue
            self.frame = frame  # luôn ghi đè, không dồn buffer

    def read(self):
        frame = self.frame
        return frame is not None, frame

    def isOpened(self):
        return self.running

    def release(self):
        self.running = False
        self.thread.join(timeout=3)
        self.cap.release()


def get_video_source(source_config):
    """Mở nguồn video theo config — webcam (số), RTSP ("rtsp://...") hoặc file mp4.

    Nhờ .read() cùng interface (success, frame) ở mọi loại nguồn, phần còn lại
    của pipeline (detect/track/report) KHÔNG cần biết đang đọc từ đâu.
    """
    if isinstance(source_config, str) and source_config.startswith("rtsp"):
        return RTSPStream(source_config)
    return cv2.VideoCapture(source_config)


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

    def make_tracker():
        return PPEViolationTracker(
            model_path=MODEL_PATH,
            confidence=0.25,       # Ngưỡng thấp hơn -> bắt cả vật nhỏ/mờ như GIÀY
            min_height_ratio=0.0,  # TẮT lọc kích thước — hiện tất cả khung, kể cả vật nhỏ/xa
            imgsz=640              # Nét cao -> bắt mũ/vật nhỏ chắc tay hơn (ưu tiên CHÍNH XÁC).
                                   # Video đã cắt còn cảnh đứng nên bù lại phần chậm.
        )

    streams = []
    real_camera_overrides = load_real_camera_overrides()

    # Camera THẬT (thêm qua Settings > Giám sát) -> mở luồng SỐNG riêng (webcam/RTSP),
    # MỖI camera 1 luồng + 1 tracker riêng, không gộp chung.
    for cam_id, source_config in real_camera_overrides.items():
        cap = get_video_source(source_config)
        if not cap.isOpened():
            print(f"⚠️ Không mở được nguồn sống '{source_config}' cho {cam_id} — bỏ qua.")
            continue
        streams.append({"path": str(source_config), "cap": cap, "tracker": make_tracker(),
                        "cams": [cam_id], "is_live": True})
        print(f"📹 {cam_id} -> nguồn sống ({source_config})")

    # Các camera DEMO (không phải camera thật ở trên) vẫn phát video mẫu như cũ —
    # mở 1 luồng (video + tracker riêng) cho mỗi video, cams dùng chung 1 video gộp vào 1 luồng.
    for video_path, cams in load_video_camera_map().items():
        cams = [c for c in cams if c not in real_camera_overrides]
        if not cams:
            continue
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"⚠️ Không mở được {video_path} — bỏ qua {cams}.")
            continue
        streams.append({"path": video_path, "cap": cap, "tracker": make_tracker(),
                        "cams": cams, "is_live": False})
        print(f"🎥 {video_path} -> {cams}")

    if not streams:
        print("❌ Error: Không mở được video nào (thử camera 0)...")
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            print("❌ Không có nguồn video.")
            return
        streams.append({"path": "camera-0", "cap": cap, "tracker": make_tracker(),
                        "cams": ["cam-001"], "is_live": True})

    print(f"✅ Starting real-time tracking trên {len(streams)} luồng...")

    REPORT_INTERVAL = 60  # còn vi phạm liên tục -> chụp+báo lại mỗi 60s/người, không chỉ 1 lần

    # ponytail: dict không tự dọn -> phình dần nếu chạy 24/7 nhiều ngày; nếu cần chạy dài hạn,
    # dọn định kỳ theo track đã biến mất khỏi tracker (không còn trong results.boxes.id).
    last_reported = {}    # (cameraId, trackId) -> lúc ghi DB gần nhất, để biết khi nào báo lại
    violation_count = {}  # (cameraId, trackId) -> số lần đã báo liên tục (hiện "vi phạm lần N")

    while True:
        for st in streams:
            cap = st["cap"]
            success, frame = cap.read()
            if not success:
                # Nguồn sống (webcam/RTSP) không có khái niệm "hết video" -> chỉ là
                # frame chưa kịp có (webcam) hoặc đang tự reconnect (RTSPStream), bỏ
                # qua vòng này. File demo -> hết video thật -> quay lại đầu, lặp lại.
                if not st["is_live"]:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
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
                # xem PPEViolationTracker.CONFIRM_CONF/CONFIRM_DELAY). Còn vi phạm liên tục thì
                # báo lại mỗi REPORT_INTERVAL giây/người, không chỉ 1 lần cho tới khi rời khung hình.
                # Ảnh chụp riêng cho ĐÚNG lúc/ĐÚNG người này, khoanh khung đỏ quanh người vi phạm.
                now = time.time()
                for d in violations:
                    if d.get('type') != 'person' or not d.get('confirmed'):
                        continue
                    key = (cam_id, d.get('trackId'))
                    if key[1] is None or now - last_reported.get(key, 0) < REPORT_INTERVAL:
                        continue
                    if not os.path.exists(SNAPSHOT_DIR):
                        os.makedirs(SNAPSHOT_DIR)
                    timestamp = time.strftime("%Y%m%d-%H%M%S")
                    filename = f"violation_{cam_id}_{timestamp}.jpg"
                    annotated = _draw_violation_box(frame.copy(), d["bbox"], d["label"])
                    cv2.imwrite(f"{SNAPSHOT_DIR}/{filename}", annotated)
                    d['snapshotUrl'] = f"/snapshots/{filename}"
                    violation_count[key] = violation_count.get(key, 0) + 1
                    d['occurrenceCount'] = violation_count[key]
                    report_violation(cam_id, d)
                    last_reported[key] = now

        # Small delay to throttle CPU
        time.sleep(0.01)

    for st in streams:
        st["cap"].release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run_inference()
