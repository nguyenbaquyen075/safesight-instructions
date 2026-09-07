# 05 — Giao diện & API

## Landing page công khai

Thiết kế industrial editorial: hero hai cột ảnh/chữ, preview riêng tại `#product-preview`, tính năng đánh số và quy trình hai cột. Mobile hero xếp dọc; giữ các anchor cũ. Hai theme ivory/charcoal-green được định nghĩa riêng trong `landing-page/styles.css`.

`landing-page/index.html` chạy độc lập trên GitHub Pages, không phải route Next.js, không thay `/` hoặc `/login`. Theme sáng/tối chỉ áp dụng landing, lưu bằng `safesight-theme`, mặc định theo hệ thống. Menu mobile hỗ trợ Escape; FAQ dùng `details/summary`; CTA dẫn tài liệu và mã nguồn thật, không gọi API. Ảnh và khung PPE ở hero được ghi rõ là minh họa. Xem local bằng cách mở file HTML; không cần khởi động DB, AI hoặc Agent.

## Danh mục trang (route)

Nhóm layout `(dashboard)` dùng chung Sidebar + Header (`src/components/layout/`). Quyền xem trang theo vai trò khai báo một chỗ ở `src/lib/auth/permissions.ts` (`PAGE_ROLES`), Sidebar ẩn menu và `DashboardLayout` chặn truy cập thẳng bằng URL.

