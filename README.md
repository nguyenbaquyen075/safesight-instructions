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
