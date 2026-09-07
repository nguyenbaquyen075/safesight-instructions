# SRS — Đặc tả yêu cầu phần mềm (Software Requirements Specification)

> SafeSight v0.6.0 — cập nhật 2026-09-07 theo mã nguồn `main`. Thay thế `SPEC.md`. Tài liệu này là điểm vào; chi tiết từng phần nằm ở 15 sản phẩm BA và wiki kỹ thuật.

## 1. Giới thiệu

### 1.1 Mục đích
Đặc tả đầy đủ yêu cầu chức năng, giao diện, dữ liệu và phi chức năng của SafeSight để đội phát triển, kiểm thử và bên liên quan dùng chung một nguồn.

### 1.2 Phạm vi sản phẩm
Hệ thống giám sát vi phạm PPE trên công trường: AI Engine (Python / YOLOv8) → YOLO Bridge (Socket.IO) → Dashboard (Next.js) → cơ sở dữ liệu (Prisma), cộng Agent giám sát tự động và kênh cảnh báo Telegram / loa công trường. Phạm vi kinh doanh ở [BRD.md](BRD.md).

### 1.3 Định nghĩa
| Thuật ngữ | Nghĩa |
|---|---|
| PPE | Trang bị bảo hộ cá nhân: mũ, áo phản quang, găng, giày (bắt buộc), kính (chưa bắt buộc) |
| Vi phạm | Bản ghi `Violation` khi một người thiếu PPE bắt buộc liên tục ≥ 3s |
| Chốt vi phạm | Thời điểm AI Engine ghi vi phạm sau khi đủ điều kiện |
| Band | Mức tin cậy phán quyết của agent: VERIFIED / PROBABLE / POSSIBLE |
| Lane | Hai nhánh xử lý của agent: trực tiếp (tất định) và nghiên cứu (Claude) |
| Kill switch | Công tắc `AgentSettings.isEnabled`; tắt thì agent chỉ ghi nhận |

### 1.4 Tài liệu liên quan
[URD](URD.md) · [BRD](BRD.md) · [HDSD](HDSD.md) · 15 sản phẩm BA ([mục lục](README.md)) · Wiki kỹ thuật ([kiến trúc](../../wiki/02-kien-truc-he-thong.md), [dữ liệu](../../wiki/04-mo-hinh-du-lieu.md), [API](../../wiki/05-giao-dien-va-api.md), [YOLO](../../wiki/06-tich-hop-yolo.md), [agent](../../wiki/09-agent.md)) · Spec thiết kế đã duyệt (`docs/superpowers/specs/`) · `DESIGN.md`.

## 2. Mô tả tổng quan

### 2.1 Bối cảnh hệ thống
Bốn tiến trình chạy trên một máy tại công trường (`npm run dev`) hoặc Dashboard + Bridge trong Docker: AI Engine (Python), YOLO Bridge (Node, 4001), Dashboard + API (Next.js, 3000), Agent (Node, 4002 nội bộ). Dữ liệu SQLite (dev) / PostgreSQL (production, đã chuẩn bị adapter). Kênh ngoài: Telegram Bot API, Anthropic API (agent), Roboflow (đối chiếu ảnh tĩnh).

### 2.2 Chức năng chính
Xem [04-function-list.md](04-function-list.md). Nhóm: Xác thực · Trang chủ · Công trường · Camera · AI Engine · Vi phạm · Thông báo / Cảnh báo (Telegram, loa) · Phân tích · Agent · Kiểm thử Roboflow · Người dùng · Thiết lập.

### 2.3 Người dùng
5 vai trò + 2 tác nhân hệ thống, quyền ở [05-permission-matrix.md](05-permission-matrix.md); đặc điểm ở [URD](URD.md) và [06-ux-criteria.md](06-ux-criteria.md).

