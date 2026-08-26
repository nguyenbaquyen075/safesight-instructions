# SafeSight Instructions

Hệ thống giám sát vi phạm trang bị bảo hộ lao động (PPE) theo thời gian thực trên công trường xây dựng, dùng YOLOv8 (Computer Vision) kết hợp Next.js Dashboard.

Phát hiện: không đội mũ bảo hộ, không mặc áo phản quang — ghi nhận bằng chứng (ảnh + bounding box), cảnh báo real-time qua Socket.IO, lưu trữ vi phạm vào cơ sở dữ liệu.

## Giấy phép

Phát hành theo giấy phép **MIT** (OSI-approved) — xem toàn văn tại [`LICENSE`](./LICENSE). Chọn MIT vì đây là giấy phép permissive, cho phép sử dụng/sửa đổi/phân phối tự do kể cả mục đích thương mại, phù hợp mục tiêu phổ biến rộng rãi giải pháp an toàn lao động nguồn mở.

## Kiến trúc hệ thống

```
┌────────────────┐     ┌────────────────┐     ┌──────────────────┐
│  YOLOv8 Model   │────▶│  YOLO Bridge   │────▶│  Next.js Dashboard│
│  (Python)       │ HTTP│  (Node.js)     │ WS  │  (React/Tailwind) │
│  ai-engine/     │     │  Port: 4001    │     │  Port: 3000       │
└────────────────┘     └────────────────┘     └──────────────────┘
        │                                              │
        │ POST /api/violations                         │
        └──────────────────────────────────────────────┘
                              ▼
                     ┌─────────────────┐
                     │  Prisma + SQLite │
                     │  (dev) / Postgres│
                     │  (production)    │
                     └─────────────────┘
```

- **AI Engine** (`ai-engine/`) — Python/YOLOv8 nhận diện PPE + `ppe_tracker.py` theo dõi đối tượng (track ID), xác nhận vi phạm sau khi thấy liên tục ≥3s để giảm báo động giả. Gửi detection cho `yolo_bridge.js` (overlay real-time) và ghi violation đã xác nhận vào DB qua Next.js API.
- **YOLO Bridge** (`ai-engine/yolo_bridge.js`) — Server Socket.IO trung gian, broadcast detection theo room từng camera (đỡ băng thông cho client chỉ xem 1 camera).
- **Next.js Dashboard** (`src/`) — Giao diện xem live camera, danh sách vi phạm, thống kê; API routes (`src/app/api/`) + Prisma ORM lưu trữ dữ liệu thật.

## Yêu cầu hệ thống

- Node.js >= 18, npm
- Python >= 3.9 với `torch`, `ultralytics`, `opencv-python`, `requests` (khuyến nghị dùng `.venv`)

## Cài đặt

```bash
# 1. Dependencies Next.js
npm install

# 2. Dependencies Python (trong .venv)
python3 -m venv .venv
.venv/bin/pip install ultralytics opencv-python requests

# 3. Biến môi trường — tạo .env.local (KHÔNG commit, đã gitignore)
cp .env .env.local   # rồi chỉnh DATABASE_URL, NEXTAUTH_SECRET, NEXT_PUBLIC_YOLO_SERVER_URL,
                      # và AI_ENGINE_SECRET (bắt buộc — POST /api/violations từ chối request
                      # thiếu header X-AI-Engine-Secret khớp giá trị này, sinh bằng
                      # `openssl rand -base64 24`)
                      #
                      # TELEGRAM_ENCRYPT_KEY (bắt buộc — dùng mã hoá bot token Telegram lưu
                      # trong DB, app throw lỗi "TELEGRAM_ENCRYPT_KEY is not set" ngay lần
                      # đầu lưu token nếu thiếu, sinh bằng
                      # `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)
                      #
                      # ROBOFLOW_API_KEY (tuỳ chọn — chỉ cần nếu dùng Roboflow Workflow để
                      # đối chiếu kết quả trên ảnh tĩnh, xem mục "Đối chiếu bằng Roboflow
                      # Workflow" bên dưới; lấy ở app.roboflow.com/settings/api)

