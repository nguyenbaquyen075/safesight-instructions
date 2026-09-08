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
from clips import FrameRing, start_clip
from zones import DangerZone, IntrusionTracker, intrusions, parse_polygon
from env_local import load_dotenv_local

load_dotenv_local()

# Configuration
BRIDGE_URL = "http://localhost:4001/detections"
NEXT_API_URL = os.environ.get("NEXT_API_URL", "http://localhost:3000") + "/api/violations"
OBSERVATIONS_API_URL = os.environ.get("NEXT_API_URL", "http://localhost:3000") + "/api/observations"
AI_ENGINE_SECRET = os.environ.get("AI_ENGINE_SECRET", "")
# HTTP status của bridge đã cảnh báo rồi — chỉ in 1 lần/status, khỏi spam log mỗi frame.
_bridge_warned_statuses = set()
_observation_warned_statuses = set()
SNAPSHOT_DIR = "public/snapshots"
# Heartbeat cho agent (agent/lib/capabilities.ts đọc file này): còn sống, bao nhiêu luồng, fps ước lượng.
HEARTBEAT_PATH = os.path.join(SNAPSHOT_DIR, ".heartbeat.json")

# Đã kêu về DATABASE_URL PostgreSQL rồi -> chỉ kêu MỘT lần lúc khởi động, vì
# load_zones() còn gọi lại mỗi 60s (đừng biến log thành bãi rác).
_pg_warned = False


def _open_db_readonly():
    """Mở file SQLite của Next.js (prisma/dev.db) chỉ để ĐỌC. Đọc THẲNG file thay vì
    gọi API /api/cameras vì tiến trình này khởi động TRƯỚC khi Next.js kịp sẵn sàng
    (xem dev-all.sh) — gọi HTTP lúc đó sẽ lỗi. Trả None nếu chưa có DB (chưa chạy
    `npm run db:seed` / db chưa được tạo).

    CHƯA hỗ trợ PostgreSQL: dashboard/agent chọn adapter theo lược đồ DATABASE_URL,
    còn engine vẫn đọc thẳng file SQLite. Gặp URL Postgres thì báo TO rồi trả None —
    trước đây im lặng nên vùng nhận diện và camera thật tắt mà không ai biết."""
    global _pg_warned
    db_url = os.environ.get("DATABASE_URL", "")
    if db_url.startswith(("postgres://", "postgresql://")):
        if not _pg_warned:
            _pg_warned = True
            print("❌ AI engine CHƯA đọc được PostgreSQL — cần DATABASE_URL dạng `file:...` (SQLite). Vùng nhận diện (Zone) và camera thật sẽ KHÔNG hoạt động, chỉ còn video demo.")
        return None
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
      "webcam:0"      -> webcam theo index 0
      "rtsp://..."    -> camera IP thật qua RTSP
      "video:ten.mp4" -> video mẫu trong public/videos/ (camera mô phỏng)

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
        if cam_id in demo_cam_ids and not (rtsp_url or "").startswith("video:"):
            # Camera DEMO chưa được gắn video riêng -> để camera-videos.json lo.
            # Còn nếu anh đã chọn video khác qua Cài đặt > Giám sát (rtspUrl = "video:...")
            # thì tôn trọng lựa chọn đó, ghi đè video mặc định trong json.
            continue
        if (status or "").upper() != "ONLINE":
            print(f"⏸️  Camera {cam_id} đang tắt (status={status}) — bỏ qua.")
            continue
        webcam_match = re.match(r"^webcam:(\d+)$", rtsp_url or "")
        if webcam_match:
            overrides[cam_id] = int(webcam_match.group(1))
        elif (rtsp_url or "").startswith("rtsp://"):
            overrides[cam_id] = rtsp_url
        elif (rtsp_url or "").startswith("video:"):
            # Camera MÔ PHỎNG: anh tự gắn video mẫu qua Cài đặt > Giám sát, không
            # phải sửa camera-videos.json rồi khởi động lại như trước.
            name = rtsp_url[6:]
            if os.path.basename(name) != name or not name:
                print(f"⚠️ Camera {cam_id}: tên video không hợp lệ ({name!r}) — bỏ qua.")
                continue
            path = os.path.join("public", "videos", name)
            if not os.path.exists(path):
                print(f"⚠️ Camera {cam_id}: không tìm thấy {path} — bỏ qua.")
                continue
            overrides[cam_id] = path
    return overrides

