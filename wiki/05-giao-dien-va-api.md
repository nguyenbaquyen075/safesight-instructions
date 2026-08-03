# 05 — Giao diện & API

## Danh mục trang (route)

Nhóm layout `(dashboard)` dùng chung Sidebar + Header (`src/components/layout/`).

| Route | File | Trạng thái |
|---|---|---|
| `/login` | `src/app/login/page.tsx` | ✅ UI (NextAuth sign-in) |
| `/` (dashboard) | `src/app/(dashboard)/page.tsx` | ✅ KPI, charts, alerts timeline, site status |
| `/alerts` | `(dashboard)/alerts/page.tsx` | ✅ Danh sách cảnh báo + filter |
| `/analytics` | `(dashboard)/analytics/page.tsx` | ✅ Xu hướng tuân thủ + donut vi phạm |
| `/cameras` | `(dashboard)/cameras/page.tsx` | ✅ Lưới camera + trạng thái |
| `/violations` | `(dashboard)/violations/page.tsx` | ✅ Bảng vi phạm + modal chi tiết |
| `/sites` | `(dashboard)/sites/page.tsx` | ✅ Quản lý công trường |
| `/users` | `(dashboard)/users/page.tsx` | ✅ Quản lý người dùng |
| `/settings` | `(dashboard)/settings/page.tsx` | ✅ Cài đặt |
| `/reports` | — | ❌ Chưa có (cần tạo) |
| `/profile` | — | ❌ Chưa có (cần tạo) |

**Độ phủ: 9/11 trang.**

## Danh mục API route

> ⚠️ **Tất cả API hiện trả về mock data** — chưa nối Prisma → DB thật.

| Route | Method | File |
|---|---|---|
| `/api/auth/[...nextauth]` | * | `api/auth/[...nextauth]/route.ts` |
| `/api/dashboard/kpis` | GET | `api/dashboard/kpis/route.ts` |
| `/api/dashboard/compliance-trend` | GET | `api/dashboard/compliance-trend/route.ts` |
| `/api/dashboard/violation-breakdown` | GET | `api/dashboard/violation-breakdown/route.ts` |
| `/api/cameras` · `/api/cameras/[id]` | GET | `api/cameras/…` |
| `/api/violations` · `/api/violations/[id]` | GET | `api/violations/…` |
| `/api/sites` · `/api/sites/[id]` | GET | `api/sites/…` |
| `/api/alerts` | GET | `api/alerts/route.ts` |
| `/api/users` · `/api/users/[id]` | GET | `api/users/…` |

## React Query hooks

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
| `useYolo` | `useYolo.ts` | WebSocket → YOLO Bridge |

## Component chính (`src/components/`)

- **layout/** — `Sidebar.tsx`, `Header.tsx`
- **dashboard/** — `AlertTimeline.tsx`, `ComplianceChart.tsx`, `SiteStatusGrid.tsx`, `ViolationDonut.tsx`
- **alerts/** — `AlertsTable.tsx`
- **cameras/** — `CameraCard.tsx`, `CameraGrid.tsx`
- **violations/** — `ViolationsTable.tsx`
- **users/** — `UserTable.tsx`, `UserEditDialog.tsx`
- **Providers.tsx** — React Query + các provider toàn cục

## Stack UI

Next.js 15 (App Router) · TypeScript strict · Tailwind CSS + design tokens · Radix UI / shadcn/ui · Recharts · Lucide React.

---
👉 Tiếp theo: [Tích hợp YOLO](06-tich-hop-yolo.md)
