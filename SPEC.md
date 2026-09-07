# SPEC.md — SafeSight Instructions

> _Cập nhật: 2026-09-07 — chuẩn hoá theo hiện trạng codebase (`main` a1087a3)_
> _Source: Phân tích codebase + `prisma/schema.prisma` + `wiki/`_
> _Bản 2026-04-27 trước đây mô tả trạng thái "API trả mock, chưa nối DB" — đã lỗi thời._

---

## 1. Project Identity

| Trường | Giá trị |
|---|---|
| **Tên** | SafeSight AI — PPE Violation Detection System |
| **Repo** | `safesight-instructions` (GitHub, MIT) |
| **Nhóm** | AHV Works / PPP Safety |
| **Version** | v0.1.0 |
| **Trạng thái** | 🟡 **MVP — đang phát triển**, pipeline AI + dashboard + DB + Telegram đã chạy end-to-end ở dev |

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5 (strict) · Python 3.14 (venv) |
| Styling | Tailwind CSS 4 + CSS variables |
| UI | Radix UI + shadcn/ui, Lucide, Recharts |
| Auth | NextAuth.js v5 (Credentials, JWT, role trong session) |
| ORM / DB | Prisma 7 + `@prisma/adapter-libsql` (SQLite dev); `@prisma/adapter-pg` sẵn cho Postgres prod |
| State | Tanstack React Query v5, Zustand |
| Validation | Zod 4 |
| Realtime | Socket.IO (bridge `ai-engine/yolo_bridge.js`, port 4001) |
| AI | Ultralytics YOLOv8 (`ppe_multiclass.pt` + `ppe_boots.pt` + `ppe_gang.pt` + `yolov8n-pose.pt`), BoT-SORT, OpenCV |
| Cảnh báo | Telegram Bot API (token mã hoá AES-256-GCM) |

---

## 3. Domain Model

```
Organization
  ├── User
  └── Site
        ├── AlertRule
        └── Camera
              └── Zone
                    └── Violation
                          └── Alert
AuditLog · TelegramSettings
```

Enum nghiệp vụ ở `src/types/enums.ts` (DB SQLite lưu String). Chi tiết: `wiki/04-mo-hinh-du-lieu.md`.

---

## 4. Page Inventory

| Route | Trạng thái | Quyền | Ghi chú |
|---|---|---|---|
| `/login` | ✅ | — | Credentials |
| `/` | ✅ | tất cả | KPI + charts tính từ vi phạm thật |
| `/sites` | ✅ | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER | |
| `/cameras` | ✅ | tất cả | Live + khung YOLO, mic cảnh báo |
| `/site-speaker` | ✅ | tất cả | Loa công trường |
| `/alerts` | ✅ | tất cả | |
| `/violations` | ✅ | tất cả | Bảng + modal, đổi trạng thái, xoá |
| `/analytics` | ✅ | + SAFETY_OFFICER | |
| `/roboflow` | ✅ | SUPER_ADMIN, ORG_ADMIN | Đối chiếu ảnh tĩnh, tốn credit |
| `/users` | ✅ | SUPER_ADMIN, ORG_ADMIN | |
| `/settings` | ✅ | SUPER_ADMIN, ORG_ADMIN | Camera thật/video mẫu, Telegram, alert rules |
| `/reports`, `/profile` | ❌ | | Chưa có |

**Độ phủ: 11/13 trang.**

---

## 5. API Routes

Tất cả dùng Prisma (DB thật). Xem bảng đầy đủ ở `wiki/05-giao-dien-va-api.md`.

| Route | Method | Ghi chú |
|---|---|---|
| `/api/auth/[...nextauth]` | * | |
| `/api/violations` (+`/[id]`) | GET, POST · GET, PATCH, DELETE | POST chỉ cho AI engine (`X-AI-Engine-Secret`), kích hoạt Telegram |
| `/api/cameras` (+`/[id]`) | GET, POST · GET, PATCH, DELETE | |
| `/api/videos` | GET, POST | Video mẫu |
| `/api/sites` (+`/[id]`) | GET | |
| `/api/users` (+`/[id]`) | GET · GET, PATCH, DELETE | |
| `/api/alert-rules` (+`/[id]`) | GET, POST · PATCH, DELETE | Site-scoped |
| `/api/settings/telegram` (+`/test`) | GET, POST · POST | |
| `/api/roboflow` | POST | Admin |

---

## 6. AI Pipeline (tóm tắt)

`yolo_inference.py` mở mỗi camera một luồng (video mẫu / webcam / RTSP), `PPEViolationTracker.process_frame()` trả về khung người + khung từng món PPE (xanh = có, đỏ = thiếu). Vi phạm **chốt** khi conf ≥ 0.6 và thiếu liên tục ≥ 3s → snapshot → `POST /api/violations` → Telegram theo `AlertRule`. Bắt buộc: mũ, áo, găng, giày. Nghiệm thu bằng `eval_ppe_decision.py` (báo oan / bỏ lọt) chứ không dùng mAP. Chi tiết: `wiki/06-tich-hop-yolo.md`.

---

## 7. Môi trường & vận hành

- Dev: `npm run dev` (dev-all.sh) — Next 3000 + Bridge 4001 + Python. Env bắt buộc: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_YOLO_SERVER_URL`, `AI_ENGINE_SECRET`, `TELEGRAM_ENCRYPT_KEY`.
- File `.pt` không commit, chép tay vào gốc repo (README "File model cần có").
- Prod: chưa có pipeline build/deploy; định hướng Postgres + artifact build (`npm run build`).

---

## 8. Việc còn lại

Xem `wiki/07-lo-trinh-phat-trien.md` (đã xong / ưu tiên 1-3 / câu hỏi mở). Tóm tắt: giảm báo oan găng/giày ≤ 1%, lọc theo Zone, trang `/reports` `/profile`, chuyển KPI camera khỏi mock, auth cho bridge, Postgres prod.

---

## 9. Lịch sử

- 2026-04-27: bản đầu (Orbis) — UI 9/11 trang, API mock, YOLO chưa tích hợp.
- 2026-09-07: chuẩn hoá theo code — DB thật, AI end-to-end, Telegram, camera thật, voice alert, Roboflow đối chiếu.