# PPE thiếu -> (type, severity) khớp src/types/enums.ts (ViolationType/Severity)
# Loại Zone nguy hiểm -> (ViolationType, Severity) khớp src/types/enums.ts.
# WARNING là vùng "cảnh báo" (mép vùng cấm) nên nhẹ hơn một bậc.
ZONE_VIOLATION_MAP = {
    "RESTRICTED": ("zone_intrusion", "critical"),
    "WARNING": ("zone_intrusion", "high"),
    "SUSPENDED_LOAD": ("suspended_load", "critical"),
}

PPE_VIOLATION_MAP = {
    "helmet": ("hard_hat", "critical"),
    "vest": ("safety_vest", "high"),
    "gloves": ("safety_gloves", "medium"),
    "boots": ("safety_footwear", "medium"),
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


def _person_boxes(detections, frame):
    """Khung NGƯỜI (pixel) dựng lại từ detections mà process_frame vừa trả về.

    Lấy ở đây thay vì sửa ppe_tracker.py: chỉ cần toạ độ người, không cần đụng vào
    400 dòng logic PPE. Đánh đổi: đây là người ĐÃ bị lọc theo vùng làm việc, nên
    vùng cấm vẽ ngoài mọi vùng làm việc của camera sẽ không bắt được ai — camera
    nào cần bắt xâm nhập thì đừng khai vùng làm việc, hoặc vẽ vùng làm việc phủ
    luôn vùng cấm.
    """
    h, w = frame.shape[:2]
    persons = []
    for d in detections:
        if d.get("type") != "person":
            continue
        bbox = d["bbox"]
        x1 = _pct_to_ratio(bbox["left"]) * w
        y1 = _pct_to_ratio(bbox["top"]) * h
        persons.append({
            "box": [x1, y1, x1 + _pct_to_ratio(bbox["width"]) * w,
                    y1 + _pct_to_ratio(bbox["height"]) * h],
            "detection": d,
        })
    return persons


def report_violation(cam_id, detection):
    """Ghi 1 Violation vào DB qua API Next.js (POST /api/violations).

    Chỉ gọi khi: có PPE bị thiếu khớp map (hoặc detection đã tự khai
    violationType — vi phạm xâm nhập vùng cấm), và đã có snapshot bằng chứng
    (snapshotUrl được yolo_inference.py gắn vào detection ở vòng lặp chính).
    """
    # Vi phạm xâm nhập tự khai type/severity (không dính gì tới PPE); PPE thì suy
    # từ món còn thiếu như cũ.
    vtype = detection.get("violationType")
    severity = detection.get("severity")
    if not vtype:
        for ppe in ("helmet", "vest", "gloves", "boots"):  # ưu tiên theo mức nghiêm trọng
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
            # zoneId chỉ có ở vi phạm xâm nhập (API nhận zoneId tuỳ chọn, không nhận null).
            **({"zoneId": detection["zoneId"]} if detection.get("zoneId") else {}),
            # Clip chỉ gửi khi ghi được (API nhận clipUrl tuỳ chọn, không nhận null).
            **({"clipUrl": detection["clipUrl"]} if detection.get("clipUrl") else {}),
        }, headers={"X-AI-Engine-Secret": AI_ENGINE_SECRET}, timeout=1.0)
    except requests.exceptions.RequestException:
        pass

def minute_iso(ts):
    """Mốc PHÚT dạng ISO UTC (giây = 0) — khoá upsert của ObservationStat."""
    return time.strftime("%Y-%m-%dT%H:%M:00.000Z", time.gmtime(ts))


def post_observations(rows):
    """Gửi số người quan sát được của phút vừa xong (POST /api/observations).

    Gọi ở THREAD PHỤ (như write_preview): timeout 2s tuy mỗi phút mới tốn một lần
    nhưng nó khựng MỌI luồng cùng lúc — dashboard treo (không phải từ chối) là mất
    2s hình của tất cả camera. Lỗi mạng thì bỏ qua phút đó (mẫu số thiếu 1 phút,
    không sao) và chỉ in cảnh báo 1 lần cho mỗi HTTP status như POST sang bridge.
    """
    try:
        resp = session.post(OBSERVATIONS_API_URL, json={"observations": rows},
                            headers={"X-AI-Engine-Secret": AI_ENGINE_SECRET}, timeout=2.0)
        if not resp.ok and resp.status_code not in _observation_warned_statuses:
            _observation_warned_statuses.add(resp.status_code)
            print(f"⚠️ dashboard từ chối số liệu quan sát: HTTP {resp.status_code} — kiểm tra AI_ENGINE_SECRET trong .env.local")
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


