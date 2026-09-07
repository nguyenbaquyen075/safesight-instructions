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
```

## Các model chính

| Model | Ý nghĩa | Ghi chú |
|---|---|---|
| `Organization` | Tổ chức/doanh nghiệp (đa tenant) | có `plan`, `logoUrl` |
| `Site` | Công trường | toạ độ `lat`/`lng`, các số đếm camera/tuân thủ/cảnh báo |
| `Camera` | Camera giám sát | `rtspUrl` lưu nguồn theo quy ước `webcam:0` / `rtsp://...` / `video:ten.mp4`; `status` khác `ONLINE` thì AI bỏ qua |
| `Zone` | Vùng nhận diện trong khung hình | `polygonData` JSON string; chưa dùng trong pipeline AI |
| `Violation` | Vi phạm AI đã chốt | `type`, `severity`, `confidence`, `bboxData` (JSON), `snapshotUrl`, `occurrenceCount` (lần thứ mấy của cùng một người, reset khi rời khung) |
| `Alert` | Cảnh báo sinh từ vi phạm | `channel`, `recipient`, `errorMessage` (null = gửi thành công, dùng tính cooldown) |
| `AlertRule` | Quy tắc cảnh báo | `violationTypes`/`channels`/`recipients` JSON array, `threshold`, `cooldownSec` |
| `User` | Người dùng | `role`, `assignedSites` JSON array, `passwordHash` (Credentials login) |
| `AuditLog` | Nhật ký thao tác | chưa có UI đọc |
| `TelegramSettings` | Cấu hình bot Telegram dùng chung | `botTokenEncrypted` (AES-256-GCM, khoá `TELEGRAM_ENCRYPT_KEY`), `isEnabled` |

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

> Lưu ý chữ hoa/thường: schema Prisma đặt default chữ HOA (`"ONLINE"`, `"OPEN"`), API chuyển về chữ thường khi trả DTO (xem `toCameraDTO()` trong `src/lib/camera-shape.ts` và route violations).

## Liên hệ với AI

`PPE_VIOLATION_MAP` trong `ai-engine/yolo_inference.py` ánh xạ món PPE thiếu → `(type, severity)`:

| PPE thiếu | `ViolationType` | `Severity` |
|---|---|---|
| `helmet` | `hard_hat` | `critical` |
| `vest` | `safety_vest` | `high` |
| `gloves` | `safety_gloves` | `medium` |
| `boots` | `safety_footwear` | `medium` |

Một người thiếu nhiều món chỉ ghi **một** Violation theo món nghiêm trọng nhất (thứ tự trên). Các `ViolationType` còn lại (té ngã, khói/lửa, xâm nhập vùng…) đã có trong enum nhưng **chưa có model AI**.

## Seed dữ liệu

`npm run db:seed` (`prisma/seed.mjs`) tạo 1 Organization, 2 Site, 6 Camera (`cam-001`…`cam-008`) khớp `src/data/camera-videos.json`. Bắt buộc chạy trước khi AI ghi Violation, vì `cameraId` là khoá ngoại.

## Dev SQLite ↔ Production PostgreSQL

Đầu `schema.prisma` ghi rõ: dev dùng `sqlite`, không enum/mảng native. `package.json` đã cài cả `@prisma/adapter-libsql` (dev) và `@prisma/adapter-pg` (prod). Khi lên Postgres cần đổi provider, khôi phục enum/array, và cập nhật `SPEC.md` + wiki này.

---
👉 Tiếp theo: [Giao diện & API](05-giao-dien-va-api.md)
