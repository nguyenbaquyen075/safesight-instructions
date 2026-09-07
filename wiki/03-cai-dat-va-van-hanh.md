# 03 — Cài đặt & vận hành

## Yêu cầu hệ thống

**Node.js**
- Node.js >= 18 (khuyến nghị 20), **npm** (lockfile duy nhất là `package-lock.json`; không dùng yarn/pnpm để không sinh lockfile thứ hai)

**Python** (chỉ cần khi chạy AI)
- Python >= 3.9 (venv của dự án đang là 3.14)
- Thư viện: `ultralytics`, `opencv-python`, `requests` (torch được ultralytics kéo theo)

## Cài đặt

```bash
# 1. Dependencies Next.js
npm install

# 2. Dependencies Python (trong .venv — dev-all.sh tìm đúng .venv/bin/python)
python3 -m venv .venv
.venv/bin/pip install ultralytics opencv-python requests

# 3. Biến môi trường
cp .env .env.local   # rồi chỉnh các giá trị bên dưới (.env.local đã gitignore)

# 4. Khởi tạo DB SQLite + seed Organization/Site/Camera tối thiểu
npx prisma db push
npm run db:seed
```

## Biến môi trường (`.env.local`)

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | ✅ | Dev: `file:./dev.db` (SQLite) |
| `NEXTAUTH_SECRET` | ✅ | NextAuth v5 |
| `NEXT_PUBLIC_YOLO_SERVER_URL` | ✅ | `http://localhost:4001` — thiếu thì UI không nối bridge |
| `AI_ENGINE_SECRET` | ✅ | `POST /api/violations` từ chối request thiếu header `X-AI-Engine-Secret` khớp giá trị này (`openssl rand -base64 24`) |
| `TELEGRAM_ENCRYPT_KEY` | ✅ | Mã hoá bot token Telegram trong DB (32 byte base64) |
| `ROBOFLOW_API_KEY` | tuỳ chọn | Chỉ cần cho trang `/roboflow` và script đối chiếu ảnh tĩnh |
| `NEXT_API_URL` | tuỳ chọn | AI engine gọi Next.js ở đâu (mặc định `http://localhost:3000`) |
| `AGENT_BRIDGE_SECRET` | bắt buộc để poke/ask agent | Next gọi `POST http://127.0.0.1:4002/internal/*`; thiếu ở Next thì không gọi (task vẫn nằm hàng đợi), thiếu ở agent thì route trả 401 |
| `ANTHROPIC_API_KEY` | tuỳ chọn | Mở lane nghiên cứu của agent (review vi phạm, báo cáo ca, hỏi đáp); thiếu thì agent chỉ chạy lane trực vận hành |
| `AGENT_PORT` | tuỳ chọn | Port nội bộ của agent, mặc định `4002` |
| `SNAPSHOT_MAX_MB` | tuỳ chọn | Ngưỡng dung lượng `public/snapshots` để agent tự dọn ảnh cũ, mặc định `2048` |

## File model cần có (không nằm trong repo)

Mọi file `.pt` bị `.gitignore` chặn, đặt ở **gốc repo**:

| File | Vai trò | Thiếu thì sao |
|---|---|---|
| `ppe_multiclass.pt` | model chính 11 lớp | **không chạy được** |
| `ppe_boots.pt` | model phụ, chỉ lớp giày | dùng model chính cho giày |
| `ppe_gang.pt` | model phụ, chỉ lớp găng | dùng model chính cho găng |
| `yolov8n-pose.pt` | điểm khớp cổ tay/cổ chân/đầu | ultralytics tự tải nếu có mạng; không có thì mất khung chỉ chỗ |

## Chạy hệ thống

```bash
npm run dev
```

`dev-all.sh` dọn cổng 3000/4001/4002 cũ rồi khởi động cả 4 tiến trình, Ctrl+C tắt tất cả:

