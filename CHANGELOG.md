# Changelog

Mọi thay đổi đáng chú ý của dự án được ghi tại đây. Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), đánh số theo [Semantic Versioning](https://semver.org/lang/vi/). Mỗi phiên bản tương ứng một tag `vX.Y.Z` và một GitHub Release.

## [Unreleased]

## [0.11.0] - 2026-09-08

### Thêm
- **Loa công trường tự động**: bridge có `POST /announce` (`{ cameraId, text }`, cùng header
  `X-AI-Engine-Secret` như `/detections`) phát sự kiện `voice-announce` vào room `camera-<id>`
  và trả `{ ok, listeners }`. Trang `/site-speaker` đọc câu nhận được bằng `speechSynthesis`
  (`vi-VN`, rate 0.95), có nút "Thử loa", danh sách 10 thông báo gần nhất và cảnh báo khi
  trình duyệt không hỗ trợ Web Speech API. Modal vi phạm thêm nút **"Phát loa"** gọi
  `POST /api/cameras/[id]/announce` (session + `assertSiteAccess`, ghi `AuditLog`
  `camera.announce`); không truyền `text` thì câu được dựng từ loại vi phạm bằng hàm thuần
  `announcementFor()` (`src/lib/announce-shape.ts`, tối đa 200 ký tự). Agent có tool mới
  `announce` cho kind `violation.review`/`followup`/`camera.instruction`/`ask`, chỉ chạy khi
  đã có phán quyết VERIFIED "vi phạm thật" cho camera đó, tối đa 2 lần/phiên và 60 giây/camera.
  Biến mới `YOLO_BRIDGE_URL` (tuỳ chọn) cho địa chỉ bridge phía máy chủ.
- `ai-engine/requirements.txt` ghim phiên bản các gói Python engine dùng trực tiếp (`torch`, `torchvision`, `ultralytics`, `opencv-python`, `numpy`, `requests`) theo `.venv` của operator; README chuyển sang cài bằng `pip install -r ai-engine/requirements.txt`; wiki/03 ghi chú cách chạy `pip-audit` thủ công cho các gói này.
- **Cảnh báo xâm nhập vùng cấm**: vùng `RESTRICTED` / `WARNING` / `SUSPENDED_LOAD` của bảng `Zone` giờ được AI engine dùng thật — người có điểm chân nằm trong vùng liên tục ≥ 3 giây sinh vi phạm `zone_intrusion` (mức `critical` / `high`) hoặc `suspended_load` (`critical`), kèm `zoneId`, ảnh khoanh đỏ (nhãn không dấu `VUNG CAM` / `TAI TREO` vì `cv2.putText` chỉ có font ASCII; nhãn tiếng Việt nằm trong `bboxData[].label`), và báo lại mỗi 60 giây với `occurrenceCount` tăng dần nếu người đó vẫn đứng trong vùng (`intrusions` / `IntrusionTracker` trong `ai-engine/zones.py`, thuần Python nên test không cần torch).
- Vùng nguy hiểm được **hợp vào tập giữ người** của luồng video (`zones_for_stream`), nếu không thì người đứng trong vùng cấm bị lọc mất trước khi engine kịp xét xâm nhập. Thay đổi hành vi kèm theo: với camera có khai vùng làm việc, người **chỉ** đứng trong vùng nguy hiểm nay cũng bị xét PPE và được tính vào `ObservationStat` (mẫu số tỉ lệ tuân thủ).
- **Xử lý vi phạm theo quy trình (CAPA)**: bảng mới `CorrectiveAction` (người xử lý, mô tả, hạn, trạng thái `OPEN`/`DONE`/`CANCELLED`, ghi chú bằng chứng) treo dưới `Violation`. Nút "Lập phiếu phạt" trong modal vi phạm — trước đây chỉ hiện toast, không lưu gì — được thay bằng **"Giao xử lý"**: chọn người (gợi ý từ `GET /api/users`, vẫn gõ tay được cho tổ đội / thầu phụ), mô tả việc, hạn `datetime-local` mặc định +24 h; modal liệt kê việc của vi phạm kèm chip trạng thái, chip đỏ "Quá hạn" và nút "Đã khắc phục" mở ô ghi chú bằng chứng. Route mới `GET/POST /api/violations/[id]/actions`, `PATCH /api/actions/[id]`, `GET /api/actions?siteId&status=open|overdue` (session + `assertSiteAccess`, ghi `AuditLog`); giao việc đưa vi phạm `OPEN` sang `UNDER_REVIEW`, khắc phục xong hết thì vi phạm tự sang `RESOLVED`. Trang `/reports` thêm mục **"Việc khắc phục"** (còn mở / quá hạn theo công trường). Agent có phát hiện mới `capa.overdue`: mỗi vòng quét 60s gộp việc quá hạn chưa từng leo thang thành một task `ops.escalate` (nêu tên tối đa 5 việc) rồi đánh dấu `escalatedAt` để không báo lại; `read_violation` trả thêm `actions[]`, `read_agent_activity` trả `openActions`/`overdueActions`, OPENING của `shift.report`/`weekly.report` nhắc phần này.
- **Phản hồi phán quyết của agent**: cột mới `Violation.reviewFeedback` (JSON `{ correct, note?, userId, at }`). Tab Agent trong modal vi phạm thêm hàng "Phán quyết này đúng không?" với hai nút "Đúng" / "Sai" (chọn "Sai" mở ô ghi chú ≤ 300 ký tự), hiện lại đánh giá cũ kèm TÊN người chấm và thời gian (`userName` trong `reviewFeedback`; dòng cũ không có tên thì ghi "Đã đánh giá lúc …") và cho sửa; route mới `PATCH /api/violations/[id]/feedback` (session + `assertSiteAccess`, 409 khi vi phạm chưa có `agentReview`, ghi `AuditLog` `violation.review.feedback`). Trang `/agent` thêm thẻ **"Độ chính xác của agent"** (7 / 30 ngày, `GET /api/stats/agent-accuracy`: đã phán quyết, có phản hồi, tỉ lệ sai, bảng theo camera và theo loại vi phạm — hàm thuần `agentAccuracy()` trong `src/lib/agent-accuracy-shape.ts`). Trang `/reports` thêm nút **"Xuất phản hồi agent (CSV)"** (`GET /api/reports/agent-feedback`, UTF-8 có BOM, cột `violationId,cameraId,type,detectedAt,snapshotUrl,clipUrl,agentVerdict,band,humanCorrect,note`, tối đa 20.000 dòng mới nhất — chạm trần thì có header `X-Truncated: true` và đuôi tên file `-partial`) làm bộ dữ liệu train lại — cách nạp vào `training/` ghi ở wiki/08. Tool `read_camera_history` trả thêm `agentFeedback: { total, wrong, wrongRate }` của 7 ngày và skill `ppe-review` dặn chọn PROBABLE thay vì VERIFIED khi `wrongRate` ≥ 0.3 với ít nhất 3 phản hồi.
- Trình vẽ vùng (Cài đặt > Giám sát > sửa camera) thêm ô chọn **loại vùng** cho từng vùng và chú giải màu (vùng làm việc xanh, cảnh báo vàng, vùng cấm / dưới tải treo đỏ); `GET/PUT /api/cameras/[id]/zones` đọc và ghi mọi loại vùng (`type` mặc định `MONITORING`, PUT vẫn thay toàn bộ danh sách của camera).

### Sửa
- Vòng sửa sau review v0.11: leo thang việc khắc phục quá hạn dùng khoá gộp riêng
  (`subjectType: 'capa', subjectId: 'overdue'`) nên không còn bị leo thang vận hành
  (`bridge.down`/`engine.stalled`/`model.missing`, khoá `system`) ghi đè mất lý do; tên người
  xử lý trong lý do được cắt còn 40 ký tự, bỏ xuống dòng và ghi rõ "(tên do người dùng nhập)".
  `scripts/sqlite-to-postgres.mjs` chép thêm bảng `CorrectiveAction` (trước đây bị bỏ sót nên
  toàn bộ việc khắc phục biến mất khi chuyển sang PostgreSQL). Modal chi tiết vi phạm giới hạn
  `max-h-[90vh]` và cột nội dung tự cuộn nên màn hình thấp vẫn bấm được các nút ở đáy; thẻ đánh
  giá phán quyết agent dựng lại theo `violationId` nên không còn hiện phản hồi của vi phạm trước.
  Trang `/reports` xin `limit=200` cho mục "Việc khắc phục" (nêu "(tối đa 200)" khi chạm trần)
  và xếp hai nút xuất mỗi nút một dòng dưới `sm` để không bị cắt ở 390 px.
- Leo thang vận hành của agent (`escalate` không `violationId`, kind `ops.escalate`) giờ gửi
  qua **mọi kênh** đã cấu hình trong `AlertRule` — Zalo và Webhook, chứ không chỉ Telegram
  như trước. `sendOpsAlert` (`agent/lib/notify.ts`) dùng lại `senderFor`/`recipientsForChannel`
  của `src/lib/alert-channels/*` thay vì tự dựng `TelegramClient`; hàm thuần mới `opsTargets`
  chọn rule và trải ra từng kênh/người nhận. Cảnh báo vận hành không ghi bảng `Alert` (không
  có `violationId` để gắn) nên không xuất hiện ở trang `/alerts`, chỉ ở nhật ký `AgentEvent`.

## [0.10.0] - 2026-09-08

### Thêm
- Widget **Trợ lý SafeSight** nổi góc phải dưới trên mọi trang dashboard (trừ `/agent`): nút tròn mở panel chat với agent (header gradient, bong bóng chào, câu hỏi bên phải / trả lời bên trái, ô nhập Enter để gửi, Esc để đóng, nút mở trang `/agent`). Phiên hỏi đáp giữ nguyên khi đổi trang vì widget nằm ở layout.

- Agent trưởng điều phối subagent camera: hai tool mới cho phiên toàn hệ thống — `list_camera_agents` (trạng thái, hạn mức, 3 ghi chú mới nhất, vi phạm mở của từng camera) và `dispatch_to_camera` (giao việc cụ thể → task kind mới `camera.instruction`, ưu tiên 60, chạy dưới subagent camera đó với chỉ dẫn làm "Lý do", không bị cổng "không có hoạt động mới" chặn; chỉ dẫn được ghi vào trí nhớ camera). Preamble nhắc vai trò agent trưởng; đếm chung hạn mức với `schedule_followup`.

- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1 tiếng Việt, thêm mục riêng về hình ảnh người lao động và secret vận hành), liên kết từ README và CONTRIBUTING.

