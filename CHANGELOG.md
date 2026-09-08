# Changelog

Mọi thay đổi đáng chú ý của dự án được ghi tại đây. Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [Semantic Versioning](https://semver.org/lang/vi/). Mỗi phiên bản tương ứng một tag `vX.Y.Z` và một GitHub Release.

## [Unreleased]

### Thêm
- README mới theo chuẩn dự án mã nguồn mở: logo, badge, mục tính năng, tài liệu, đóng góp.
- `Dockerfile` hai target (`dashboard`, `bridge`), `docker-compose.yml`, `.env.docker.example`; workflow Docker build và đẩy image lên GHCR.
- Workflow CI (lint, types, test agent) và workflow deploy landing page lên GitHub Pages (`landing-page/`).
- `CONTRIBUTING.md`, logo `wiki/assets/safesight-logo.svg`, script `scripts/github-repo-metadata.sh` đặt description/topics cho repo.
- Bộ tài liệu BA `docs/ba/` (15 sản phẩm phân tích nghiệp vụ + SRS, URD, BRD, HDSD, biên bản họp), sơ đồ Excalidraw.
- Báo cáo review `docs/review/` (health, change) và kế hoạch nhánh fix.
- Lane nghiên cứu của agent chạy được trên endpoint tương thích OpenAI (`LLM_PROVIDER=openai`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_DEFAULT`, `LLM_IMAGE_INPUT`); trang `/agent` hiển thị đúng model đang dùng.
- Test agent 45 → 66: hạn mức token ngày (`usage`), tool `escalate`, gộp task `enqueueAgentTask`, trạng thái vi phạm chữ hoa, PRAGMA SQLite, client OpenAI, kiểm danh tính pid, probe/sweep, cleanup.

### Thay đổi
- Dependency: `next` 16.3.4, `next-auth` 5.0.0-beta.32, `@auth/prisma-adapter` 2.11.3 (vá `@auth/core` homoglyph/fail-open), `sharp` 0.35.4, `prisma`/`@prisma/client` 7.10.0, `npm audit fix` cho engine.io/hono/js-yaml/brace-expansion/browserslist: 27 advisory → 4 (chỉ còn chuỗi `@prisma/config`/`mysql2`/`deepmerge-ts` đòi hạ Prisma về 6.x, bỏ qua).
- `next.config.ts` bật `output: "standalone"` để đóng gói Docker.
- API vi phạm trả thêm `occurrenceCount`; mapping DTO gom về `src/lib/violation-shape.ts`; bỏ độ trễ giả 800ms ở `GET /api/violations`.
- Badge "Thông báo" ở Sidebar đếm vi phạm `open` từ DB thay vì `localStorage` + hằng 11; trang Công trường không ghi thông báo vào `safesight_alerts` nữa.
- `docker-compose.yml` dùng bind mount `./data` và `./public/snapshots` để AI engine và agent chạy trên máy chủ dùng chung DB/ảnh với container.
- `snapshot.cleanup` chỉ giữ ảnh mới hơn 24h (bỏ luật 30 ngày không bao giờ khớp vì engine xoá ảnh mỗi lần khởi động).

### Sửa
- API đọc dữ liệu không còn mở cho mọi người trong mạng: `GET /api/violations`, `/api/violations/[id]`, `/api/cameras`, `/api/cameras/[id]`, `/api/sites`, `/api/sites/[id]`, `/api/users` nay bắt buộc session (401) — middleware `src/proxy.ts` không chạy trên `/api` nên từng route tự kiểm bằng `requireSession()`. `POST /api/violations` giữ nguyên xác thực `X-AI-Engine-Secret` cho AI engine.
- Danh sách vi phạm/camera/công trường lọc theo công trường được giao (`allowedSiteIds()` đọc `User.assignedSites`); xin `?siteId=` ngoài phạm vi trả 403; chi tiết vi phạm/camera/công trường kiểm `assertSiteAccess`; `/api/users` chỉ SUPER_ADMIN/ORG_ADMIN, khớp `PAGE_ROLES['/users']`.
- `GET /api/violations` lọc bằng SQL (`buildViolationWhere`) thay vì tải cả bảng rồi lọc bằng JS, và chỉ `select` tên camera/công trường; badge Sidebar dùng endpoint mới `GET /api/violations/count` (`useOpenViolationCount`) nên mỗi 15s chỉ chạy một COUNT thay vì tải toàn bộ vi phạm kèm 2 join.
- Ghi Violation/Alert không còn văng `P1008 SocketTimeout` khi nhiều camera cùng báo vi phạm: `src/lib/prisma.ts` đặt `PRAGMA busy_timeout=5000` + `journal_mode=WAL` khi mở SQLite (tái hiện 8 writer × 30 ghi: 20/240 → 240/240 thành công).
- Lane nghiên cứu không còn hỏng `Cannot read properties of undefined (reading 'filter')` khi key là proxy `/chat/completions`.
- Tài khoản dev cứng `admin@safesight.ai` chỉ còn hoạt động ngoài production (hoặc khi `ALLOW_DEV_LOGIN=true`); trang đăng nhập ẩn gợi ý ở production.
- `POST /detections` của YOLO Bridge yêu cầu header `X-AI-Engine-Secret` khi `AI_ENGINE_SECRET` được đặt; engine gửi kèm header; image bridge có `dotenv`.
- Agent trực vận hành không còn SIGTERM một pid lạ khi engine đã tắt: kiểm `/proc/<pid>/cmdline` chứa `yolo_inference.py`, heartbeat quá 5 phút coi là engine đã mất, pid không hợp lệ không tiêu suất `engine-restart`; `yolo_inference.py` xoá `.heartbeat.json` khi thoát.
- `health.probe` không còn đẩy lùi lịch `health.sweep` định kỳ.
- Chạm trần token trong ngày luôn phát `session.ended (stop: skipped)` để panel hỏi-đáp không treo; event `error` gắn đúng `sessionId` của task; vòng lặp agent thoát ngay khi nhận SIGTERM; `PATCH /api/cameras/[id]` đánh thức agent sau khi ghi task; hỏi tiếp vào task `ask` đã hết lượt thử reset `attempts`.
- JSON hỏng trong `bboxData`/`agentReview` không còn làm 500 danh sách vi phạm; agent so sánh trạng thái không phân biệt hoa/thường với row cũ.
- Badge Sidebar không còn hiện số "0" rời khi không có vi phạm.
- Dashboard container không còn crash-loop khi bind mount `./data`/`./public/snapshots`: chạy bằng `user: "${UID:-1000}:${GID:-1000}"` trong `docker-compose.yml` thay vì uid riêng của user `app` trong image; `/app/data`/`/app/public/snapshots` trong image đã `chmod 777` và `docker-entrypoint.sh` báo lỗi rõ nếu vẫn không ghi được thay vì để `set -e` chết im lặng.
- YOLO engine không còn im lặng bỏ qua khi bridge từ chối detection (401 do `AI_ENGINE_SECRET` lệch): in cảnh báo 1 lần/mã lỗi HTTP thay vì `except: pass`; `env_local.py` đọc thêm `.env` (không chỉ `.env.local`) để engine luôn khớp secret với bridge; `mock_yolo.js` gửi kèm header `X-AI-Engine-Secret` như engine thật.

### Loại bỏ
- `SPEC.md` (thay bằng `docs/ba/SRS.md` và bộ BA).

## [0.6.0] - 2026-09-07

### Thêm
- Agent giám sát tự động (`agent/`): worker Node chạy cùng `dev-all.sh`, hai lane. Lane trực tiếp quét sức khỏe hệ thống mỗi 60s, thăm dò camera theo yêu cầu và dọn snapshot. Lane nghiên cứu giao cho Claude (Anthropic SDK tool runner) các việc: rà soát vi phạm, trả lời câu hỏi, tổng hợp theo camera, báo cáo ca, leo thang sự cố.
- Sổ bằng chứng với ba mức VERIFIED / PROBABLE / POSSIBLE; mọi hành động ghi vào `AgentEvent`; công tắc dừng khẩn, giới hạn tần suất và hạn mức token theo ngày trong `AgentSettings`.
- Trang `/agent` (dòng thời gian, cài đặt, hỏi đáp) và panel Agent trong modal vi phạm, camera trực tiếp và công trường. Thêm `DESIGN.md`.
- Endpoint `GET /health` trên YOLO Bridge và heartbeat từ tiến trình Python để agent phát hiện engine treo.
- Tài liệu: spec và plan của agent, `wiki/09-agent.md`, sơ đồ kiến trúc SVG động trong README.

### Thay đổi
- Chuẩn hóa tài liệu, cấu hình và lint toàn dự án; thống nhất dùng npm (bỏ `yarn.lock`).
- Schema Prisma: thêm `AgentTask`, `AgentEvent`, `AgentSettings`, trường `Violation.agentReview`.

## [0.5.0] - 2026-08-28

### Thêm
- Gán video mẫu cho camera ngay trên giao diện (nguồn `video:<tên>`), API liệt kê và tải video lên (tối đa 200MB).
- Model chuyên biệt cho găng (`ppe_gang.pt`) và giày (`ppe_boots.pt`) train từ dữ liệu của dự án; lớp yếu dùng model riêng, các lớp khác vẫn từ model gốc.
- Khung THIẾU GĂNG / THIẾU GIÀY đặt theo điểm khớp cổ tay, cổ chân từ `yolov8n-pose`; sáu khung mỗi người với ba trạng thái có / thiếu / chưa rõ.
- Công cụ nghiệm thu `eval_ppe_decision.py` (chấm theo tỉ lệ báo oan và bỏ sót) và `sweep_threshold.py`.

### Thay đổi
- Đồng bộ vị trí video giữa trình duyệt và AI (`videoPos`), chạy PPE mỗi 3 khung hình: 2.0 → 3.7 fps.
- Ngưỡng riêng từng lớp, bộ nhớ trạng thái 12s → 2.5s, ngưỡng người 0.15 → 0.45.

### Sửa
- Thiếu model tư thế hoặc model phụ thì cảnh báo và dùng model chính, không dừng hệ thống.

## [0.4.0] - 2026-08-20

### Thêm
- Quản lý camera thật; mọi trang đọc dữ liệu trực tiếp từ DB.
- Phân quyền truy cập trang theo vai trò (RBAC).
- Client Roboflow Workflow để đối chiếu ảnh tĩnh và trang `/roboflow` trong dashboard.
- Tài liệu dataset gộp và quy trình retrain trên Colab (`training/`).

### Thay đổi
- Thiết kế lại giao diện mic loa công trường.
- Tách bộ nạp `.env.local` của AI engine thành `env_local.py`.

### Sửa
- `ppe_tracker`: bỏ khung chân tự bịa, gate găng/giày theo độ tin cậy.

## [0.3.0] - 2026-08-11

### Thêm
- Thông báo vi phạm qua Telegram: mã hóa token AES-256-GCM, `TelegramClient`, quy tắc cảnh báo theo ngưỡng và thời gian chờ, API cài đặt và kiểm tra kết nối, giao diện trong tab Thông báo.
- Quy tắc cảnh báo (`AlertRule`) với CRUD API phân quyền theo công trường.
- Nhãn tiếng Việt cho loại vi phạm; đếm số lần tái diễn của một vi phạm đang tiếp diễn.

### Thay đổi
- Vi phạm kéo dài được báo lại mỗi 60s kèm ảnh mới; Telegram coi lần đầu là nhắc nhở, leo thang từ lần thứ hai.

## [0.2.0] - 2026-08-05

### Thêm
- Cảnh báo bằng giọng nói: nút mic trên camera đang vi phạm, phát lại qua trang loa riêng từng camera, mic trong modal chi tiết vi phạm.
- Bộ lọc chỉ hiện camera đang vi phạm.
- `GET /api/violations` đọc dữ liệu Prisma thật; `POST` yêu cầu shared secret.

### Sửa
- Không mất bản ghi âm khi tự dừng sau 30s hoặc khi trạng thái vi phạm nhấp nháy; mở khóa autoplay trên tablet.

## [0.1.0] - 2026-08-03

### Thêm
- Khởi tạo dự án: Next.js dashboard, Prisma, AI engine YOLOv8 và YOLO Bridge Socket.IO.

[Unreleased]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nguyenbaquyen075/safesight-instructions/releases/tag/v0.1.0