| Tiến trình | Lệnh riêng lẻ | Port |
|---|---|---|
| YOLO Bridge | `npm run dev:bridge` | 4001 |
| AI Engine (Python) | `npm run dev:yolo` | — |
| Agent (trực vận hành + cán bộ an toàn) | `npm run dev:agent` | 4002 (nội bộ) |
| Next.js Dashboard | `npm run dev:web` | 3000 |

Truy cập http://localhost:3000. Chưa có `.venv` thì script bỏ qua AI engine và vẫn chạy web + bridge + agent. Chi tiết agent (lane, tool, hàng đợi): [Agent giám sát tự động](09-agent.md).

> 💡 Chỉ phát triển giao diện, không cài Python: chạy `node ai-engine/mock_yolo.js` để phát detection giả qua bridge.

## Chạy bằng Docker (Dashboard + Bridge)

`Dockerfile` ở gốc repo có hai target, CI (`.github/workflows/docker.yml`) build và đẩy lên GHCR mỗi khi `main` đổi hoặc có tag `vX.Y.Z`:

| Target | Image | Cổng | Ghi chú |
|---|---|---|---|
| `dashboard` | `ghcr.io/nguyenbaquyen075/safesight-instructions/dashboard` | 3000 | Next.js standalone; SQLite tại volume `/app/data/dev.db`, lần đầu chạy tự chép DB đã seed |
| `bridge` | `ghcr.io/nguyenbaquyen075/safesight-instructions/bridge` | 4001 | `ai-engine/yolo_bridge.js` + express + socket.io |

```bash
cp .env.docker.example .env   # secret cho dashboard
docker compose up -d          # hoặc: docker compose up -d --build
```

AI engine và agent không đóng gói (cần model `.pt`, webcam/GPU, `ANTHROPIC_API_KEY`); chạy ngoài container bằng `npm run dev:yolo` / `npm run dev:agent` và trỏ về địa chỉ máy Docker. `public/videos` được mount chỉ đọc để dashboard phát video mẫu.

## Các lệnh npm

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy cả 4 tiến trình |
| `npm run dev:web` / `dev:bridge` / `dev:yolo` / `dev:agent` | Chạy riêng từng tiến trình |
| `npm run test:agent` | Test agent (`node --test agent/test/*.test.ts`) trên SQLite tạm |
| `npm run db:seed` | Seed org/site/camera (`prisma/seed.mjs`) |
| `npm run build` / `npm run start` | Build và chạy bản production |
| `npm run lint` | ESLint |

## Tinh chỉnh AI (`ai-engine/yolo_inference.py`)

```python
MODEL_PATH = "ppe_multiclass.pt"
TOC_DO_PHAT = 0.75            # tốc độ phát video mẫu, PHẢI khớp cameras/page.tsx
REPORT_INTERVAL = 60          # còn vi phạm thì báo lại mỗi 60s/người
PPEViolationTracker(required_ppe=('helmet','vest','gloves','boots'), confidence=0.15, imgsz=640,
                    parts_models={'boots': 'ppe_boots.pt', 'gloves': 'ppe_gang.pt'})
```

Ngưỡng chốt vi phạm (`CONFIRM_CONF=0.6`, `CONFIRM_DELAY=3.0`) và các ngưỡng lọc theo lớp nằm trong `PPEViolationTracker` (`ai-engine/ppe_tracker.py`). Sau khi đổi model hay ngưỡng, nghiệm thu bằng `ai-engine/eval_ppe_decision.py` và `ai-engine/sweep_threshold.py` (xem [Tích hợp YOLO](06-tich-hop-yolo.md)).

## Gán nguồn video cho camera

- Camera demo: `src/data/camera-videos.json` (`cam-id → tên file trong public/videos/`).
- Camera thật hoặc đổi video qua giao diện: **Cài đặt > Giám sát** ghi vào `Camera.rtspUrl` theo quy ước `webcam:0`, `rtsp://...`, `video:ten.mp4`. Camera có `status` khác `ONLINE` bị AI bỏ qua.

---
👉 Tiếp theo: [Mô hình dữ liệu](04-mo-hinh-du-lieu.md)