# Vùng nhận diện được sửa trên web (Cài đặt > Giám sát) trong lúc engine đang chạy
# -> đọc lại DB mỗi 60s, khỏi phải khởi động lại engine.
ZONE_REFRESH_INTERVAL = 60


def load_zones():
    """Đọc MỌI vùng đang bật -> {cameraId: {'monitoring': [poly], 'danger': [DangerZone]}}.

    Hai nhóm dùng vào hai việc khác hẳn nhau:
      - MONITORING = vùng LÀM VIỆC, chỉ để LỌC người trước khi xét PPE;
      - RESTRICTED/WARNING/SUSPENDED_LOAD = vùng NGUY HIỂM, bước chân vào là vi phạm.
    Toạ độ là tỉ lệ 0–1 theo khung hình (xem src/lib/zone-shape.ts, cùng quy ước với
    trình vẽ). Camera không có vùng nào -> không có khoá trong dict -> xét cả khung.
    """
    conn = _open_db_readonly()
    if conn is None:
        return {}
    try:
        rows = conn.execute(
            "SELECT id, cameraId, type, polygonData FROM Zone WHERE isActive = 1"
        ).fetchall()
    except sqlite3.Error as e:
        print(f"⚠️ Không đọc được vùng nhận diện từ DB: {e}")
        return {}
    finally:
        conn.close()

    zones = {}
    for zone_id, cam_id, zone_type, raw in rows:
        polygon = parse_polygon(raw)
        if not polygon:
            continue
        cam = zones.setdefault(cam_id, {'monitoring': [], 'danger': []})
        if zone_type in ZONE_VIOLATION_MAP:
            cam['danger'].append(DangerZone(zone_id, zone_type, polygon))
        else:
            # Loại lạ (sửa tay trong DB) coi như MONITORING, giống toZoneDTO bên web:
            # thà lọc người thừa còn hơn tự dựng vùng cấm không ai khai.
            cam['monitoring'].append(polygon)
    return zones


def zones_for_stream(cam_ids, zones_by_camera):
    """Vùng LÀM VIỆC áp cho MỘT luồng video. Một luồng có thể phục vụ nhiều camera demo dùng
    chung file video: detections tính một lần rồi gửi cho tất cả, nên chỉ cần MỘT
    camera trong nhóm chưa khai vùng là phải xét cả khung (None), không thì camera
    đó mất người."""
    polygons = []
    for cam_id in cam_ids:
        cam_zones = (zones_by_camera.get(cam_id) or {}).get('monitoring')
        if not cam_zones:
            return None
        polygons.extend(cam_zones)
    return polygons or None


def danger_zones_for(cam_id, zones_by_camera):
    """Vùng nguy hiểm của ĐÚNG một camera — không gộp theo luồng như vùng làm việc:
    zoneId ghi vào Violation phải thuộc chính camera đang báo."""
    return (zones_by_camera.get(cam_id) or {}).get('danger') or []

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

# Tốc độ phát video mẫu. PHẢI KHỚP với playbackRate bên giao diện
# (src/app/(dashboard)/cameras/page.tsx, hằng TOC_DO_PHAT) — lệch nhau thì khung
# nhận diện lại trôi khỏi hình như trước. 0.5 = chậm một nửa, khung dễ theo mắt.
TOC_DO_PHAT = 0.75

# Dùng 1 kết nối HTTP tái sử dụng (keep-alive) cho nhẹ
session = requests.Session()


def clear_snapshots():
    """Xoá toàn bộ bằng chứng đã bắt (ảnh + clip) — chỉ tồn tại TRONG LÚC chạy dự án."""
    if not os.path.isdir(SNAPSHOT_DIR):
        return
    removed = 0
    for name in os.listdir(SNAPSHOT_DIR):
        if ((name.startswith("violation_") and name.endswith(".jpg"))
                or (name.startswith("clip_") and name.endswith(".mp4"))):
            try:
                os.remove(os.path.join(SNAPSHOT_DIR, name))
                removed += 1
            except OSError:
                pass
    if removed:
        print(f"🧹 Đã xoá {removed} tệp bằng chứng vi phạm.")
    # Xoá heartbeat để agent biết ngay engine đã tắt, không đợi pid cũ bị hệ điều hành tái sử dụng.
    try:
        os.remove(HEARTBEAT_PATH)
    except OSError:
        pass


