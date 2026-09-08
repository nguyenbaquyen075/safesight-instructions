# 03 — Cài đặt & vận hành

## Yêu cầu hệ thống

**Node.js**
- Node.js >= 18 (khuyến nghị 20), **npm** (lockfile duy nhất là `package-lock.json`; không dùng yarn/pnpm để không sinh lockfile thứ hai)

**Python** (chỉ cần khi chạy AI)
- Python >= 3.9 (venv của dự án đang là 3.14)
- Thư viện: `ultralytics`, `opencv-python`, `requests` (torch được ultralytics kéo theo); phiên bản ghim trong `ai-engine/requirements.txt`
- `pip-audit` chưa được cài trong `.venv`; kiểm tra lỗ hổng cho các gói ghim thì chạy tay: `.venv/bin/pip install pip-audit && .venv/bin/pip-audit -r ai-engine/requirements.txt`

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

> **SQLite chạy WAL.** `src/lib/prisma.ts` đặt `PRAGMA busy_timeout=5000` và `PRAGMA journal_mode=WAL` cho mọi connection (Next.js và agent dùng chung client này). Nhờ vậy AI engine đọc bảng `Camera` không chặn API ghi Violation nữa. Hệ quả: cạnh `dev.db` sẽ có thêm `dev.db-wal` và `dev.db-shm` — đây là file tạm của SQLite, đã gitignore, xoá được khi không tiến trình nào đang mở DB. Sao lưu/copy DB thì phải copy cả ba file (hoặc chạy `sqlite3 dev.db "PRAGMA wal_checkpoint(TRUNCATE);"` trước).

## Biến môi trường (`.env.local`)

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `DATABASE_URL` | ✅ | Dev: `file:./dev.db` (SQLite, chạy ở chế độ WAL — xem ghi chú bên dưới) |
| `NEXTAUTH_SECRET` | ✅ | NextAuth v5 |
| `NEXT_PUBLIC_YOLO_SERVER_URL` | ✅ | `http://localhost:4001` — thiếu thì UI không nối bridge |
| `AI_ENGINE_SECRET` | ✅ | `POST /api/violations` từ chối request thiếu header `X-AI-Engine-Secret` khớp giá trị này (`openssl rand -base64 24`). Bridge dùng cùng giá trị cho `POST /detections` và `POST /announce`; dashboard + agent gửi kèm header này khi phát loa |
| `YOLO_BRIDGE_URL` | — | Địa chỉ bridge phía **máy chủ** (mặc định `http://127.0.0.1:4001`) cho `announce()` và agent; chỉ cần đặt khi bridge không cùng máy với dashboard |
| `TELEGRAM_ENCRYPT_KEY` | ✅ | Mã hoá bot token Telegram **và** access token Zalo OA trong DB (32 byte base64) |
| `WEBHOOK_SECRET` | bắt buộc nếu dùng kênh webhook | Ký body JSON (HMAC-SHA256) gửi ở header `X-SafeSight-Signature`; thiếu thì kênh webhook bỏ qua, không gửi bản chưa ký |
| `PUBLIC_BASE_URL` | tuỳ chọn | URL công khai của dashboard; có thì Zalo gửi kèm ảnh snapshot và webhook nhận `snapshotUrl` tuyệt đối, không có thì Zalo chỉ gửi chữ |
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
| `dashboard` | `ghcr.io/nguyenbaquyen075/safesight-instructions/dashboard` | 3000 | Next.js standalone; SQLite tại bind mount `./data` → `/app/data/dev.db`, lần đầu chạy tự chép DB đã seed |
| `bridge` | `ghcr.io/nguyenbaquyen075/safesight-instructions/bridge` | 4001 | `ai-engine/yolo_bridge.js` + express + socket.io |

```bash
cp .env.docker.example .env   # secret cho dashboard + bridge
mkdir -p data public/snapshots   # tạo trước để không bị Docker tạo bằng quyền root
export UID GID                # uid:gid của anh — dashboard container chạy bằng uid này (xem dưới)
docker compose up -d          # hoặc: docker compose up -d --build
```

AI engine và agent không đóng gói (cần model `.pt`, webcam/GPU, `ANTHROPIC_API_KEY`); chạy ngoài container bằng `npm run dev:yolo` / `npm run dev:agent` và trỏ về địa chỉ máy Docker. `public/videos` được mount chỉ đọc để dashboard phát video mẫu.

