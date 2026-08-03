# 04 — Mô hình dữ liệu

Nguồn: `prisma/schema.prisma`.

## Sơ đồ quan hệ

```
Organization (tổ chức / tenant)
  ├── User (người dùng)
  └── Site (công trường)
        └── Camera (camera giám sát)
              └── Zone (vùng nhận diện)
                    └── Violation (vi phạm)
                          └── Alert (cảnh báo)
AlertRule (quy tắc cảnh báo)   ·   AuditLog (nhật ký thao tác)
```

## Các model chính

| Model | Ý nghĩa | Ghi chú |
|---|---|---|
| `Organization` | Tổ chức/doanh nghiệp (đa tenant) | có `plan`, `logoUrl` |
| `Site` | Công trường | toạ độ (`lat`/`lng`), số camera, tỉ lệ tuân thủ, số cảnh báo |
| `Camera` | Camera giám sát | trạng thái ONLINE/OFFLINE… |
| `Zone` | Vùng nhận diện trong khung hình | loại vùng (RESTRICTED, WARNING…) |
| `Violation` | Vi phạm phát hiện được | loại vi phạm + mức độ nghiêm trọng |
| `Alert` | Cảnh báo sinh ra từ vi phạm | trạng thái xử lý, kênh gửi |
| `AlertRule` | Quy tắc phát cảnh báo | điều kiện → hành động |
| `User` | Người dùng | vai trò (RBAC) |
| `AuditLog` | Nhật ký thao tác | phục vụ truy vết |

## Bộ giá trị (enum nghiệp vụ)

> Ở bản SQLite dev, các enum này được lưu dạng **chuỗi (String)** thay vì kiểu enum gốc (xem lưu ý bên dưới). Danh sách giá trị theo `SPEC.md`:

- **`ViolationType`** (16 loại): `HARD_HAT`, `SAFETY_VEST`, `SAFETY_HARNESS`, `ZONE_INTRUSION`, `FALL_DETECTED`, `FIRE_SMOKE`, `VEHICLE_PROXIMITY`, `PHONE_USE`, `RUNNING`, …
- **`Severity`**: `CRITICAL` / `HIGH` / `MEDIUM` / `LOW`
- **`CameraStatus`**: `ONLINE` / `OFFLINE` / `DEGRADED` / `MAINTENANCE`
- **`AlertStatus`**: `NEW` / `ACKNOWLEDGED` / `ESCALATED` / `RESOLVED` / `SUPPRESSED`
- **`AlertChannel`**: `IN_APP` / `SMS` / `EMAIL` / `SIREN` / `PA_SYSTEM` / `WEBHOOK`
- **`UserRole`**: `SUPER_ADMIN` / `ORG_ADMIN` / `SITE_MANAGER` / `SAFETY_OFFICER` / `SUPERVISOR`
- **`SiteStatus`**: `ACTIVE` / `INACTIVE` / `SETUP`
- **`ZoneType`**: `RESTRICTED` / `WARNING` / `MONITORING` / `SUSPENDED_LOAD`

## Liên hệ với AI

Model YOLO hiện chỉ train 4 lớp PPE, tương ứng nhóm `ViolationType` mũ/áo:

| Lớp YOLO | Ánh xạ | Trạng thái |
|---|---|---|
| `helmet` | có mũ bảo hộ | ✅ SAFE |
| `vest` | có áo phản quang | ✅ SAFE |
| `no_helmet` | thiếu mũ → `HARD_HAT` violation | ❌ VIOLATION |
| `no_vest` | thiếu áo → `SAFETY_VEST` violation | ❌ VIOLATION |

Các `ViolationType` còn lại (té ngã, khói/lửa, xâm nhập vùng cấm…) **đã định nghĩa trong schema nhưng chưa có model AI** — thuộc lộ trình tương lai.

## ⚠️ Lưu ý lệch cấu hình DB

`prisma/schema.prisma` bắt đầu bằng ghi chú:

```
// SafeSight — SQLite schema (dev)
// For production with PostgreSQL, revert provider to "postgresql"
// and restore enum types + array fields
```

Nghĩa là:
- **Dev hiện tại:** `provider = "sqlite"`, **bỏ enum & mảng native** (lưu dạng String).
- **Production dự kiến:** đổi lại `postgresql`, khôi phục enum + array — như `SPEC.md` mô tả.

👉 Khi nối DB thật, cần thống nhất lại provider và cập nhật cả `SPEC.md` lẫn wiki này để tránh nhầm lẫn.

---
👉 Tiếp theo: [Giao diện & API](05-giao-dien-va-api.md)
