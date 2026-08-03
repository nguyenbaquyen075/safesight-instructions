# SPEC.md — SafeSight Instruction Frontend

> _Cập nhật: 2026-04-27 bởi Orbis_
> _Source: Phân tích codebase + Prisma schema + mock data_
> _Git: `main` (c8ce247) — đã merge feat/yolo-integration ✅_

---

## 1. Project Identity

| Trường | Giá trị |
|---|---|
| **Tên** | SafeSight AI — PPE Violation Detection System |
| **Tên viết tắt** | SafeSight |
| **Nhóm** | AHV Works / PPP Safety |
| **Workspace** | `/data/projects/ppp-safety/safesight-instruction-frontend/` |
| **Git branch** | `main` (c8ce247 — fix build, 2026-04-27) |
| **Version** | v0.1.0 |
| **Trạng thái** | 🟡 **MVP — đang phát triển** |

---

## 2. Tech Stack

| Layer | Công nghệ |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS + CSS Variables (design tokens) |
| UI Components | Radix UI + shadcn/ui |
| Auth | NextAuth.js v5 (Prisma Adapter) |
| ORM | Prisma 7 + `@prisma/adapter-pg` (driver adapter) |
| Database | PostgreSQL (DATABASE_URL required) |
| State | Tanstack React Query v5 |
| Charts | Recharts |
| Icons | Lucide React |
| AI Model | YOLO (Python inference server — xem mục 6) |

---

## 3. Domain Model (Prisma Schema)

```
Organization (tenant)
  └── Site (công trường)
        └── Camera (camera giám sát)
              └── Zone (vùng nhận diện)
                    └── Violation (vi phạm)
                          └── Alert (cảnh báo)
                                └── AlertRule (quy tắc cảnh báo)
```

**Enums định nghĩa:**
- `ViolationType` — 16 loại: HARD_HAT, SAFETY_VEST, SAFETY_HARNESS, ZONE_INTRUSION, FALL_DETECTED, FIRE_SMOKE, VEHICLE_PROXIMITY, PHONE_USE, RUNNING, v.v.
- `Severity` — CRITICAL / HIGH / MEDIUM / LOW
- `CameraStatus` — ONLINE / OFFLINE / DEGRADED / MAINTENANCE
- `AlertStatus` — NEW / ACKNOWLEDGED / ESCALATED / RESOLVED / SUPPRESSED
- `AlertChannel` — IN_APP / SMS / EMAIL / SIREN / PA_SYSTEM / WEBHOOK
- `UserRole` — SUPER_ADMIN / ORG_ADMIN / SITE_MANAGER / SAFETY_OFFICER / SUPERVISOR
- `SiteStatus` — ACTIVE / INACTIVE / SETUP
- `ZoneType` — RESTRICTED / WARNING / MONITORING / SUSPENDED_LOAD

---

## 4. Page Inventory

| Route | Status | Ghi chú |
|---|---|---|
| `/login` | ✅ UI hoàn chỉnh | NextAuth sign-in |
| `/dashboard` | ✅ UI + API + hooks | KPI, charts, alerts timeline, site status |
| `/alerts` | ✅ UI + API + hooks | Alert list với filter severity/search |
| `/analytics` | ✅ UI + API + hooks | Compliance trend + violation donut (đã fix data wiring) |
| `/cameras` | ✅ UI + API + hooks | Camera grid + status |
| `/violations` | ✅ UI + API + hooks | Violations table + detail modal |
| `/sites` | ✅ UI + API + hooks | Site management + register modal |
| `/users` | ✅ UI + API + hooks | User management |
| `/settings` | ✅ UI | Settings page |
| `/reports` | ❌ Chưa có page | Cần tạo |
| `/profile` | ❌ Chưa có page | Cần tạo |

**Độ phủ: 9/11 pages ✅**

---

## 5. API Routes Inventory

| Route | Method | Status | Ghi chú |
|---|---|---|---|
| `/api/auth/[...nextauth]` | * | ✅ | NextAuth handler |
| `/api/dashboard/kpis` | GET | ✅ Mock | KPI metrics |
| `/api/dashboard/compliance-trend` | GET | ✅ Mock | 30-day trend |
| `/api/dashboard/violation-breakdown` | GET | ✅ Mock | Violation types breakdown |
| `/api/cameras` | GET | ✅ Mock | Camera list |
| `/api/cameras/[id]` | GET | ✅ Mock | Camera detail |
| `/api/violations` | GET | ✅ Mock | Violation list |
| `/api/violations/[id]` | GET | ✅ Mock | Violation detail |
| `/api/sites` | GET | ✅ Mock | Site list |
| `/api/sites/[id]` | GET | ✅ Mock | Site detail |
| `/api/alerts` | GET | ✅ Mock | Alert list |
| `/api/users` | GET | ✅ Mock | User list |
| `/api/users/[id]` | GET | ✅ Mock | User detail |