### Sửa
- Đợt review trước v0.10.0 (`docs/review/2026-09-08-*`): `list_camera_agents` lọc trạng thái vi phạm chữ HOA như DB lưu (trước đó `openViolations` luôn 0), trả `status` chữ thường và `dailyTokenCap` mặc định 300 000; hai tool điều phối chỉ gắn vào phiên không thuộc camera nào (ask từ modal camera/vi phạm không còn điều phối được camera khác); `dispatch_to_camera` không báo lỗi khi ghi trí nhớ xung đột sau khi task đã xếp (`memoryWritten`); widget trợ lý chỉ hiện cho vai trò được vào `/agent`; toast dời lên góc phải trên để không đè panel chat; `CameraMonitoringCard` dùng `DEMO_CAMERA_IDS` chung thay tập id riêng từ `mockCameras`; `wiki/04` mô tả đúng Zone đã được engine dùng.

### Thay đổi
- Ô hỏi đáp trên `/agent` và tab Agent trong modal camera/vi phạm/công trường chuyển sang dạng bong bóng chat (cùng `useAskSession` và `ChatThread` với widget); phần thuần `toChatItems`/`eventSummary` tách ra `src/lib/chat-shape.ts` có test. Toast dời lên `bottom-24` để không đè nút chat.

## [0.9.0] - 2026-09-08

