# 02 — Kiến trúc hệ thống

## Tổng quan 3 tiến trình

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  AI Engine       │─────▶│  YOLO Bridge     │─────▶│  Next.js         │
│  (Python/YOLOv8) │ HTTP │  (Node/Socket.IO)│  WS  │  Dashboard       │
│  ai-engine/      │      │  Port: 4001      │      │  Port: 3000      │
└──────────────────┘      └──────────────────┘      └──────────────────┘
        │  POST /api/violations (header X-AI-Engine-Secret)   │
        └─────────────────────────────────────────────────────┘
                                   ▼
                        ┌──────────────────────┐
                        │ Prisma + SQLite (dev) │──▶ Telegram (alert-notifier)
                        └──────────────────────┘
```

Cả 3 tiến trình khởi động bằng **một lệnh** `npm run dev` (`dev-all.sh`) — xem [Cài đặt & vận hành](03-cai-dat-va-van-hanh.md).

## Vai trò từng thành phần

### 1. AI Engine — `ai-engine/yolo_inference.py` + `ai-engine/ppe_tracker.py`
- Mở nguồn video cho từng camera: video mẫu trong `public/videos/`, webcam hoặc RTSP (quy ước lưu trong cột `Camera.rtspUrl`, xem `src/lib/camera-source.ts`). Mỗi luồng có một `PPEViolationTracker` riêng.
- Model chính `ppe_multiclass.pt` (11 lớp) + model phụ `ppe_boots.pt`/`ppe_gang.pt` (chỉ giày/găng) + `yolov8n-pose.pt` (điểm khớp để đặt khung tay/chân/đầu). Chi tiết ở [Tích hợp YOLO](06-tich-hop-yolo.md).
- Gửi detection từng frame qua **HTTP POST** tới Bridge (`http://localhost:4001/detections`) kèm `videoPos` để trình duyệt tua video khớp cảnh AI đang phân tích.
- Vi phạm đã **chốt** (conf ≥ 0.6, thiếu PPE liên tục ≥ 3s) → chụp ảnh bằng chứng vào `public/snapshots/` → `POST /api/violations` ghi DB. Còn vi phạm thì báo lại mỗi 60s/người kèm `occurrenceCount`.

### 2. YOLO Bridge — `ai-engine/yolo_bridge.js`
- Server Express + Socket.IO (port **4001**).
- Nhận detection từ Python, phát vào room `camera-<id>` và room `all-cameras` (client chỉ xem 1 camera không phải nhận dữ liệu mọi camera).
- Relay sự kiện `voice-broadcast` (mic trên trang `/cameras` → trang `/site-speaker`).

### 3. Next.js Dashboard — `src/`
- Next.js 16 App Router (port **3000**), NextAuth v5 (Credentials), Prisma 7.
- Nhận realtime qua hook `useYolo` (`src/hooks/useYolo.ts`), vẽ khung trên `CameraCard`.
- API routes (`src/app/api/`) đọc/ghi DB thật; `POST /api/violations` gọi `notifyViolation()` gửi Telegram theo `AlertRule` (fire-and-forget, không chặn vòng lặp AI).

## Luồng dữ liệu

```
Nguồn video ──▶ ppe_tracker.process_frame() ──(HTTP)──▶ yolo_bridge.js ──(Socket.IO)──▶ useYolo ──▶ khung xanh/đỏ trên UI
                        │
                        └── confirmed ──▶ snapshot ──▶ POST /api/violations ──▶ Prisma ──▶ Telegram
```

## Ghi chú kiến trúc

- **Vì sao tách Bridge?** Python (AI, có thể chạy trên máy GPU) và frontend độc lập; Bridge là điểm nối chuẩn hoá, dễ thay nguồn AI về sau.
- **Python đọc thẳng SQLite** (`prisma/dev.db`, chế độ chỉ đọc) để biết danh sách camera vì tiến trình AI khởi động trước khi Next.js sẵn sàng.
- **Bridge chưa có xác thực** (ghi chú `ponytail:` trong file) — chỉ dùng trong localhost/máy demo.
- Roboflow (`ai-engine/roboflow_workflow.py`, trang `/roboflow`) chỉ dùng cho **ảnh tĩnh** để đối chiếu; pipeline camera luôn chạy model local.

## Cổng mạng (mặc định)

| Thành phần | Cổng | Giao thức vào |
|---|---|---|
| Next.js Dashboard | 3000 | HTTP |
| YOLO Bridge | 4001 | HTTP (`POST /detections`) + Socket.IO |
| AI Engine | — | không mở cổng, chỉ gửi đi |

---
👉 Tiếp theo: [Cài đặt & vận hành](03-cai-dat-va-van-hanh.md)