`./data` và `./public/snapshots` dùng **bind mount** (không phải named volume) vì AI engine/agent chạy
trên host cần thấy ĐÚNG file mà dashboard container ghi: engine mở thẳng `dev.db` (readonly) để lấy danh
sách camera, và ghi ảnh chụp vi phạm vào `public/snapshots` mà dashboard phục vụ qua API. Khi trỏ host
engine/agent vào Docker, set `DATABASE_URL=file:./data/dev.db` (khớp thư mục bind mount) thay vì
`file:./dev.db` như dev thường.

Bridge giờ cũng đọc `AI_ENGINE_SECRET` (qua `env_file: .env`) và **bắt buộc** header
`x-ai-engine-secret` khớp secret đó trên `POST /detections` — trước đây endpoint này không xác thực nên
publish cổng 4001 ra ngoài là mở cửa cho ai cũng bơm detection giả. Nếu chưa cấu hình secret, bridge vẫn
chạy (chỉ log cảnh báo) để dev cục bộ không bị chặn. AI engine (`env_local.py`) và `mock_yolo.js` đọc
secret theo cùng thứ tự `.env.local` rồi `.env` như bridge, để cả ba luôn khớp cấu hình.

`docker-compose.yml` chạy service `dashboard` bằng `user: "${UID:-1000}:${GID:-1000}"` thay vì user
`app` đóng cứng trong image — ảnh Alpine tạo user `app` với uid riêng của nó, không khớp uid chủ
`./data`/`./public/snapshots` trên host, nên nếu không override, container không ghi được `dev.db`
(crash) hoặc ghi bằng uid khác uid của AI engine/agent chạy trên host (host không đọc/ghi lại được).
`export UID GID` trước khi `docker compose up` (`docker compose` chỉ thay biến có trong
environment/`.env`, không tự đọc uid hệ thống); có thể ghi cố định `UID=`/`GID=` vào `.env` thay vì
export mỗi lần. Không override (`user:` mặc định `1000:1000`, hoặc bỏ dòng `user:` để dùng `USER app`
sẵn trong image) vẫn chạy được vì `/app/data` và `/app/public/snapshots` trong image đã `chmod 777`.

**Nâng cấp từ bản dùng named volume:** nếu deployment cũ dùng volume `safesight-data` (trước khi đổi
sang bind mount ở trên), chép dữ liệu sang `./data` rồi mới `docker compose up -d`:

```bash
docker volume ls | grep safesight-data   # tìm đúng tên volume (có tiền tố tên project compose)
mkdir -p data
docker run --rm -v <tên-volume-ở-trên>:/from -v "$PWD/data":/to alpine cp -a /from/. /to/
```

## Chuyển sang PostgreSQL

SQLite đủ cho dev và cho một máy chủ nhỏ, nhưng chỉ cho **một tiến trình ghi tại một thời điểm**. Nhiều worker agent, nhiều bản dashboard sau load balancer thì phải dùng PostgreSQL.

Prisma 7 nhúng query compiler theo provider **lúc `prisma generate`**, nên một bản Prisma Client chỉ nói được một loại DB. Vì vậy thứ tự các bước dưới đây quan trọng: **chép dữ liệu xong rồi mới đổi client**.

```bash
# 0. Bật Postgres (compose profile "pg"); .env cần POSTGRES_PASSWORD và DATABASE_URL
docker compose --profile pg up -d postgres

# 1. Tạo bảng bên Postgres (không đụng tới client đang có)
POSTGRES_URL='postgresql://safesight:<mat_khau>@127.0.0.1:5432/safesight'
DATABASE_URL="$POSTGRES_URL" npm run db:pg:push

# 2. Chép dữ liệu SQLite -> Postgres (script vẫn dùng client SQLite hiện tại, nên phải chạy TRƯỚC bước 3)
SQLITE_URL=file:./data/dev.db POSTGRES_URL="$POSTGRES_URL" npm run db:pg:migrate-data

# 3. Đổi Prisma Client sang bản Postgres (quay lại dev SQLite: chạy `npx prisma generate`)
npm run db:pg:generate
```

`scripts/sqlite-to-postgres.mjs` chép **16 bảng theo đúng thứ tự khoá ngoại** (`Organization` → `Site` → `Camera` → `Zone` → `Violation` → `ObservationStat` → `User` → `AlertRule` → `Alert` → `AuditLog` → `TelegramSettings` → `ZaloSettings` → `AgentTask` → `AgentEvent` → `AgentSettings` → `CameraAgent`), từng lô 500 dòng, mọi `INSERT` đều `ON CONFLICT DO NOTHING` nên chạy lại không nhân đôi dữ liệu.