### Thêm
- Clip bằng chứng ~8 giây cho mỗi vi phạm đã chốt: `ai-engine/clips.py` (`FrameRing` đệm 20 khung gần nhất mỗi luồng, `ClipWriter` bọc `cv2.VideoWriter` mp4v 4 fps, `PendingClip`/`start_clip`); engine ghi `public/snapshots/clip_<cameraId>_<timestamp>.mp4` gồm 20 khung TRƯỚC + 12 khung SAU (ghi dần ở các vòng lặp kế tiếp nên không chặn vòng lặp nhận diện) và gửi kèm `clipUrl` trong `POST /api/violations` (trường tuỳ chọn, lưu `Violation.clipUrl`). Modal chi tiết vi phạm phát clip với ảnh snapshot làm poster, không có clip thì hiện ảnh; `clear_snapshots()` và `snapshot.cleanup` của agent xử lý clip cùng luật với ảnh (chỉ xoá tệp của vi phạm đã đóng và cũ hơn 24h); `read_violation` trả `clipUrl` kèm nhắc "có clip 8s, xem trong modal".
- Vùng nhận diện (Zone/ROI) theo camera: người có điểm chân ngoài mọi vùng `MONITORING` bị bỏ trước khi xét PPE (`ai-engine/zones.py` point-in-polygon thuần Python, `process_frame(frame, zones=...)`); engine đọc lại bảng `Zone` mỗi 60s và ghi ảnh xem trước `public/snapshots/preview_<cameraId>.jpg` mỗi 30s. API `GET/PUT /api/cameras/[id]/zones`, hook `useCameraZones`/`useSaveCameraZones`, trình vẽ đa giác trong dialog sửa camera (Cài đặt > Giám sát).
- Hai kênh cảnh báo mới bên cạnh Telegram: **Zalo OA** (model `ZaloSettings`, access token mã hoá AES-256-GCM, thẻ "Zalo OA" trong `/settings` với nút kiểm tra kết nối `getoa`, API `GET/POST /api/settings/zalo` và `POST /api/settings/zalo/test`) và **Webhook** (POST JSON `{ event, violation, camera, site, snapshotUrl }` kèm header `X-SafeSight-Signature: sha256=<HMAC-SHA256 body bằng WEBHOOK_SECRET>`, timeout 5s). `alert-notifier.ts` tách thành `src/lib/alert-channels/{index,telegram,zalo,webhook}.ts` theo interface `AlertSender`; `Alert.channel` ghi đúng kênh đã gửi. Dialog quy tắc cảnh báo hiện ô người nhận riêng cho từng kênh đang bật (chat_id / Zalo user id / URL https); `AlertRule.recipients` giữ nguyên một mảng, mục của kênh mới mang tiền tố `zalo:` / `webhook:` nên quy tắc Telegram cũ không phải sửa gì.
- Trang **Báo cáo** `/reports` (SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER): lọc theo công trường / camera / khoảng ngày (mặc định 7 ngày), bảng tổng hợp theo camera (tổng · vi phạm thật · báo oan · còn mở), bảng chi tiết, nút "Xuất CSV" (UTF-8 có BOM) và "In / PDF" (`window.print()` + khối `@media print` đổi sang nền sáng, ẩn sidebar/header/bộ lọc). API `GET /api/reports/violations?siteId&cameraId&from&to` (lọc theo phạm vi site, tối đa 2.000 dòng) với hàm thuần `buildReportSummary` trong `src/lib/report-shape.ts`.
- Báo cáo tuần tự động của agent: kind `weekly.report` (lane nghiên cứu, priority 150) do `ensureRecurring()` gieo theo `AgentSettings.weeklyReportAt` (`"MON 08:00"`, đặt trên `/agent`), gửi Telegram bằng `escalate` và ghi `AgentEvent report` để `/reports` hiện bản mới nhất.
- Tạo người dùng (`POST /api/users`, dialog "Thêm người dùng" trên `/users`), đổi mật khẩu tự phục vụ (`PATCH /api/users/me/password`, trang `/profile` vào từ menu avatar Header), và nhật ký thao tác (`src/lib/audit-log.ts` ghi vào người dùng/camera/quy tắc cảnh báo/Telegram/cài đặt agent, đọc qua `GET /api/audit-log` và tab "Nhật ký" trong `/settings`). Quên mật khẩu (cần email) chưa làm, để backlog.
- Tỉ lệ tuân thủ tính từ **số người AI thực sự quan sát được** thay vì ước lượng theo số vi phạm: engine cộng dồn "người × giây" mỗi phút cho từng camera (đã lọc vùng làm việc) và gửi `POST /api/observations` một lần mỗi phút (timeout 2s, không chặn vòng lặp nhận diện); model `ObservationStat` (`@@unique([cameraId, minute])`, upsert); `GET /api/stats/compliance?siteId&from&to` trả theo ngày `{ day, personMinutes, violations, complianceRate }` với `complianceRate = 1 − vi_phạm / max(phút-người, 1)` (hàm thuần `complianceByDay` trong `src/lib/compliance-shape.ts`).
- Bản đồ nhiệt vi phạm trên `/analytics` (dưới các biểu đồ hiện có): lưới 7×24 giờ×thứ tô theo `--danger` từ số vi phạm trong khoảng lọc riêng (7/30/90 ngày, mặc định 30), và bản đồ vị trí — chọn camera, chấm mờ tại tâm từng bbox vi phạm chồng lên ảnh xem trước `preview_<cameraId>.jpg` (ảnh lỗi/chưa có thì hiện nền xám, chấm vẫn vẽ). Toàn bộ tính bằng hàm thuần có test trong `src/lib/heatmap-shape.ts` (`hourWeekdayGrid`, `bboxCenters`, `maxCell`), component `src/components/analytics/{TimeHeatmap,PositionHeatmap}.tsx`, dữ liệu client từ `useViolations()`/`useCameras()` sẵn có.
- Giao diện di động và PWA: Sidebar trở thành drawer ẩn/hiện dưới `md` (768px) với overlay và nút hamburger ở Header (state dùng chung qua `SidebarProvider`/`useSidebar` mới trong `src/components/layout/sidebar-context.tsx`), tự đóng khi đổi route, nút thu gọn chỉ còn từ `md`; ba bảng dữ liệu chính (`ViolationsTable`, `AlertsTable`, `UserTable`) hiện dạng thẻ dưới `md` thay cho bảng cuộn ngang. Ứng dụng cài được như app (PWA): `public/manifest.webmanifest`, icon `public/icons/icon-192.png`/`icon-512.png` (sinh một lần bằng `node scripts/make-icons.mjs`, dùng `sharp` đã có sẵn), `public/sw.js` cache shell tối thiểu (network-first, bỏ qua `/api/` và `/snapshots/`) đăng ký ở production. Chưa kiểm hình ảnh thật trên trình duyệt (môi trường worktree không chạy server/Chrome).
- Chạy được trên **PostgreSQL** bên cạnh SQLite: `prisma/postgres/schema.prisma` (bản sao của schema SQLite, chỉ khác `provider`; test `agent/test/schema-parity.test.ts` canh không cho hai file lệch nhau), `src/lib/prisma.ts` và `prisma/seed.mjs` chọn adapter theo lược đồ `DATABASE_URL` (`postgres://` → `PrismaPg`, `file:` → `PrismaLibSqlWal`), script `db:pg:push` / `db:pg:generate` / `db:pg:migrate-data` (`scripts/sqlite-to-postgres.mjs` chép 16 bảng theo thứ tự khoá ngoại, từng lô 500 dòng, `ON CONFLICT DO NOTHING`). `docker-compose.yml` thêm service `postgres:16-alpine` dưới profile `pg` (volume `pgdata`, chỉ mở `127.0.0.1:5432`) và build arg `PRISMA_SCHEMA`/`BUILD_DATABASE_URL` cho image dashboard. **Chưa nghiệm thu trên PostgreSQL thật** (máy phát triển không có Postgres).
- Chạy được **nhiều worker agent**: `rememberCamera()` ghi trí nhớ camera bằng compare-and-swap trên chính trường `memory` (`updateMany` + đọc lại và thử lại một lần) nên hai worker ghi cùng lúc không đè mất ghi chú của nhau; `AGENT_WORKER_ID` (mặc định `<hostname>-<pid>`) được ghi vào sự kiện `session.started`.

