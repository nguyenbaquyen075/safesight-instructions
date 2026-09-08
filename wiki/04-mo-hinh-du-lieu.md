# 04 — Mô hình dữ liệu

Nguồn: `prisma/schema.prisma` (provider **SQLite** cho dev). Kiểu TypeScript tương ứng ở `src/types/models.ts`, enum ở `src/types/enums.ts`.

## Sơ đồ quan hệ

```
Organization (tổ chức / tenant)
  ├── User (người dùng, RBAC)
  └── Site (công trường)
        ├── AlertRule (quy tắc cảnh báo theo site)
        └── Camera (camera giám sát)
              └── Zone (vùng nhận diện)
                    └── Violation (vi phạm)
                          └── Alert (cảnh báo đã gửi)
AuditLog (nhật ký thao tác)   ·   TelegramSettings (1 dòng: bot token đã mã hoá)
ObservationStat (số người quan sát được mỗi phút của từng camera)
AgentTask (hàng đợi)   ·   AgentEvent (audit + chat)   ·   AgentSettings (1 dòng: kill switch, model, trần token)
CameraAgent (1 dòng/camera: subagent riêng của camera)
```

## Các model chính

| Model | Ý nghĩa | Ghi chú |
|---|---|---|
| `Organization` | Tổ chức/doanh nghiệp (đa tenant) | có `plan`, `logoUrl` |
| `Site` | Công trường | toạ độ `lat`/`lng`, các số đếm camera/tuân thủ/cảnh báo |
| `Camera` | Camera giám sát | `rtspUrl` lưu nguồn theo quy ước `webcam:0` / `rtsp://...` / `video:ten.mp4`; `status` khác `ONLINE` thì AI bỏ qua |
| `Zone` | Vùng nhận diện trong khung hình | `polygonData` JSON string (điểm tỉ lệ 0–1, `ZoneDTO` trong `src/lib/zone-shape.ts`); `type` quyết định vùng dùng để LỌC hay để BẮT xâm nhập (bảng dưới); AI engine đọc lại mọi vùng đang bật mỗi 60s (`ai-engine/zones.py`) |
| `Violation` | Vi phạm AI đã chốt | `type`, `severity`, `confidence`, `bboxData` (JSON), `snapshotUrl`, `clipUrl` (clip bằng chứng ~8s do engine ghi, NULL khi không ghi được), `occurrenceCount` (lần thứ mấy của cùng một người, reset khi rời khung; GET `/api/violations` và `/api/violations/[id]` trả về trường này), `agentReview` (JSON `{ verdict, band, observations[], note, sessionId, reviewedAt }`, agent ghi sau khi review) |
| `ObservationStat` | Số người AI quan sát được mỗi phút của một camera | `minute` (mốc phút), `persons` (đông nhất trong phút), `personSeconds` ("người × giây"), `@@unique([cameraId, minute])`; AI engine ghi qua `POST /api/observations`, là MẪU SỐ của tỉ lệ tuân thủ thật (`GET /api/stats/compliance`). Cố ý không khai quan hệ Prisma tới Camera/Site — chỉ đọc theo `siteId` + `minute` |
| `Alert` | Cảnh báo sinh từ vi phạm | `channel`, `recipient`, `errorMessage` (null = gửi thành công, dùng tính cooldown) |
| `AlertRule` | Quy tắc cảnh báo | `violationTypes`/`channels`/`recipients` JSON array, `threshold`, `cooldownSec` |
| `User` | Người dùng | `role`, `assignedSites` JSON array, `passwordHash` (Credentials login) |
| `AuditLog` | Nhật ký thao tác | chưa có UI đọc |
| `TelegramSettings` | Cấu hình bot Telegram dùng chung | `botTokenEncrypted` (AES-256-GCM, khoá `TELEGRAM_ENCRYPT_KEY`), `isEnabled` |
| `ZaloSettings` | Cấu hình Zalo OA dùng chung | `accessTokenEncrypted` (AES-256-GCM, cùng khoá `TELEGRAM_ENCRYPT_KEY`), `isEnabled` |
| `AgentTask` | Hàng đợi việc của agent | `kind`, lane suy từ kind, `priority`, `budget` (số tool call tối đa/phiên), `attempts`, `dueAt`/`leasedUntil` (lease), `sessionId`, `outcome`; xem [Agent giám sát tự động](09-agent.md) |
| `AgentEvent` | Audit + lịch sử hội thoại agent | `sessionId`, `taskId?`, `subjectType?/subjectId?`, `type` (`tool.call`/`tool.result`/`verdict`/`action`/`message.user`/`message.assistant`/`health`/`error`/`report`/`session.ended`), `data` (JSON string) |
| `AgentSettings` | Cấu hình agent (1 dòng) | `isEnabled` (kill switch), `model`, `reviewEffort`, `dailyTokenCap`, `shiftReportAt`, `weeklyReportAt` (`"MON 08:00"`) |
| `CameraAgent` | Subagent của một camera (1 dòng/camera, `id` = `Camera.id`, tạo lười khi camera có task đầu tiên) | `isEnabled` (bật/tắt riêng camera), `memory` (JSON `[{ at, text, sessionId }]`, tối đa 20 ghi chú, mỗi ghi chú ≤ 300 ký tự — trí nhớ bền về camera: góc máy, giờ ngược sáng, khu vực hay báo oan), `digestEveryMin` (nhịp tổng hợp), `dailyTokenCap`/`tokensUsedToday`/`usageDay` (trần token riêng theo ngày địa phương), `lastDigestAt`; không có quan hệ Prisma — `DELETE /api/cameras/[id]` xoá dòng này tường minh |