Với Docker, `.env` cần thêm (xem `.env.docker.example`):

```bash
DATABASE_URL=postgresql://safesight:<mat_khau>@postgres:5432/safesight
POSTGRES_PASSWORD=<mat_khau>
PRISMA_SCHEMA=prisma/postgres/schema.prisma       # build arg: sinh client bản Postgres
BUILD_DATABASE_URL=postgresql://build/build       # URL giả, chỉ để `next build` chọn đúng adapter
```

rồi **dựng lại image** (`docker compose build dashboard`) vì client Postgres phải được sinh trong image, và chạy `docker compose --profile pg up -d`. Service `postgres` (image `postgres:16-alpine`, volume `pgdata`) chỉ mở cổng ra `127.0.0.1:5432` để AI engine và agent chạy ngoài container vẫn nối được. Không bật profile thì toàn bộ ngăn xếp chạy SQLite y như trước.

### ⚠️ AI engine VẪN CẦN một `DATABASE_URL` dạng `file:` (SQLite)

Chỉ **dashboard, seed và agent** chọn adapter theo lược đồ của `DATABASE_URL`. `ai-engine/yolo_inference.py` đọc THẲNG file SQLite (`_open_db_readonly`) vì nó khởi động trước khi Next.js sẵn sàng, và **chưa có bản đọc PostgreSQL**. Đưa cho engine một `DATABASE_URL=postgresql://…` thì nó in một dòng cảnh báo lúc khởi động rồi chạy tiếp ở chế độ suy giảm:

- **Vùng nhận diện (Zone/ROI) tắt** — engine xét cả khung hình, dù trên web vẫn vẽ và lưu được vùng.
- **Camera thật (webcam/RTSP/`video:`) không được mở** — chỉ còn các camera demo trong `src/data/camera-videos.json`.
- **Camera demo đã xoá trên web vẫn chạy lại** (mất bộ lọc theo bảng `Camera`).
- Kéo theo: mẫu số "người × giây" của tỉ lệ tuân thủ đếm cả người ngoài vùng làm việc, nên số tuân thủ trên `/reports` và KPI bảng điều khiển **sai**, không phải chỉ thiếu.

Vì vậy khi bật profile `pg`: cho dashboard/agent dùng URL Postgres, còn **tiến trình engine phải chạy với `DATABASE_URL=file:./data/dev.db`** (đúng file SQLite mà web đang dùng) — nghĩa là chỉ nên bật Postgres khi đã chấp nhận engine đứng ngoài, hoặc chờ bản đọc PostgreSQL cho engine (xem `docs/github/issues/postgres-multi-worker.md`, mục tồn đọng).

Chưa nghiệm thu trên PostgreSQL thật: máy phát triển hiện không có Postgres, nên phần này mới chỉ được kiểm bằng đọc lại mã và test SQLite.

## Nhiều worker agent

Có thể chạy nhiều tiến trình `agent/main.ts` (mỗi tiến trình một `AGENT_PORT` khác nhau). Điều kiện: DB phải là PostgreSQL — xem mục "Nhiều worker" trong [09 — Agent](09-agent.md#nhiều-worker).

## Lưu ý Prisma 7.10 với trợ lý AI

Từ Prisma CLI 7.10, `prisma db push --accept-data-loss` (nằm trong `npm run test:agent`, chạy trên file tạm `agent-test.db`) từ chối chạy khi phát hiện được gọi bởi Claude Code và yêu cầu người vận hành đồng ý rõ ràng; phiên AI phải đặt biến `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` đúng nội dung câu đồng ý. Chạy tay trong terminal hoặc trên CI không bị ảnh hưởng.

## Các lệnh npm

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy cả 4 tiến trình |
| `npm run dev:web` / `dev:bridge` / `dev:yolo` / `dev:agent` | Chạy riêng từng tiến trình |
| `npm run test:agent` | Test agent (`node --test agent/test/*.test.ts`) trên SQLite tạm |
| `npm run db:seed` | Seed org/site/camera (`prisma/seed.mjs`) |
| `npm run db:pg:push` | Tạo bảng trên PostgreSQL (`prisma/postgres/schema.prisma`) |
| `npm run db:pg:migrate-data` | Chép dữ liệu SQLite → PostgreSQL (`SQLITE_URL`, `POSTGRES_URL`) |
| `npm run db:pg:generate` | Sinh Prisma Client bản PostgreSQL (**thay** client SQLite đang có) |
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