### Thay đổi
- `agent/lib/guard.ts`: ghi rõ `rateLimit()`/`LIMITS` đếm **theo từng worker** (bộ nhớ tiến trình), chạy N worker thì trần thực tế theo hệ thống là N lần; `claimDue()` được xác nhận là đã an toàn với nhiều worker nhờ lease bằng `updateMany` có điều kiện. `docker-entrypoint.sh` bỏ qua bước khởi tạo file SQLite khi `DATABASE_URL` là PostgreSQL.
- Bảng điều khiển: KPI "Tỷ lệ tuân thủ" và biểu đồ xu hướng 30 ngày lấy số thật từ `/api/stats/compliance` (hook `useComplianceStats`); ngày chưa có dữ liệu quan sát mới rơi về ước lượng cũ `rateFromCount` và thẻ KPI hiện nhãn **"ước tính"**. KPI "Camera trực tuyến" đếm từ `useCameras()` (dữ liệu thật) thay cho `mockCameras`.
- 5 skill của agent (`agent/skills/*/SKILL.md`) viết lại hoàn toàn bằng tiếng Anh theo chuẩn writing-skills (frontmatter "Use when…", Overview, Quick reference, Common mistakes); kiểm bằng kịch bản review vi phạm không skill → có skill (quan sát đúng kind chuẩn, không bịa `kind` cho `schedule_followup`, leo thang đúng luật).