**⚠️ Tất cả API routes hiện tại trả về mock data. Cần kết nối Prisma → PostgreSQL để lấy dữ liệu thật.**

---

## 6. React Query Hooks

| Hook | File | Nguồn |
|---|---|---|
| `useDashboardKPIs` | `use-dashboard.ts` | `/api/dashboard/kpis` |
| `useComplianceTrend` | `use-dashboard.ts` | `/api/dashboard/compliance-trend` |
| `useViolationBreakdown` | `use-dashboard.ts` | `/api/dashboard/violation-breakdown` |
| `useCameras` | `use-cameras.ts` | `/api/cameras` |
| `useViolations` | `use-violations.ts` | `/api/violations` |
| `useAlerts` | `use-alerts.ts` | `/api/alerts` |
| `useSites` | `use-sites.ts` | `/api/sites` |
| `useUsers` | `use-users.ts` | `/api/users` |
| `useYolo` | `useYolo.ts` | WebSocket → YOLO inference server |

---

## 7. YOLO Integration (Chưa hoàn thiện)

**Files tồn tại:**
- `src/hooks/useYolo.ts` — WebSocket hook
- `yolo_bridge.js` — JavaScript bridge
- `yolo_inference.py` — Python inference script
- `yolov8n.pt` — YOLOv8 nano weights
- `public/videos/` — Sample videos

**⚠️ YOLO inference server cần chạy riêng (Python). Frontend gọi qua WebSocket.**

---

## 8. Git Branches — Trạng thái

| Branch | Status |
|---|---|
| `main` | ✅ Đã push c8ce247 (2026-04-27) |
| `develop` | ⚠️ Cần check — chưa merge vào main |
| `feat/yolo-integration` | ✅ Đã merge vào main |
| `feature/frontend-v2` | 🔴 Chưa merge — 51K lines thay đổi, cần review |
| `feature/all-frontend` | ✅ = main |

---

## 9. Issues đã fix (2026-04-27)

| # | Lỗi | Fix |
|---|---|---|
| 1 | Filter state type mismatch (alerts, sites, violations pages) | Union type đúng: `'TẤT CẢ' \| 'NGHIÊM TRỌNG' \| 'CAO'` |
| 2 | Chart components không có data props | Import hooks + truyền data |
| 3 | `res.json()` không infer kiểu | Explicit `Promise<T>` return type |
| 4 | Prisma v7 yêu cầu driver adapter | Chuyển sang `@prisma/adapter-pg` + lazy init |
| 5 | `DATABASE_URL` missing khi build | Thêm `.env` placeholder |
| 6 | `violation.severity === 'CRITICAL'` (string thay vì enum) | Dùng `Severity.CRITICAL` |

---

## 10. Recommended Next Steps (Priority Order)

```
Priority 1 — Kết nối Database thật:
  1. Setup PostgreSQL + chạy migrations
  2. Kết nối Prisma → API routes (thay mock → real DB queries)
  3. Setup authentication (NextAuth v5)

Priority 2 — Hoàn thiện Pages còn thiếu:
  4. Reports page (CSV/PDF export)
  5. Profile page

Priority 3 — Nâng cao:
  6. Review `feature/frontend-v2` — 51K lines có thể là version hoàn chỉnh hơn
  7. YOLO inference server — cần Python FastAPI backend riêng
  8. Real-time alerts — WebSocket/SSE
  9. RBAC guards + audit log UI
  10. Mobile responsive audit
```

---

## 11. Open Questions

- [ ] `DATABASE_URL` — PostgreSQL connection string thực tế là gì?
- [ ] YOLO inference server — chạy ở đâu? (local? VPS? GPU server?)
- [ ] `feature/frontend-v2` — merge hay discard?
- [ ] `develop` branch — cần merge vào `main` không?
- [ ] NextAuth provider nào? (GitHub, Google, Credentials?)
- [ ] Ưu tiên tiếp theo: BE API hay pages còn thiếu?