| Route | File | Vai trò được xem | Nội dung |
|---|---|---|---|
| `/login` | `src/app/login/page.tsx` | — | NextAuth Credentials |
| `/` | `(dashboard)/page.tsx` | tất cả | KPI, biểu đồ tuân thủ, dòng thời gian cảnh báo, trạng thái công trường |
| `/sites` | `(dashboard)/sites/page.tsx` | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER | Quản lý công trường |
| `/cameras` | `(dashboard)/cameras/page.tsx` | tất cả | Lưới camera live, khung detection từ YOLO, lọc "chỉ vi phạm", nút mic cảnh báo |
| `/site-speaker` | `(dashboard)/site-speaker/page.tsx` | tất cả | "Loa công trường": chọn camera, phát audio nhận từ mic |
| `/alerts` | `(dashboard)/alerts/page.tsx` | tất cả | Danh sách cảnh báo từ vi phạm thật |
| `/violations` | `(dashboard)/violations/page.tsx` | tất cả | Bảng vi phạm + modal chi tiết (ảnh snapshot) |
| `/analytics` | `(dashboard)/analytics/page.tsx` | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER, SAFETY_OFFICER | Xu hướng tuân thủ + donut vi phạm |
| `/roboflow` | `(dashboard)/roboflow/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Kéo thả ảnh, đối chiếu model cloud (tốn credit) |
| `/users` | `(dashboard)/users/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Quản lý người dùng |
| `/settings` | `(dashboard)/settings/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Giám sát (camera thật/video mẫu), Telegram bot, quy tắc cảnh báo |
| `/agent` | `(dashboard)/agent/page.tsx` | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER | Dòng thời gian `AgentEvent`, hàng đợi task, sweep gần nhất, cài đặt, ô hỏi toàn hệ thống, capabilities |
| `/reports`, `/profile` | — | — | ❌ Chưa có |

## Danh mục API route (`src/app/api/`)

Tất cả route đọc/ghi DB thật qua Prisma (`src/lib/prisma.ts`). Route theo site kiểm quyền bằng `assertSiteAccess()` (`src/lib/auth/site-access.ts`).

| Route | Method | Ghi chú |
|---|---|---|
| `/api/auth/[...nextauth]` | * | NextAuth handler |
| `/api/violations` | GET, POST | POST chỉ cho AI engine, bắt buộc header `X-AI-Engine-Secret`; sau khi ghi gọi `notifyViolation()` (Telegram) |
| `/api/violations/[id]` | GET, PATCH, DELETE | Chi tiết / đổi trạng thái / xoá |
| `/api/cameras` | GET, POST | Danh sách + thêm camera thật |
| `/api/cameras/[id]` | GET, PATCH, DELETE | Sửa nguồn (`rtspUrl`), trạng thái, xoá |
| `/api/videos` | GET, POST | Liệt kê / tải video mẫu vào `public/videos/` |
| `/api/sites`, `/api/sites/[id]` | GET | Công trường |
| `/api/users`, `/api/users/[id]` | GET · GET, PATCH, DELETE | Người dùng |
| `/api/alert-rules` | GET, POST | Quy tắc cảnh báo theo site |
| `/api/alert-rules/[id]` | PATCH, DELETE | |
| `/api/settings/telegram` | GET, POST | Lưu bot token (mã hoá) + bật/tắt |
| `/api/settings/telegram/test` | POST | Gọi `getMe` kiểm tra token |
| `/api/roboflow` | POST | Gọi Roboflow Workflow phía server, giữ API key; chỉ admin |
| `/api/agent/tasks` | GET | `?status=open\|done&subjectType&subjectId` |
| `/api/agent/events` | GET | `?sessionId\|subjectType&subjectId&since` |
| `/api/agent/settings` | GET, PATCH | SUPER_ADMIN/ORG_ADMIN |
| `/api/agent/ask` | POST | `{ subjectType?, subjectId?, sessionId?, message }` → ghi `AgentEvent`, tạo/nối `AgentTask kind=ask`, poke agent, trả `sessionId` |

## React Query hooks (`src/hooks/`)

| Hook | File | Nguồn |
|---|---|---|
| `useViolations` | `use-violations.ts` | `/api/violations` |
| `useCameras`, `useCreateCamera`, `useUpdateCamera`, `useDeleteCamera` | `use-cameras.ts` | `/api/cameras` |
| `useSites`, `useSite` | `use-sites.ts` | `/api/sites` |
| `useUsers` | `use-users.ts` | `/api/users` |
| `useAlertRules` + mutation | `use-alert-rules.ts` | `/api/alert-rules` |
| `useTelegramSettings` + mutation | `use-telegram-settings.ts` | `/api/settings/telegram` |
| `useDashboardKPIs`, `useComplianceTrend`, `useViolationBreakdown` | `use-dashboard.ts` | Tính từ `useViolations` (không có API riêng); số camera online lấy từ `src/data/mock-cameras.ts` |
| `useRealSitesFromCameras` | `use-real-sites.ts` | Gom site từ roster camera + vi phạm thật |
| `useYolo` | `useYolo.ts` | Socket.IO → YOLO Bridge (`NEXT_PUBLIC_YOLO_SERVER_URL`) |
| `useVoiceRecorder` | `useVoiceRecorder.ts` | `MediaRecorder` cho nút mic |
| `useAgentTasks`, `useAgentEvents` (poll khi thread đang chạy), `useAgentSettings`, `useSaveAgentSettings`, `useAskAgent` | `use-agent.ts` | `/api/agent/*` |

## Component chính (`src/components/`)

- **layout/** — `Sidebar.tsx`, `Header.tsx`
- **dashboard/** — `AlertTimeline.tsx`, `ComplianceChart.tsx`, `SiteStatusGrid.tsx`, `ViolationDonut.tsx`
- **cameras/** — `CameraCard.tsx`, `CameraGrid.tsx`, `MicButton.tsx`, `WebcamPreview.tsx`
- **violations/** — `ViolationsTable.tsx`, `ViolationDetailModal.tsx`
- **alerts/** — `AlertsTable.tsx`
- **settings/** — `CameraMonitoringCard.tsx`, `CameraEditDialog.tsx`, `TelegramBotCard.tsx`, `AlertRulesCard.tsx`, `AlertRuleEditDialog.tsx`, `ui.tsx`
- **sites/** — `SiteDetailModal.tsx` · **users/** — `UserTable.tsx`, `UserEditDialog.tsx`
- **agent/** — `AgentTimeline.tsx`, `AgentReviewCard.tsx`, `AskAgentBox.tsx`, `SubjectAgentPanel.tsx`, `BandBadge.tsx` (tab/khối Agent trong modal vi phạm/camera/site + trang `/agent`)
- **ui/** — shadcn/Radix primitives, `Toaster.tsx` · **Providers.tsx** — React Query + session

## Dữ liệu mock còn lại

`src/data/mock-cameras.ts` và `mock-violations.ts` vẫn được dùng làm **roster camera demo** (tên/site cho ô camera, KPI camera online) và dữ liệu mẫu cho một vài modal. Vi phạm hiển thị là dữ liệu thật từ DB.

## Stack UI

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Radix UI / shadcn/ui · Tanstack Query 5 · Recharts · Lucide React · Zod.

---
👉 Tiếp theo: [Tích hợp YOLO](06-tich-hop-yolo.md)