# 4. Khởi tạo DB + seed dữ liệu Camera/Site tối thiểu (bắt buộc, nếu không
#    Violation write sẽ lỗi 404 vì cameraId chưa tồn tại)
npx prisma db push
npm run db:seed
```

## Chạy dự án

```bash
npm run dev
```

Lệnh này chạy `dev-all.sh`, tự khởi động cả 3 tiến trình cùng lúc (Ctrl+C tắt tất cả):

| Tiến trình | Lệnh riêng lẻ | Port |
|---|---|---|
| Next.js Dashboard | `npm run dev:web` | 3000 |
| YOLO Bridge (Socket.IO) | `npm run dev:bridge` | 4001 |
| YOLO Inference (Python) | `npm run dev:yolo` | — (POST tới bridge + API) |

Truy cập dashboard tại [http://localhost:3000](http://localhost:3000).

## Cấu hình AI Engine

Model, ngưỡng confidence và các tham số nhận diện nằm ở đầu file `ai-engine/yolo_inference.py` và trong `PPEViolationTracker` (`ai-engine/ppe_tracker.py`):

- `MODEL_PATH` — model YOLOv8 đã train PPE (đặt file `.pt` ở gốc repo, không commit — xem `.gitignore`).
- `CONFIRM_CONF` / `CONFIRM_DELAY` — ngưỡng độ tin cậy và thời gian tồn tại liên tục tối thiểu trước khi CHỐT một vi phạm để ghi DB (mặc định 0.6 / 3 giây), giảm báo động giả.
- Nguồn video/camera map tại `src/data/camera-videos.json`.

## File model cần có (KHÔNG nằm trong repo)

Mọi file `.pt` đều bị `.gitignore` chặn. Máy mới clone về phải chép tay:

| file | vai trò | thiếu thì sao |
|---|---|---|
| `ppe_multiclass.pt` | model chính — người, mũ, áo, găng | **không chạy được** |
| `ppe_boots.pt` | model phụ, CHỈ lớp giày | chạy tiếp bằng model chính, giày bỏ lọt cao hơn |
| `yolov8n-pose.pt` | toạ độ cổ tay/cổ chân để đặt khung "THIẾU GĂNG/GIÀY" | chạy tiếp, mất khung chỉ chỗ (ultralytics tự tải nếu có mạng) |

Hai file phụ đều có đường lui, chỉ `ppe_multiclass.pt` là bắt buộc.

Nghiệm thu sau khi thay model — chạy cả hai, đừng tin mAP:

```bash
.venv/bin/python ai-engine/eval_ppe_decision.py            # báo oan / bỏ lọt, 4 lớp
.venv/bin/python ai-engine/sweep_threshold.py <model> boots [model_phụ]  # quét ngưỡng
```

## Đối chiếu bằng Roboflow Workflow (ảnh tĩnh)

`ai-engine/roboflow_workflow.py` gọi workflow **"Detech PPE vdetech-ppe-7qydu-vnlwm-1-yolo26n-t2 Logic"**
trên Roboflow Serverless để nhận diện PPE trên **một ảnh tĩnh** — dùng khi cần đối chiếu
model cloud với model local `ppe_multiclass.pt`. Pipeline camera trực tiếp **vẫn chạy model
local**, không gọi cloud từng frame (tốn credit + trễ mạng).

```python
from roboflow_workflow import detect_ppe