## Bộ giá trị (enum nghiệp vụ)

SQLite không có enum nên DB lưu **String**; giá trị hợp lệ định nghĩa ở `src/types/enums.ts`:

- **`ViolationType`** (16 loại): `hard_hat`, `safety_vest`, `safety_gloves`, `safety_footwear`, `protective_eyewear`, `safety_harness`, `respiratory`, `zone_intrusion`, `vehicle_proximity`, `suspended_load`, `fall_detected`, `fire_smoke`, `phone_use`, `running`, `unauthorized_climbing`, `crowd_density`
- **`Severity`**: `critical` / `high` / `medium` / `low`
- **`ViolationStatus`**: `open` / `under_review` / `resolved` / `false_positive`
- **`CameraStatus`**: `online` / `offline` / `degraded` / `maintenance`
- **`AlertStatus`**: `new` / `acknowledged` / `escalated` / `resolved` / `suppressed`
- **`AlertChannel`**: `in_app` / `sms` / `email` / `siren` / `pa_system` / `webhook` / `telegram` (chỉ **telegram** đã nối thật)
- **`UserRole`**: `super_admin` / `org_admin` / `site_manager` / `safety_officer` / `supervisor`
- **`SiteStatus`**: `active` / `inactive` / `setup`
- **`ZoneType`**: `restricted` / `warning` / `monitoring` / `suspended_load`

### Các loại `Zone.type` (DB lưu chữ HOA)

| `type` | Ý nghĩa | Engine làm gì |
|---|---|---|
| `MONITORING` | Vùng LÀM VIỆC — phạm vi AI được phép soi PPE | Người có điểm chân ngoài **mọi** vùng MONITORING bị loại trước khi xét PPE |
| `RESTRICTED` | Vùng CẤM vào | Người đứng trong vùng ≥ 3 giây → Violation `zone_intrusion` mức `critical` |
| `WARNING` | Vùng cảnh báo (mép vùng cấm) | Như trên nhưng mức `high` |
| `SUSPENDED_LOAD` | Vùng dưới tải treo/cẩu | Người đứng trong vùng ≥ 3 giây → Violation `suspended_load` mức `critical` |

Vùng nguy hiểm ghi kèm `Violation.zoneId`; xoá vùng thì `zoneId` của vi phạm cũ về `null` (`onDelete: SetNull`), không mất hồ sơ. Giá trị `type` lạ (sửa tay trong DB) được quy về `MONITORING` ở cả hai phía (`toZoneDTO`, `load_zones`).

