# Chín tính năng lộ trình v0.9 — thiết kế

Ngày 2026-09-08. Nền: v0.8.0. Mỗi tính năng = một issue GitHub + một nhánh `feat/<slug>` + một PR. Ràng buộc chung: không thêm dependency trừ khi nêu rõ; định danh/commit tiếng Anh, UI/tài liệu tiếng Việt; tài liệu (wiki, README, docs/ba, CHANGELOG) cùng commit; không chạy app trên máy vận hành (kiểm bằng test/tsc/eslint; UI kiểm sau).

## F1 — Vùng nhận diện (Zone/ROI) theo camera — `feat/zone-roi`
- Dùng model `Zone` sẵn có (`polygonData` = JSON `[{x,y}]` tỉ lệ 0–1 theo khung, `type`: `MONITORING` = vùng làm việc (chỉ xét người trong vùng), `RESTRICTED`/`WARNING` giữ nguyên ý nghĩa, chưa dùng).
- Engine: `ai-engine/yolo_inference.py` đọc `Zone` (isActive, type MONITORING) của camera lúc khởi động và mỗi 60s (cùng cơ chế đọc `Camera`); `ppe_tracker.process_frame(frame, zones=...)`: người có điểm chân (giữa cạnh dưới bbox) ngoài mọi vùng MONITORING → bỏ qua PPE và không tính người quan sát. Không có vùng → cả khung. Thuật toán point-in-polygon thuần Python (ray casting), có test `ai-engine/test_zones.py` chạy bằng `python3 -m unittest` (không cần torch: tách hàm vào `ai-engine/zones.py`).
- Engine ghi ảnh xem trước `public/snapshots/preview_<cameraId>.jpg` mỗi 30s (JPEG 640px) để trình vẽ vùng có nền.
- API: `GET/PUT /api/cameras/[id]/zones` (PUT thay toàn bộ danh sách vùng MONITORING của camera; zod: 3–20 điểm, 0–1). Quyền: `assertSiteAccess`.
- UI: trong `CameraEditDialog` (hoặc `CameraMonitoringCard`) mục "Vùng nhận diện": canvas vẽ đa giác trên `preview_<id>.jpg` (click thêm điểm, kéo điểm, xoá điểm, nhiều vùng), nút Lưu. Không dependency.
- Docs: wiki/06 (pipeline: lọc vùng), wiki/05 (route), docs/ba F-AI-05 → v0.9, UC mới không cần (bounded), SCR-13 thêm mục.

## F2 — Giao diện di động + PWA — `feat/mobile-pwa`
- Sidebar: dưới `md` thành drawer (ẩn mặc định, nút hamburger ở Header, overlay đóng, đóng khi đổi route); layout bỏ `ml-[260px]` dưới `md`. Header sticky.
- Bảng vi phạm/cảnh báo/người dùng: dưới `md` hiển thị dạng thẻ (component `ResponsiveTable` không cần — dùng `hidden md:table` + danh sách thẻ).
- PWA: `public/manifest.webmanifest` (tên, icon từ `wiki/assets/safesight-logo.svg` xuất PNG 192/512 bằng sharp tại build? Không: commit sẵn 2 PNG tạo bằng `sharp` script một lần `scripts/make-icons.mjs`), `<link rel=manifest>` + `theme-color` trong `layout.tsx`, `public/sw.js` cache shell tối thiểu (network-first, không cache API), đăng ký trong `Providers.tsx` chỉ ở production. Không push notification (issue riêng).
- Docs: DESIGN.md (breakpoints, drawer), wiki/05, docs/ba/06 (bỏ mục "Sidebar chưa responsive"), NFR-19.

## F3 — Clip bằng chứng — `feat/evidence-clips`
- Engine: ring buffer 20 khung/camera (≈5s); khi chốt vi phạm ghi `public/snapshots/clip_<violationKey>.mp4` (cv2.VideoWriter mp4v, 4 fps) gồm 20 khung trước + 12 khung sau (thu thập trong các vòng lặp kế tiếp, ghi xong thì đóng). Không chặn vòng lặp (ghi từng khung khi có).
- Schema: `Violation.clipUrl String?`. API POST vi phạm nhận `clipUrl` tùy chọn; DTO trả về; `snapshot.cleanup` xoá clip cùng luật với ảnh.
- UI: `ViolationDetailModal` tab Bằng chứng có `<video controls>` khi có clip, fallback ảnh.
- Agent: `read_violation` trả thêm `clipUrl` và câu nhắc "có clip, người dùng xem được"; không đọc clip (chưa có ffmpeg).
- Docs: wiki/04, wiki/06, wiki/05, SCR-06, F-AI-03.

## F4 — Trang Báo cáo + báo cáo tuần của agent — `feat/reports`
- `/reports` (SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER): bộ lọc công trường/camera/khoảng ngày (mặc định 7 ngày), bảng tổng hợp theo camera (tổng, thật, báo oan, mở), bảng chi tiết; nút "Xuất CSV" (client tạo Blob từ dữ liệu API), "In / PDF" (`window.print()` + CSS `@media print`). API `GET /api/reports/violations?siteId&cameraId&from&to` (scope site).
- Agent: kind mới `weekly.report` (research), `AgentSettings.weeklyReportAt` (`"MON 08:00"` → cron đơn giản: thứ + giờ), preamble riêng, gửi Telegram qua `escalate` không violationId và ghi `AgentEvent report`; `/reports` hiện báo cáo tuần gần nhất (markdown → đoạn văn).
- Docs: wiki/05, wiki/09, F-RPT-01 → v0.9, US-17 ✅, SCR mới SCR-17, sitemap.