detect_ppe("anh.jpg")                     # đường dẫn file
detect_ppe(frame)                         # frame OpenCV (numpy BGR)
detect_ppe("https://.../anh.jpg")         # URL, bắt buộc https
# -> [{"class": "Person", "confidence": 0.87,
#      "bbox": {"left": "...%", "top": "...%", "width": "...%", "height": "...%"}}, ...]
```

`bbox` trả về theo dạng phần trăm giống `_bbox_pct()` trong `ppe_tracker.py`, nên dùng lại
được ngay với dashboard và `_draw_violation_box()`. Cần `ROBOFLOW_API_KEY` trong `.env.local`.

**Hai workflow dùng chung một client.** Spec của cả hai giống hệt nhau (input `image`, không
parameter, output `predictions`) nên `detect_ppe()` nhận thêm tham số `workflow`:

| Key | Workflow | Model bên trong |
|---|---|---|
| `detech-ppe` (mặc định) | Detech PPE vdetech-ppe-7qydu-vnlwm-1-yolo26n-t2 Logic | `detech-ppe-7qydu-vnlwm-1-yolo26n-t2` |
| `ppes-kaxsi` | PPEs vppes-kaxsi-ea9pf-1-yolo11n-t1 Logic | `ppes-kaxsi-ea9pf-1-yolo11n-t1` |

```python
detect_ppe(frame, workflow="ppes-kaxsi")
```

⚠️ Hai model **khác từ vựng lớp**: `detech-ppe` trả `gloves` (số nhiều, khớp `ppe_tracker.py`),
`ppes-kaxsi` trả `glove` (số ít). Muốn map sang tracker phải chuẩn hoá tên trước.

Smoke test (gọi mạng thật, tốn 1 credit):

```bash
.venv/bin/python ai-engine/test_roboflow_workflow.py
```

### Demo đo độ ổn định trên nguồn video

`ai-engine/demo_roboflow_stream.py` lấy mẫu frame từ một nguồn video, gửi lên Roboflow theo
nhịp rồi báo cáo tỉ lệ thành công / độ trễ — dùng để **kiểm chứng** trước khi tin dùng.
Đây là công cụ đo, không phải pipeline production. **Mỗi frame gửi đi = 1 credit.**

```bash
.venv/bin/python ai-engine/demo_roboflow_stream.py                       # video mẫu, 20 frame
.venv/bin/python ai-engine/demo_roboflow_stream.py --source 0            # webcam
.venv/bin/python ai-engine/demo_roboflow_stream.py --source rtsp://...   # camera IP
.venv/bin/python ai-engine/demo_roboflow_stream.py --frames 50
```

Ảnh đã khoanh khung được lưu sẵn vào `public/snapshots/roboflow/` (đã gitignore), tên file
kèm số detection — `rf_002_2det.jpg`, `rf_003_0det.jpg` — nên lướt thư mục là biết ngay frame
nào bắt được gì, khỏi phải render video. Truyền `--save-dir ""` nếu không muốn lưu.

Thoát `0` nếu mọi lần gọi thành công, `1` nếu có lần trượt.

### Xem trực tiếp trên dashboard

Trang **`/roboflow`** ("Kiểm thử Roboflow" ở thanh bên) cho kéo thả một ảnh rồi hiện luôn
khung detection kèm class/confidence và độ trễ — dùng khi muốn mắt thường đối chiếu model
cloud với model local, khỏi chạy script.

- Ảnh được thu nhỏ về 640px **ngay trên trình duyệt** (canvas) trước khi gửi, giống
  `MAX_IMAGE_SIDE` trong `roboflow_workflow.py`.
- `POST /api/roboflow` giữ `ROBOFLOW_API_KEY` ở phía server — trình duyệt không bao giờ
  thấy key, nên không gọi thẳng Roboflow từ client.
- Route **bắt buộc đăng nhập** và trang chỉ mở cho `SUPER_ADMIN` / `ORG_ADMIN`, vì
  **mỗi lần chạy tốn 1 credit Roboflow**.
- Chọn model bằng 2 nút ở đầu trang; đổi model sẽ chạy lại đúng ảnh đang xem (tốn thêm
  1 credit). Client chỉ gửi được key trong allowlist của route, không truyền slug tuỳ ý.

## Cấu trúc thư mục chính

```
├── src/                       # Next.js App Router (dashboard + API routes)
│   ├── app/api/                #   REST endpoints (Prisma)
│   ├── components/             #   UI components
│   ├── hooks/                  #   useYolo, useCameras, useViolations...
│   └── data/                   #   mock data + camera-videos.json
├── ai-engine/                  # AI/CV engine (Python + bridge Node.js)
│   ├── yolo_inference.py       #   Vòng lặp inference chính
│   ├── ppe_tracker.py          #   Logic tracking + xác nhận vi phạm
│   ├── roboflow_workflow.py    #   Client Roboflow Workflow (ảnh tĩnh, đối chiếu)
│   ├── demo_roboflow_stream.py #   Demo đo độ ổn định Roboflow trên nguồn video
│   └── yolo_bridge.js          #   Socket.IO bridge (room theo camera)
├── prisma/                     # Schema DB + seed script
├── public/videos/              # Video mẫu cho demo AI
├── training/                   # Script/tài liệu train lại model YOLOv8
└── wiki/                       # Tài liệu kiến trúc & vận hành chi tiết
```

## Các lớp (class) được nhận diện

| Class | Trạng thái |
|-------|-----------|
| `helmet`, `vest`, `gloves`, `boots`, `goggles` | ✅ An toàn |
| `no_helmet`, `no_vest` (bắt buộc) | ❌ Vi phạm |

## Tài liệu tham khảo

- [Next.js Documentation](https://nextjs.org/docs)
- [Ultralytics YOLOv8](https://docs.ultralytics.com/)
- [Socket.IO](https://socket.io/docs/)
- [Prisma](https://www.prisma.io/docs)