> Lưu ý chữ hoa/thường: schema Prisma đặt default chữ HOA (`"ONLINE"`, `"OPEN"`), API chuyển về chữ thường khi trả DTO (xem `toCameraDTO()` trong `src/lib/camera-shape.ts` và route violations).

## Liên hệ với AI

`PPE_VIOLATION_MAP` trong `ai-engine/yolo_inference.py` ánh xạ món PPE thiếu → `(type, severity)`:

| PPE thiếu | `ViolationType` | `Severity` |
|---|---|---|
| `helmet` | `hard_hat` | `critical` |
| `vest` | `safety_vest` | `high` |
| `gloves` | `safety_gloves` | `medium` |
| `boots` | `safety_footwear` | `medium` |

Một người thiếu nhiều món chỉ ghi **một** Violation theo món nghiêm trọng nhất (thứ tự trên).

`ZONE_VIOLATION_MAP` ánh xạ vùng nguy hiểm → `(type, severity)`:

| `Zone.type` | `ViolationType` | `Severity` |
|---|---|---|
| `RESTRICTED` | `zone_intrusion` | `critical` |
| `WARNING` | `zone_intrusion` | `high` |
| `SUSPENDED_LOAD` | `suspended_load` | `critical` |

Các `ViolationType` còn lại (té ngã, khói/lửa…) đã có trong enum nhưng **chưa có model AI**.

## Seed dữ liệu

`npm run db:seed` (`prisma/seed.mjs`) tạo 1 Organization, 2 Site, 6 Camera (`cam-001`…`cam-008`) khớp `src/data/camera-videos.json`. Bắt buộc chạy trước khi AI ghi Violation, vì `cameraId` là khoá ngoại.

## Dev SQLite ↔ Production PostgreSQL

Có **hai file schema với y hệt model**, chỉ khác dòng `provider` của datasource:

| File | Provider | Dùng khi |
|---|---|---|
| `prisma/schema.prisma` | `sqlite` | Dev và bản Docker mặc định |
| `prisma/postgres/schema.prisma` | `postgresql` | Production |

Cố ý **không** khôi phục enum/mảng native ở bản Postgres: giữ `String` + JSON-trong-`String` nên kiểu TypeScript sinh ra giống hệt nhau và mã nguồn không phải rẽ nhánh theo DB. Test `agent/test/schema-parity.test.ts` so hai file sau khi bỏ chú thích và chuẩn hoá dòng `provider` — sửa một file mà quên file kia là test đỏ ngay.

`src/lib/prisma.ts` (`createAdapter`) chọn adapter theo **lược đồ của `DATABASE_URL`**: `postgres://`/`postgresql://` → `PrismaPg`, `file:` → `PrismaLibSqlWal`. `prisma/seed.mjs` làm y như vậy. Không có biến cấu hình riêng nào để quên đồng bộ.

Ràng buộc quan trọng của Prisma 7: query compiler được **nhúng vào client lúc `prisma generate`** theo provider của schema, nên một bản client chỉ chạy được một loại DB. Bản dựng cho Postgres phải chạy `npm run db:pg:generate` — xem [03 — Cài đặt & vận hành](03-cai-dat-va-van-hanh.md#chuyển-sang-postgresql). Đổi client bằng lệnh này sẽ **thay** client SQLite trong `node_modules`; quay lại dev thì chạy `npx prisma generate`.

Dev có ba tiến trình cùng đụng vào một file SQLite: Next.js API (ghi Violation/Alert), agent worker (ghi `AgentEvent`/`AgentTask`) và AI engine Python (đọc bảng `Camera`). Mặc định libsql mở DB ở chế độ rollback-journal với `busy_timeout = 0` nên chỉ cần một tiến trình đang đọc là lệnh ghi văng ngay `SQLITE_BUSY` → Prisma `P1008`. Vì vậy `src/lib/prisma.ts` (dùng chung cho Next.js lẫn agent) đặt `PRAGMA busy_timeout=5000` rồi `PRAGMA journal_mode=WAL` ngay khi mở connection. Postgres không có hạn chế này nên khi lên prod hai PRAGMA đó chỉ còn tác dụng với nhánh SQLite.

---
👉 Tiếp theo: [Giao diện & API](05-giao-dien-va-api.md)