PREVIEW_INTERVAL = 30   # giây giữa 2 ảnh xem trước của cùng một camera
PREVIEW_WIDTH = 640
_preview_last = {}      # cameraId -> lúc ghi ảnh xem trước gần nhất


def write_preview(cam_id, frame):
    """Ghi public/snapshots/preview_<cameraId>.jpg làm NỀN cho trình vẽ vùng.

    Dùng lại đúng khung vừa đọc (không mở thêm luồng). Thu nhỏ ngay tại đây (rẻ)
    rồi giao phần nén JPEG + ghi đĩa cho thread phụ để vòng lặp nhận diện không
    phải đợi ổ đĩa. Ghi ra file tạm rồi os.replace -> trình duyệt không bao giờ
    đọc phải ảnh viết dở.
    """
    h, w = frame.shape[:2]
    small = (cv2.resize(frame, (PREVIEW_WIDTH, max(1, round(h * PREVIEW_WIDTH / w))))
             if w > PREVIEW_WIDTH else frame.copy())

    def _save():
        tmp = os.path.join(SNAPSHOT_DIR, f".preview_{cam_id}.tmp.jpg")
        try:
            os.makedirs(SNAPSHOT_DIR, exist_ok=True)
            if cv2.imwrite(tmp, small, [int(cv2.IMWRITE_JPEG_QUALITY), 80]):
                os.replace(tmp, os.path.join(SNAPSHOT_DIR, f"preview_{cam_id}.jpg"))
        except (OSError, cv2.error):
            pass

    threading.Thread(target=_save, daemon=True).start()