## F5 — Kênh Zalo OA và Webhook — `feat/alert-channels`
- `AlertChannel.ZALO`, `AlertChannel.WEBHOOK` đã có trong enum; nối thật.
- Zalo: `ZaloSettings` (1 dòng, `accessTokenEncrypted` AES-256-GCM như Telegram, `isEnabled`), `src/lib/zalo.ts` (`sendText`, `sendImage` qua `POST https://openapi.zalo.me/v3.0/oa/message/cs` header `access_token`), recipients = Zalo user id; card cài đặt "Zalo OA" cạnh Telegram; test kết nối `GET https://openapi.zalo.me/v2.0/oa/getoa`.
- Webhook: recipient = URL https; `POST` JSON `{ event: 'violation', violation, camera, site, snapshotUrl }` với header `X-SafeSight-Signature` (HMAC-SHA256 của body bằng `WEBHOOK_SECRET`).
- `alert-notifier.ts` tách theo kênh (`channels/telegram.ts`, `zalo.ts`, `webhook.ts` với interface `AlertSender { send(rule, violation, camera, recipient): Promise<{ ok, error? }> }`); `Alert.channel` ghi đúng kênh.
- Docs: wiki/05, README env, `.env.docker.example`, F-TG-04 → v0.9, SCR-14/15.

## F6 — Tỉ lệ tuân thủ từ số người quan sát — `feat/compliance-observations`
- Engine: mỗi camera đếm `personSeconds` (số người trong vùng × giây) và `frames` theo phút; mỗi 60s `POST /api/observations` (secret engine) mảng `{ cameraId, minute (ISO phút), persons, personSeconds }`.
- Schema: `ObservationStat { id, cameraId, siteId, minute DateTime, persons Int, personSeconds Int, @@unique([cameraId, minute]) }` (upsert).
- API: `GET /api/stats/compliance?siteId&from&to` → theo ngày: `{ day, personMinutes, violations, complianceRate }` với `complianceRate = 1 − violations / max(personMinutes, 1)` (giới hạn 0–1). `use-dashboard.ts` dùng API này thay `rateFromCount`; giữ fallback khi chưa có dữ liệu ("chưa đủ dữ liệu quan sát").
- Docs: wiki/04, wiki/05, wiki/06, NFR mới, F-DASH-01.

## F7 — Bản đồ nhiệt vi phạm — `feat/violation-heatmap`
- `/analytics`: (a) lưới giờ × thứ (7×24) từ vi phạm trong khoảng lọc, tô màu theo `--danger` alpha; (b) chọn camera → heatmap vị trí: canvas vẽ `preview_<id>.jpg` (F1) hoặc nền xám, chấm mờ tại tâm bbox từng vi phạm (bbox đã có trong `bboxData`, tỉ lệ % → toạ độ). Thuần client, dùng `useViolations`.
- Docs: wiki/05, SCR-09, F-AN-03.

## F8 — Quản trị người dùng và nhật ký — `feat/admin-completion`
- `POST /api/users` (org-wide): tạo user với mật khẩu (bcrypt), vai trò, site gán; dialog "Thêm người dùng" trên `/users`.
- `/profile`: đổi mật khẩu (`PATCH /api/users/me/password` với mật khẩu cũ + mới ≥ 8), thông tin cá nhân; menu vào từ avatar Header.
- Quên mật khẩu: không làm (cần email) → ghi backlog.
- `AuditLog`: helper `src/lib/audit-log.ts` `logAudit(session, action, resource, resourceId, details, request)` gọi trong POST/PATCH/DELETE users, cameras, alert-rules, telegram/zalo settings, agent settings; tab "Nhật ký" trong `/settings` (org-wide) đọc `GET /api/audit-log?limit&resource`.
- Docs: wiki/05, F-USER-04, F-AUTH-03, F-AUD-01 → v0.9, US-18 ✅, SCR mới, ma trận quyền.

## F9 — PostgreSQL và nhiều worker — `feat/postgres-multi-worker`
- Prisma 7 với driver adapter: schema gốc giữ `sqlite`; thêm `prisma/postgres/schema.prisma` (provider `postgresql`, cùng model) và script `db:pg:generate`/`db:pg:push`; `src/lib/prisma.ts` chọn `PrismaPg` khi `DATABASE_URL` bắt đầu `postgres`, `PrismaLibSqlWal` khi `file:`. Tài liệu chuyển đổi (`wiki/03`, docker-compose có service `postgres` tuỳ chọn dưới profile `pg`).
- Multi-worker: `AgentTask.claimDue` đã dùng lease atomic; `rememberCamera` chuyển sang `updateMany` có điều kiện `updatedAt` cũ (optimistic) + retry 1 lần; `AGENT_WORKER_ID` ghi vào `session.started`; `LIMITS`/`rateLimit` ghi rõ là per-worker.
- Không kiểm được Postgres trên máy này → PR ghi rõ cần môi trường Postgres để nghiệm thu; test SQLite phải xanh.