### 2.4 Ràng buộc
- Định danh code và commit tiếng Anh; giao diện, tài liệu tiếng Việt (`AGENTS.md`).
- Inference trực tiếp chỉ dùng model local; Roboflow chỉ cho ảnh tĩnh.
- File model `.pt` không nằm trong repo; `ppe_multiclass.pt` bắt buộc, 3 file phụ có đường lui.
- Biến môi trường bắt buộc: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_YOLO_SERVER_URL`, `AI_ENGINE_SECRET`, `TELEGRAM_ENCRYPT_KEY`, `AGENT_BRIDGE_SECRET`; tuỳ chọn `ANTHROPIC_API_KEY`, `ROBOFLOW_API_KEY`, `SNAPSHOT_MAX_MB`.

### 2.5 Giả định và phụ thuộc
Camera có nguồn RTSP / webcam ổn định; máy có CPU đủ ≥ 3 fps; có mạng ra Telegram / Anthropic khi dùng các chức năng đó.

## 3. Yêu cầu chức năng

Mỗi chức năng truy vết tới use case, user story và màn hình. Chi tiết luồng ở [10-activity-diagrams.md](10-activity-diagrams.md), quy tắc nghiệp vụ ở [11-use-case-specs.md](11-use-case-specs.md).

| Nhóm | Chức năng (trace) | Use case | User story | Màn hình |
|---|---|---|---|---|
| Xác thực | F-AUTH-01, 02, 05 | UC-23 | US-16 | SCR-01 |
| Trang chủ | F-DASH-01, 02 | UC-27 | US-20 | SCR-02 |
| Camera | F-CAM-01..06 | UC-01, 13, 14, 25 | US-01, 09, 10 | SCR-03, SCR-13 |
| AI Engine | F-AI-01..04, 06 | UC-06 | US-02, 03 | — |
| Vi phạm | F-VIO-01..05 | UC-02, 03 | US-05 | SCR-05, SCR-06 |
| Cảnh báo | F-ALR-01, 02; F-RULE-01, 02; F-TG-01..03 | UC-05, 08, 10, 11, 12 | US-06, 07, 08 | SCR-07, SCR-14, SCR-15 |
| Cảnh báo giọng nói | F-VOICE-01, 02 | UC-04 | US-04 | SCR-03, SCR-04, SCR-06 |
| Phân tích | F-AN-01, 02 | UC-27 | US-15 | SCR-09 |
| Agent | F-AGENT-01..07 | UC-07, 09, 16..22 | US-11..14 | SCR-06, SCR-10 |
| Kiểm thử Roboflow | F-RF-01 | UC-15 | — | SCR-11 |
| Người dùng | F-USER-01..03 | UC-26 | — | SCR-12 |
| Thiết lập | F-SET-01 | — | — | SCR-16 |
| Backlog | F-AUTH-03, 04; F-AI-05; F-RPT-01; F-USER-04; F-PROF-01; F-AUD-01; F-TG-04; F-SET-02 | — | US-17..20 | — |

### 3.1 Quy tắc nghiệp vụ cốt lõi (tóm tắt)
1. Chốt vi phạm: conf ≥ 0.6, thiếu liên tục ≥ 3s, 1 vi phạm / người theo món nặng nhất (mũ > áo > găng, giày); báo lại mỗi 60s.
2. Cảnh báo Telegram: theo `AlertRule` (loại, ngưỡng, cooldown, chat_id); lần 1 nhắc nhở, từ lần 2 leo thang.
3. Agent: chỉ VERIFIED mới tự đổi trạng thái / leo thang; kill switch, `LIMITS`, trần token; mọi hành động ghi `AgentEvent`.
4. Phân quyền: trang theo `PAGE_ROLES`; quy tắc cảnh báo theo site gán.

## 4. Yêu cầu giao diện

- Giao diện người dùng: sitemap [08-sitemap.md](08-sitemap.md), mô tả màn hình [07-screen-specs.md](07-screen-specs.md), token thiết kế `DESIGN.md`, tiêu chí UX [06-ux-criteria.md](06-ux-criteria.md).
- Giao diện phần cứng: webcam (`webcam:N`), camera IP RTSP, micro và loa trình duyệt (MediaRecorder / audio autoplay sau một chạm).
- Giao diện phần mềm: Telegram Bot API (`getMe`, `sendMessage`, `sendPhoto`), Anthropic Messages API (tool runner), Roboflow Serverless Workflow (REST), Socket.IO giữa engine ↔ bridge ↔ trình duyệt, HTTP nội bộ Next ↔ Agent (4002, `AGENT_BRIDGE_SECRET`).
- Giao diện API: 19 route trong [wiki/05](../../wiki/05-giao-dien-va-api.md); `POST /api/violations` là hợp đồng với AI Engine (JSON: cameraId, type, severity, confidence, bboxData, snapshot, occurrenceCount).

## 5. Yêu cầu dữ liệu

Mô hình `Organization → Site → Camera → Zone → Violation → Alert`, `AlertRule`, `User`, `AuditLog`, `TelegramSettings`, `AgentTask`, `AgentEvent`, `AgentSettings` (chi tiết [wiki/04](../../wiki/04-mo-hinh-du-lieu.md)). Trạng thái và chuyển trạng thái ở [03-state-diagrams.md](03-state-diagrams.md). Dữ liệu tự sinh: `snapshotUrl`, `bboxData`, `agentReview` không sửa tay. Lưu trữ: SQLite file; snapshot trong `public/snapshots/` có trần dung lượng.

## 6. Yêu cầu phi chức năng

Xem [14-nfr.md](14-nfr.md): bảo mật (NFR-01..10), hiệu suất (NFR-11..16), khác (NFR-17..24).

## 7. Truy vết và kiểm thử

- Mỗi user story có AC when / who / how / then → kịch bản UAT ([13-user-stories.md](13-user-stories.md)).
- Kiểm thử tự động: `npm run test:agent` (45 test), CI lint / types / tests / Docker build.
- Nghiệm thu AI: `eval_ppe_decision.py` (báo oan ≤ 1%, bỏ sót ≤ 2%) và `sweep_threshold.py` trước khi thay model.
- UAT cuối sprint theo [15-implementation-rules.md](15-implementation-rules.md).

## 8. Lịch sử phiên bản tài liệu

| Ngày | Phiên bản | Thay đổi |
|---|---|---|
| 2026-04-27 | SPEC.md bản đầu | UI 9/11 trang, API mock, YOLO chưa tích hợp |
| 2026-09-07 | SPEC.md chuẩn hoá | DB thật, AI end-to-end, Telegram, camera thật, voice alert, Roboflow, agent |
| 2026-09-07 | SRS v1 (tài liệu này) | Thay SPEC.md bằng bộ BA 15 sản phẩm + SRS / URD / BRD / HDSD |