def write_heartbeat(streams: int = 0, fps: float = 0.0):
    """Ghi .heartbeat.json (pid, thời điểm, số luồng, fps) cho agent trực vận hành."""
    try:
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
        with open(HEARTBEAT_PATH, "w", encoding="utf-8") as f:
            json.dump({"pid": os.getpid(), "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                       "streams": streams, "fps": fps}, f)
    except OSError:
        pass


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
    # Ghi heartbeat NGAY, trước khi nạp model (mất vài chục giây): nếu chờ tới vòng lặp đầu tiên
    # thì trong khoảng đó agent vẫn đọc heartbeat cũ và SIGTERM nhầm pid của lần chạy trước.
    write_heartbeat()

    def make_tracker():
        return PPEViolationTracker(
            model_path=MODEL_PATH,
            # Người KHÔNG đeo găng / KHÔNG đi giày cũng là vi phạm — anh yêu cầu
            # 24/08/2026. Giá phải trả, đo bằng ai-engine/eval_ppe_decision.py trên
            # 283 ảnh có nhãn: găng báo oan 11.3%, giày 9.1% (người ĐANG đeo mà bị
            # bảo thiếu). Muốn tắt lại thì bỏ 'gloves','boots' khỏi dòng dưới.
            required_ppe=('helmet', 'vest', 'gloves', 'boots'),
            # GĂNG lấy từ model phụ ppe_v3_clean.pt (báo oan 11.3% -> 8.7%,
            # bỏ lọt giữ 0.4%). CHỈ găng — đã quét ngưỡng và thấy model phụ
            # làm GIÀY tệ hơn (oan 12.6% vs 6.3% của model gốc tại cùng mức lọt).
            # Người/mũ/áo/giày vẫn do model gốc lo -> mũ 4.7% và áo 3.1% không đổi.
            # Giá: 2 lần suy luận mỗi khung. Bỏ 2 dòng dưới là về 1 model.
            # Model phụ CHỈ cho GIÀY (ppe_boots.pt), train từ chính dữ liệu của anh:
            # detech train + ppes (cả 3 split — nhãn giày của ppes nằm gần hết ở
            # valid/test, bỏ sót chỗ này là mất 606 nhãn "chân trần").
            # no_boots: 88 -> 694 nhãn. mAP tập giày 0.373 -> 0.883 sau 20 epoch.
            # CHỈ giày — găng KHÔNG dùng model phụ: đã thử ppe_v3_clean.pt, nó
            # thắng trên ảnh công trường nhưng THUA ở cận cảnh webcam (tay chiếm
            # 25% khung: gốc 0.08, v3 mất hẳn), tức hỏng đúng thứ anh hay thử.
            # Người/mũ/áo/găng vẫn do model gốc lo -> mũ 4.7%, áo 3.1% không đổi.
            # Mỗi lớp yếu một model chuyên lo, train từ dữ liệu của chính dự án:
            #   giày — ppe_boots.pt  (no_boots 88 -> 694 nhãn)
            #   găng — ppe_gang.pt   (126 khung từ 2 video của anh; trên cam-008
            #                         nhận ra găng 5% -> 70% số khung)
            # Người/mũ/áo vẫn do model chính lo -> không thể bị ảnh hưởng.
            parts_models={'boots': 'ppe_boots.pt', 'gloves': 'ppe_gang.pt'},
            confidence=0.15,       # Ngưỡng thô THẤP để găng/giày (conf 0.15-0.30) lọt vào;
                                   # lọc chặt lại theo từng lớp ở PPEViolationTracker.PART_MIN_CONF
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
        # Video mẫu là FILE, không phải nguồn sống -> is_live=False để hết video thì
        # tua về đầu phát lại. Để True thì camera mô phỏng chạy hết 1 lượt rồi đứng im.
        la_file = isinstance(source_config, str) and not source_config.startswith("rtsp")
        streams.append({"path": str(source_config), "cap": cap, "tracker": make_tracker(),
                        "cams": [cam_id], "is_live": not la_file,
                        "bat_dau": None if not la_file else time.time()})
        loai = "video mẫu (lặp)" if la_file else "nguồn sống"
        print(f"📹 {cam_id} -> {loai} ({source_config})")

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

    _hb_last = time.time()
    _hb_frames = 0

    zones_by_camera = load_zones()
    _zones_last = time.time()
    # Xâm nhập vùng cấm: chốt sau 3s đứng liên tục trong vùng, báo lại mỗi 60s
    # (cùng nhịp với REPORT_INTERVAL của vi phạm PPE). Khoá trạng thái đã gồm
    # cameraId nên một bộ dùng chung cho mọi luồng.
    intrusion_tracker = IntrusionTracker(repeat_seconds=REPORT_INTERVAL)
    # Phút đang gom số liệu quan sát; sang phút mới -> gửi hết mọi luồng rồi đếm lại.
    _obs_minute = minute_iso(time.time())
    if zones_by_camera:
        print("🔷 Vùng: " + ', '.join(
            f"{c} ({len(z['monitoring'])} làm việc, {len(z['danger'])} nguy hiểm)"
            for c, z in zones_by_camera.items()))

    while True:
        # Vùng vừa vẽ trên web có hiệu lực sau tối đa 60s, không cần khởi động lại engine.
        if time.time() - _zones_last >= ZONE_REFRESH_INTERVAL:
            zones_by_camera = load_zones()
            _zones_last = time.time()

        # Hết một phút đồng hồ -> chốt số người quan sát được của mọi luồng và gửi 1 lô.
        _minute_now = minute_iso(time.time())
        if _minute_now != _obs_minute:
            rows = [{"cameraId": cam_id, "minute": _obs_minute,
                     "persons": st.get("obs_persons", 0),
                     "personSeconds": round(st.get("obs_seconds", 0.0), 1)}
                    for st in streams for cam_id in st["cams"]]
            for st in streams:
                st["obs_persons"], st["obs_seconds"] = 0, 0.0
            _obs_minute = _minute_now
            if rows:
                threading.Thread(target=post_observations, args=(rows,), daemon=True).start()

        for st in streams:
            cap = st["cap"]

            # VIDEO FILE: nhảy tới đúng vị trí theo ĐỒNG HỒ THẬT, bỏ qua khung ở giữa.
            # Trình duyệt phát 30 fps, AI chỉ kịp ~4 fps và trước đây đọc TUẦN TỰ từng
            # khung -> sau 1 phút AI mới tới giây thứ 8 còn anh đang xem giây 60, khung
            # nhận diện thuộc về thời điểm hoàn toàn khác với hình đang hiện.
            # Nhảy theo đồng hồ thì AI luôn phân tích đúng đoạn anh đang nhìn.
            if not st["is_live"] and st.get("bat_dau"):
                _fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
                _tong = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
                if _tong > 0:
                    _troi = (time.time() - st["bat_dau"]) * 1000.0 * TOC_DO_PHAT
                    _dai = _tong / _fps * 1000.0
                    cap.set(cv2.CAP_PROP_POS_MSEC, _troi % _dai)

            success, frame = cap.read()
            if not success:
                # Nguồn sống (webcam/RTSP) không có khái niệm "hết video" -> chỉ là
                # frame chưa kịp có (webcam) hoặc đang tự reconnect (RTSPStream), bỏ
                # qua vòng này. File demo -> hết video thật -> quay lại đầu, lặp lại.
                if not st["is_live"]:
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # Đệm khung cho clip bằng chứng (setdefault: mọi luồng đều có, kể cả luồng
            # tạo ở nhánh dự phòng camera 0). Thu nhỏ một nửa trước khi đệm: clip là
            # BỐI CẢNH, ảnh snapshot mới là bằng chứng cần nét — 20 khung 1080p nguyên
            # cỡ tốn ~124MB mỗi luồng, nhân số luồng thì hết RAM. Phần đuôi clip phải
            # dùng ĐÚNG khung đã thu nhỏ này, không thì cv2.VideoWriter (kích thước lấy
            # từ khung đầu) bỏ hết khung sau.
            clip_frame = cv2.resize(frame, None, fx=0.5, fy=0.5)
            st.setdefault("ring", FrameRing()).push(clip_frame)

            # Phân tích ĐÚNG video của luồng này -> khung khớp người trong ô đó
            vi_tri_video = None
            if not st["is_live"]:
                _p = cap.get(cv2.CAP_PROP_POS_MSEC)
                if _p and _p > 0:
                    vi_tri_video = _p / 1000.0

            # Ảnh nền cho trình vẽ vùng — mỗi camera 30s một tấm, ghi ở thread phụ.
            _now_preview = time.time()
            for cam_id in st["cams"]:
                if _now_preview - _preview_last.get(cam_id, 0) >= PREVIEW_INTERVAL:
                    _preview_last[cam_id] = _now_preview
                    write_preview(cam_id, frame)

            detections = st["tracker"].process_frame(
                frame, zones=zones_for_stream(st["cams"], zones_by_camera))

            violations = [d for d in detections if d.get('isViolation')]

            # "Người × giây" cho tỉ lệ tuân thủ: số người CỦA KHUNG NÀY (đã lọc vùng làm
            # việc) nhân khoảng thời gian từ khung trước của chính luồng này. Chặn dt ở 1s
            # để một lần khựng dài (nạp model, RTSP reconnect) không thổi phồng mẫu số.
            _obs_now = time.time()
            _obs_dt = min(_obs_now - st.get("obs_last", _obs_now), 1.0)
            st["obs_last"] = _obs_now
            _obs_persons = getattr(st["tracker"], "last_person_count", 0)
            st["obs_seconds"] = st.get("obs_seconds", 0.0) + _obs_persons * _obs_dt
            st["obs_persons"] = max(st.get("obs_persons", 0), _obs_persons)

            # Gửi toạ độ detections sang bridge cho CÁC camera dùng video này
            for cam_id in st["cams"]:
                try:
                    resp = session.post(BRIDGE_URL, json={
                        "cameraId": cam_id,
                        "detections": detections,
                        # VỊ TRÍ (giây) trong video mà AI VỪA phân tích. Trình duyệt
                        # tua theo số này. Thiếu nó thì hai bên chỉ khớp TỐC ĐỘ chứ
                        # không khớp ĐIỂM XUẤT PHÁT: anh mở trang 30s sau khi AI chạy
                        # -> trình duyệt phát giây 0 còn AI phân tích giây 22, khung
                        # nhận diện thuộc về cảnh hoàn toàn khác.
                        "videoPos": vi_tri_video,
                    }, headers={"X-AI-Engine-Secret": AI_ENGINE_SECRET}, timeout=0.1)
                    if not resp.ok and resp.status_code not in _bridge_warned_statuses:
                        _bridge_warned_statuses.add(resp.status_code)
                        print(f"⚠️ bridge từ chối detection: HTTP {resp.status_code} — kiểm tra AI_ENGINE_SECRET trong .env.local")
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
                    # trackId trong tên tệp: hai người cùng vi phạm ở CÙNG một giây trên
                    # cùng camera (chuyện thường) trước đây cho ra cùng một tên -> hai
                    # cv2.VideoWriter mở đè lên một file, clip hỏng và cả hai Violation
                    # cùng trỏ vào đó. Tiền tố/đuôi giữ nguyên nên clear_snapshots() và
                    # isEvidenceFile() bên agent vẫn khớp.
                    tid = key[1]
                    timestamp = time.strftime("%Y%m%d-%H%M%S")
                    filename = f"violation_{cam_id}_{timestamp}_{tid}.jpg"
                    annotated = _draw_violation_box(frame.copy(), d["bbox"], d["label"])
                    cv2.imwrite(f"{SNAPSHOT_DIR}/{filename}", annotated)
                    d['snapshotUrl'] = f"/snapshots/{filename}"
                    # Clip = 20 khung đã đệm + 12 khung kế tiếp; ghi phần đuôi ở các vòng
                    # lặp sau nên không chặn frame loop.
                    clip_name = f"clip_{cam_id}_{timestamp}_{tid}.mp4"
                    pending = start_clip(f"{SNAPSHOT_DIR}/{clip_name}", st["ring"].snapshot())
                    if pending:
                        st.setdefault("pending_clips", []).append(pending)
                        d['clipUrl'] = f"/snapshots/{clip_name}"
                    violation_count[key] = violation_count.get(key, 0) + 1
                    d['occurrenceCount'] = violation_count[key]
                    report_violation(cam_id, d)
                    last_reported[key] = now

                # XÂM NHẬP VÙNG CẤM: chỉ cần điểm CHÂN nằm trong vùng nguy hiểm của
                # chính camera này (không liên quan PPE). Tracker lo phần "đứng đủ 3s"
                # và "báo lại mỗi 60s", ở đây chỉ còn việc chụp ảnh + ghi DB.
                danger = danger_zones_for(cam_id, zones_by_camera)
                found = []
                if danger:
                    _h, _w = frame.shape[:2]
                    found = intrusions(_person_boxes(detections, frame), danger, _w, _h)
                # Gọi update kể cả khi không có ai/không còn vùng: đó cũng là lúc
                # tracker xoá trạng thái của người đã rời vùng.
                for person, zone_id, zone_type, count in intrusion_tracker.update(
                        cam_id, found, lambda p: p["detection"].get("trackId")):
                    vtype, severity = ZONE_VIOLATION_MAP[zone_type]
                    label = "TẢI TREO" if vtype == "suspended_load" else "VÙNG CẤM"
                    if not os.path.exists(SNAPSHOT_DIR):
                        os.makedirs(SNAPSHOT_DIR)
                    person_det = person["detection"]
                    timestamp = time.strftime("%Y%m%d-%H%M%S")
                    # Hậu tố "-zone": cùng người/cùng giây có thể vừa thiếu PPE vừa
                    # đứng trong vùng cấm -> hai ảnh khác nhau, không đè lên nhau.
                    filename = f"violation_{cam_id}_{timestamp}_{person_det.get('trackId')}-zone.jpg"
                    cv2.imwrite(f"{SNAPSHOT_DIR}/{filename}",
                                _draw_violation_box(frame.copy(), person_det["bbox"], label))
                    report_violation(cam_id, {
                        "bbox": person_det["bbox"],
                        "label": label,
                        "confidence": person_det["confidence"],
                        "violationType": vtype,
                        "severity": severity,
                        "zoneId": zone_id,
                        "occurrenceCount": count,
                        "snapshotUrl": f"/snapshots/{filename}",
                    })

            # Phần đuôi của các clip đang mở: mỗi vòng thêm 1 khung, đủ 12 khung thì tự đóng.
            if st.get("pending_clips"):
                st["pending_clips"] = [p for p in st["pending_clips"] if not p.feed(clip_frame)]

        _hb_frames += 1
        if time.time() - _hb_last >= 5.0:
            write_heartbeat(len(streams), round(_hb_frames / max(time.time() - _hb_last, 1e-6), 1))
            _hb_last, _hb_frames = time.time(), 0

        # Small delay to throttle CPU
        time.sleep(0.01)

    for st in streams:
        st["cap"].release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    run_inference()