### Sửa
- AI engine: tên tệp bằng chứng nay kèm `trackId` (`violation_<cam>_<ts>_<trackId>.jpg`, `clip_<cam>_<ts>_<trackId>.mp4`) — hai người cùng vi phạm trong CÙNG một giây trên cùng camera trước đây trùng tên nên hai `cv2.VideoWriter` ghi đè lên một file, clip hỏng và cả hai vi phạm cùng trỏ vào đó. Tiền tố/đuôi giữ nguyên nên `clear_snapshots()` và `snapshot.cleanup` của agent vẫn nhận đúng tệp.
- AI engine: `DATABASE_URL` dạng `postgresql://` nay in một dòng cảnh báo TO lúc khởi động thay vì im lặng trả `None` — engine chưa đọc được PostgreSQL, nên trước đây bật Postgres là tắt luôn vùng nhận diện, camera thật và bộ lọc camera đã xoá mà không có dấu hiệu nào (`wiki/03` nêu rõ engine vẫn cần `DATABASE_URL` `file:`).
- AI engine: khung đệm cho clip bằng chứng được thu nhỏ một nửa trước khi vào `FrameRing` (20 khung 1080p: ~124MB → ~31MB mỗi luồng), phần đuôi clip dùng đúng khung đã thu nhỏ đó; `POST /api/observations` mỗi phút chuyển sang thread phụ (timeout 2s trước đây khựng MỌI luồng cùng lúc); `last_person_count` đặt lại 0 khi khung không có box nào, khỏi cộng dồn số người của khung trước vào mẫu số tuân thủ.

