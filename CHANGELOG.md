# Changelog

Mọi thay đổi đáng chú ý của dự án được ghi tại đây. Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [Semantic Versioning](https://semver.org/lang/vi/). Mỗi phiên bản tương ứng một tag `vX.Y.Z` và một GitHub Release.

## [Unreleased]

### Thêm
- README mới theo chuẩn dự án mã nguồn mở: logo, badge, mục tính năng, tài liệu, đóng góp.
- `Dockerfile` hai target (`dashboard`, `bridge`), `docker-compose.yml`, `.env.docker.example`; workflow Docker build và đẩy image lên GHCR.
- Workflow CI (lint, types, test agent) và workflow deploy landing page lên GitHub Pages (`landing-page/`).
- `CONTRIBUTING.md`, logo `wiki/assets/safesight-logo.svg`, script `scripts/github-repo-metadata.sh` đặt description/topics cho repo.

- Bộ tài liệu BA `docs/ba/` (15 sản phẩm phân tích nghiệp vụ + SRS, URD, BRD, HDSD, biên bản họp).
- Test agent lấp khoảng trống: `agent/test/usage.test.ts` (`dailyTokensUsed`), `escalate.test.ts` (`makeEscalate`), `agent-bridge.test.ts` (`enqueueAgentTask` gộp/không gộp task), `violation-status.test.ts` (bất biến status viết HOA khi PATCH).

### Thay đổi
- `next.config.ts` bật `output: "standalone"` để đóng gói Docker.

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