## [0.8.0] - 2026-09-08

### Thêm
- Subagent giám sát theo camera: model `CameraAgent` (bật/tắt, trí nhớ ≤ 20 ghi chú, trần token riêng, nhịp tổng hợp), tool `remember_camera`, phiên nghiên cứu của vi phạm/camera chạy dưới subagent của camera đó, `camera.digest` định kỳ bỏ qua khi không có hoạt động mới, lane nghiên cứu chạy song song 3 phiên (mỗi camera một phiên). API `GET /api/agent/cameras`, `PATCH /api/agent/cameras/[id]`, `POST /api/agent/cameras/[id]/digest`; thẻ subagent trên `/agent` và trí nhớ trong tab Agent của modal camera.
- Skill của agent chuyển sang chuẩn `agent/skills/<name>/SKILL.md` (frontmatter `name`/`description`, bảng chỉ mục tự sinh); skill mới `remembering-camera-context` viết theo quy trình kiểm thử skill (baseline không skill → viết → kiểm lại).

### Chưa kiểm tra
- Giao diện thẻ subagent camera và ô nhập model chưa được chụp desktop/mobile (máy vận hành quá tải, chưa được chạy app).

## [0.7.0] - 2026-09-08

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
- `agent/test/escalate.test.ts`: gộp hai helper `run`/`runWithCtx` trùng thân hàm thành một `run` nhận `ctx` tuỳ chọn.
- Tách logic đọc/ghi `localStorage['safesight_read_alerts']` ở `/alerts` thành hook dùng chung `useReadAlertIds()`/`persistReadAlertIds()` (`src/hooks/use-read-alerts.ts`), chuẩn bị cho badge Sidebar trừ đi các thông báo đã đọc.

### Sửa
- Vai trò người dùng lưu chữ HOA trong DB (mặc định `SAFETY_OFFICER`) được chuẩn hoá về chữ thường khi đăng nhập; kiểm tra org-wide không còn phân biệt hoa/thường, nên user tạo qua DB không bị coi nhầm là bị giới hạn theo site.
- API đọc dữ liệu không còn mở cho mọi người trong mạng: `GET /api/violations`, `/api/violations/[id]`, `/api/cameras`, `/api/cameras/[id]`, `/api/sites`, `/api/sites/[id]`, `/api/users` nay bắt buộc session (401) — middleware `src/proxy.ts` không chạy trên `/api` nên từng route tự kiểm bằng `requireSession()`. `POST /api/violations` giữ nguyên xác thực `X-AI-Engine-Secret` cho AI engine.
- Danh sách vi phạm/camera/công trường lọc theo công trường được giao (`allowedSiteIds()` đọc `User.assignedSites`); xin `?siteId=` ngoài phạm vi trả 403; chi tiết vi phạm/camera/công trường kiểm `assertSiteAccess`; `/api/users` chỉ SUPER_ADMIN/ORG_ADMIN, khớp `PAGE_ROLES['/users']`.
- `GET /api/violations` lọc bằng SQL (`buildViolationWhere`) thay vì tải cả bảng rồi lọc bằng JS, và chỉ `select` tên camera/công trường; badge Sidebar dùng endpoint mới `GET /api/violations/count` (`useOpenViolationCount`) nên mỗi 15s chỉ chạy một COUNT thay vì tải toàn bộ vi phạm kèm 2 join.
- Ghi Violation/Alert không còn văng `P1008 SocketTimeout` khi nhiều camera cùng báo vi phạm: `src/lib/prisma.ts` đặt `PRAGMA busy_timeout=5000` + `journal_mode=WAL` khi mở SQLite (tái hiện 8 writer × 30 ghi: 20/240 → 240/240 thành công).
- Lane nghiên cứu không còn hỏng `Cannot read properties of undefined (reading 'filter')` khi key là proxy `/chat/completions`.
- Tài khoản dev cứng `admin@safesight.ai` chỉ còn hoạt động ngoài production (hoặc khi `ALLOW_DEV_LOGIN=true`); trang đăng nhập ẩn gợi ý ở production.
- `POST /detections` của YOLO Bridge yêu cầu header `X-AI-Engine-Secret` khi `AI_ENGINE_SECRET` được đặt; engine gửi kèm header; image bridge có `dotenv`.
- Agent trực vận hành không còn SIGTERM một pid lạ khi engine đã tắt: kiểm `/proc/<pid>/cmdline` chứa `yolo_inference.py` (ngoài Linux không có `/proc` nên chỉ kiểm còn sống, thay vì báo `engine.stalled` giả mỗi vòng quét), pid không hợp lệ không tiêu suất `engine-restart`; `yolo_inference.py` ghi `.heartbeat.json` ngay khi khởi động (trước lúc nạp model) và xoá khi thoát.
- Engine treo thật (pid còn sống, kẹt trong cv2/torch) lại được khởi động lại: bỏ luật hạ `detail.pidAlive` về `false` khi heartbeat quá 5 phút — luật đó làm `actions.ts` không bao giờ SIGTERM nữa sau mốc đó.
- `health.probe` không còn đẩy lùi lịch `health.sweep` định kỳ, và không còn cộng dồn bộ đếm leo thang (`bridgeFailStreak`, `repeats`) vốn định nghĩa theo nhịp quét 60s.
- Chạm trần token trong ngày luôn phát `session.ended (stop: skipped)` để panel hỏi-đáp không treo; event `error` gắn đúng `sessionId` của task; vòng lặp agent thoát ngay khi nhận SIGTERM; `PATCH /api/cameras/[id]` đánh thức agent sau khi ghi task; hỏi tiếp vào task `ask` đã hết lượt thử tạo task mới thay vì reset `attempts` (đua với `retireExhausted`), nhánh nối lại dùng `updateMany` kèm `finishedAt: null`.
- JSON hỏng trong `bboxData`/`agentReview` không còn làm 500 danh sách vi phạm; `seed()` của agent chuẩn hoá `Violation.status` về chữ HOA một lần lúc khởi động thay vì so sánh không phân biệt hoa/thường ở từng chỗ gọi.
- Lane nghiên cứu chạy được trên proxy tương thích OpenAI: model mặc định `claude-opus-5` do route Next tạo bị nắn về `LLM_MODEL_DEFAULT` lúc worker khởi động, `PATCH /api/agent/settings` nhận tên model tự do, ô Model trên `/agent` là `<input list>` + `<datalist>` nên admin gõ được tên bất kỳ.
- `LLM_BASE_URL`/`ANTHROPIC_BASE_URL` giờ áp cả cho chế độ `anthropic` (`new Anthropic({ baseURL })`), không chỉ chế độ `openai`.
- Event `error` gắn đúng `sessionId` của phiên vừa chạy (`SessionError.sessionId`), không phải phiên của lần thử trước.
- `snapshot.cleanup` không xoá ảnh của vi phạm còn `OPEN`/`UNDER_REVIEW`: chỉ xoá ảnh đã tham chiếu, vi phạm đã đóng (`RESOLVED`/`FALSE_POSITIVE`) và cũ hơn 24h.
- `agent/lib/llm/openai.ts` gọn lại quanh SDK: dùng `BetaRunnableTool`/`tool.parse` thay khai báo tool cục bộ, ném `Anthropic.APIError.generate(...)` nên `mapError` dùng chung một nhánh cho hai provider (thêm `PermissionDeniedError`), và với `LLM_IMAGE_INPUT=true` mỗi ảnh chỉ tải lên một lần mỗi phiên.
- Badge Sidebar không còn hiện số "0" rời khi không có vi phạm.
- Dashboard container không còn crash-loop khi bind mount `./data`/`./public/snapshots`: chạy bằng `user: "${UID:-1000}:${GID:-1000}"` trong `docker-compose.yml` thay vì uid riêng của user `app` trong image; `/app/data`/`/app/public/snapshots` trong image đã `chmod 777` và `docker-entrypoint.sh` báo lỗi rõ nếu vẫn không ghi được thay vì để `set -e` chết im lặng.
- YOLO engine không còn im lặng bỏ qua khi bridge từ chối detection (401 do `AI_ENGINE_SECRET` lệch): in cảnh báo 1 lần/mã lỗi HTTP thay vì `except: pass`; `env_local.py` đọc thêm `.env` (không chỉ `.env.local`) để engine luôn khớp secret với bridge; `mock_yolo.js` gửi kèm header `X-AI-Engine-Secret` như engine thật.
- `next dev` không còn tự chèn block `nextjs-agent-rules` vào `AGENTS.md` (Next.js 16.3 agent-file generation): đặt `agentRules: false` trong `next.config.ts`.

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

[Unreleased]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.11.0...HEAD
[0.11.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nguyenbaquyen075/safesight-instructions/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/nguyenbaquyen075/safesight-instructions/releases/tag/v0.1.0
