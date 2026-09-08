# 05 — Giao diện & API

## Landing page công khai

Thiết kế industrial editorial: hero hai cột ảnh/chữ, preview riêng tại `#product-preview`, tính năng đánh số và quy trình hai cột. Mobile hero xếp dọc; giữ các anchor cũ. Hai theme ivory/charcoal-green được định nghĩa riêng trong `landing-page/styles.css`.

`landing-page/index.html` chạy độc lập trên GitHub Pages, không phải route Next.js, không thay `/` hoặc `/login`. Theme sáng/tối chỉ áp dụng landing, lưu bằng `safesight-theme`, mặc định theo hệ thống. Menu mobile hỗ trợ Escape; FAQ dùng `details/summary`; CTA dẫn tài liệu và mã nguồn thật, không gọi API. Ảnh và khung PPE ở hero được ghi rõ là minh họa. Xem local bằng cách mở file HTML; không cần khởi động DB, AI hoặc Agent.

## Danh mục trang (route)

Nhóm layout `(dashboard)` dùng chung Sidebar + Header (`src/components/layout/`). Quyền xem trang theo vai trò khai báo một chỗ ở `src/lib/auth/permissions.ts` (`PAGE_ROLES`), Sidebar ẩn menu và `DashboardLayout` chặn truy cập thẳng bằng URL.

Badge số ở mục "Thông báo" của Sidebar lấy từ DB qua `useOpenViolationCount()` (`GET /api/violations/count` trả `{ open, openIds }` theo phạm vi site, chỉ id, không join) — không tải cả danh sách vi phạm, không còn đọc `localStorage['safesight_alerts']`. Số hiển thị = vi phạm `open` trừ các id đã đánh dấu "đã đọc" ở `/alerts` (`useReadAlertIds()` trong `src/hooks/use-read-alerts.ts`, nguồn `localStorage['safesight_read_alerts']`), nên "Đánh dấu tất cả đã đọc" phản ánh đúng lên badge. Badge ẩn khi 0, hiển thị `99+` khi vượt 99.

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
| `/settings` | `(dashboard)/settings/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Giám sát (camera thật/video mẫu), Telegram bot, Zalo OA, quy tắc cảnh báo |
| `/settings` | `(dashboard)/settings/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Giám sát (camera thật/video mẫu), Telegram bot, quy tắc cảnh báo, tab "Nhật ký" (`AuditLogCard`, đọc `GET /api/audit-log`) |
| `/agent` | `(dashboard)/agent/page.tsx` | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER | Dòng thời gian `AgentEvent`, hàng đợi task, sweep gần nhất, cài đặt, mục "Subagent theo camera" (lưới `CameraAgentCard`: bật/tắt, nhịp tổng hợp, token hôm nay/trần, digest gần nhất, vi phạm mở, báo oan 24h, 3 ghi chú mới nhất, "Tổng hợp ngay", "Xoá trí nhớ"), ô hỏi toàn hệ thống, capabilities |
| `/profile` | `(dashboard)/profile/page.tsx` | tất cả (không có trong `PAGE_ROLES` → mở cho mọi vai trò) | Xem tên/email/vai trò (chỉ đọc) + form đổi mật khẩu (`PATCH /api/users/me/password`); vào từ menu avatar ở Header |
| `/reports` | — | — | ❌ Chưa có |

Quên mật khẩu (đặt lại khi không nhớ mật khẩu cũ) chưa làm — cần gửi email, để lại backlog.

## Danh mục API route (`src/app/api/`)

Tất cả route đọc/ghi DB thật qua Prisma (`src/lib/prisma.ts`). Middleware (`src/proxy.ts`) **không** chạy trên `/api`, nên mỗi handler tự kiểm quyền bằng `src/lib/auth/site-access.ts`: `requireSession()` (401 khi chưa đăng nhập), `allowedSiteIds()` (null = vai trò toàn tổ chức SUPER_ADMIN/ORG_ADMIN, ngược lại là `assignedSites`), `assertSiteAccess()` (403 khi đụng site ngoài phạm vi). Danh sách vi phạm/camera/công trường lọc sẵn theo `allowedSiteIds()`; xin `?siteId=` ngoài phạm vi trả 403.

`src/lib/audit-log.ts` (`logAudit({ session, action, resource, resourceId?, details?, request? })`) ghi 1 dòng `AuditLog` cho mọi POST/PATCH/DELETE đáng chú ý (người dùng, camera, quy tắc cảnh báo, Telegram, cài đặt agent, subagent camera); IP lấy từ header `x-forwarded-for` (hop đầu), mặc định `'local'`. Không bao giờ throw — audit log hỏng không được làm hỏng thao tác chính.

| Route | Method | Ghi chú |
|---|---|---|
| `/api/auth/[...nextauth]` | * | NextAuth handler |
| `/api/violations` | GET, POST | GET cần session, lọc `siteId/type/severity/status` bằng SQL và theo phạm vi site; POST chỉ cho AI engine, bắt buộc header `X-AI-Engine-Secret` (không có session) rồi gọi `notifyViolation()` (Telegram / Zalo OA / webhook ký HMAC) |
| `/api/violations/count` | GET | Cần session; `{ open, openIds }` theo phạm vi site — badge Sidebar dùng thay vì tải cả danh sách |
| `/api/violations/[id]` | GET, PATCH, DELETE | Chi tiết / đổi trạng thái / xoá; cả 3 method kiểm `assertSiteAccess` |
| `/api/cameras` | GET, POST | Danh sách (cần session, lọc theo phạm vi site) + thêm camera thật (`assertSiteAccess`) |
| `/api/cameras/[id]` | GET, PATCH, DELETE | Sửa nguồn (`rtspUrl`), trạng thái, xoá; cả 3 method kiểm `assertSiteAccess`. DELETE xoá luôn dòng `CameraAgent` cùng id (không có quan hệ Prisma) |
| `/api/cameras/[id]/zones` | GET, PUT | Vùng nhận diện (Zone `type=MONITORING`) của camera; `assertSiteAccess`. PUT thay TOÀN BỘ danh sách (`{ zones: [{ name?, points: [{x,y}] }] }`, tối đa 10 vùng, mỗi vùng 3–20 điểm toạ độ tỉ lệ 0–1); `zones: []` = xoá hết. AI engine tự đọc lại bảng `Zone` mỗi 60s |
| `/api/cameras` | GET, POST | Danh sách (cần session, lọc theo phạm vi site) + thêm camera thật (`assertSiteAccess`); POST ghi `AuditLog` |
| `/api/cameras/[id]` | GET, PATCH, DELETE | Sửa nguồn (`rtspUrl`), trạng thái, xoá; cả 3 method kiểm `assertSiteAccess`. DELETE xoá luôn dòng `CameraAgent` cùng id (không có quan hệ Prisma); PATCH/DELETE ghi `AuditLog` |
| `/api/observations` | POST | Chỉ cho AI engine (header `X-AI-Engine-Secret`, không session): `{ observations: [{ cameraId, minute (ISO phút), persons, personSeconds }] }` tối đa 200 dòng; upsert `ObservationStat` theo `(cameraId, minute)` nên gửi lại cùng một phút không nhân đôi mẫu số; `siteId` suy từ Camera, camera đã xoá thì bỏ qua dòng đó. Trả 201 `{ upserted }` |
| `/api/stats/compliance` | GET | Cần session; `?siteId&from&to` (mặc định 30 ngày, trần 366 ngày) → mảng theo ngày `{ day, personMinutes, violations, complianceRate }`; `complianceRate` = `1 − vi_phạm / max(phút_người, 1)` (0–1), `null` khi ngày đó chưa có quan sát. Hàm thuần `complianceByDay()` ở `src/lib/compliance-shape.ts` |
| `/api/videos` | GET, POST | Liệt kê / tải video mẫu vào `public/videos/` |
| `/api/sites`, `/api/sites/[id]` | GET | Công trường; cần session, chỉ trả site trong `assignedSites` |
| `/api/users`, `/api/users/[id]` | GET, POST · GET, PATCH, DELETE | Người dùng; chỉ SUPER_ADMIN/ORG_ADMIN (khớp `PAGE_ROLES['/users']`). POST: zod `createUserSchema` (`src/lib/user-shape.ts`: `name`, `email`, `password` ≥ 8, `role` enum, `assignedSites`), băm mật khẩu bằng `bcryptjs`, `orgId` lấy theo tổ chức của người tạo (fallback tổ chức đầu tiên cho tài khoản dev cứng không có dòng User), 409 khi email trùng. POST/PATCH/DELETE đều ghi `AuditLog` |
| `/api/users/me/password` | PATCH | `{ currentPassword, newPassword ≥ 8 }`; xác minh mật khẩu cũ bằng bcrypt, 400 khi sai hoặc khi tài khoản không có `passwordHash` (tài khoản dev cứng); ghi `AuditLog` |
| `/api/audit-log` | GET | SUPER_ADMIN/ORG_ADMIN; `?limit` (mặc định 50, tối đa 200) `&resource` |
| `/api/alert-rules` | GET, POST | Quy tắc cảnh báo theo site; POST ghi `AuditLog` |
| `/api/alert-rules/[id]` | PATCH, DELETE | Cả 2 ghi `AuditLog` |
| `/api/settings/telegram` | GET, POST | Lưu bot token (mã hoá) + bật/tắt; POST ghi `AuditLog` (không log token thô) |
| `/api/settings/telegram/test` | POST | Gọi `getMe` kiểm tra token |
| `/api/settings/zalo` | GET, POST | Lưu access token OA (mã hoá) + bật/tắt |
| `/api/settings/zalo/test` | POST | Gọi `getoa` kiểm tra access token |
| `/api/roboflow` | POST | Gọi Roboflow Workflow phía server, giữ API key; chỉ admin |
| `/api/agent/tasks` | GET | `?status=open\|done&subjectType&subjectId` |
| `/api/agent/events` | GET | `?sessionId\|subjectType&subjectId&since` |
| `/api/agent/settings` | GET, PATCH | SUPER_ADMIN/ORG_ADMIN; PATCH ghi `AuditLog` |
| `/api/agent/ask` | POST | `{ subjectType?, subjectId?, sessionId?, message }` → ghi `AgentEvent`, tạo/nối `AgentTask kind=ask`, poke agent, trả `sessionId` |
| `/api/agent/cameras` | GET | Cần session; mỗi camera trong phạm vi site → cài đặt subagent + `memory[]` + `openViolations`, `reviewed24h`, `falsePositiveRate24h`. Camera chưa có dòng `CameraAgent` trả giá trị mặc định với `exists: false` (**không** upsert khi đọc) |
| `/api/agent/cameras/[id]` | PATCH | SUPER_ADMIN/ORG_ADMIN; `{ isEnabled?, digestEveryMin? 5–1440, dailyTokenCap? ≥ 0, clearMemory?: true }`; upsert `CameraAgent`, `clearMemory` đặt `memory = '[]'`; ghi `AgentEvent action { action: 'camera-agent.settings', changes, userId }` và `AuditLog` |
| `/api/agent/cameras/[id]/digest` | POST | `assertSiteAccess` theo site của camera; xếp `AgentTask kind=camera.digest` (priority 60, gộp với lần hẹn đang chờ) + poke; trả 202 `{ taskId }`, 404 khi camera không tồn tại |

## React Query hooks (`src/hooks/`)

| Hook | File | Nguồn |
|---|---|---|
| `useViolations`, `useOpenViolationCount` | `use-violations.ts` | `/api/violations`, `/api/violations/count` |
| `useCameras`, `useCreateCamera`, `useUpdateCamera`, `useDeleteCamera`, `useCameraZones`, `useSaveCameraZones` | `use-cameras.ts` | `/api/cameras`, `/api/cameras/[id]/zones` |
| `useSites`, `useSite` | `use-sites.ts` | `/api/sites` |
| `useUsers`, `useUser`, `useCreateUser`, `useUpdateUser`, `useDeleteUser`, `useChangePassword` | `use-users.ts` | `/api/users`, `/api/users/me/password` |
| `useAuditLog` | `use-audit-log.ts` | `/api/audit-log` |
| `useAlertRules` + mutation | `use-alert-rules.ts` | `/api/alert-rules` |
| `useTelegramSettings` + mutation | `use-telegram-settings.ts` | `/api/settings/telegram` |
| `useZaloSettings` + mutation | `use-zalo-settings.ts` | `/api/settings/zalo` |
| `useDashboardKPIs`, `useComplianceTrend`, `useViolationBreakdown`, `useComplianceStats` | `use-dashboard.ts` | `useViolations` + `/api/stats/compliance` (tỉ lệ tuân thủ thật; ngày chưa có quan sát mới rơi về ước lượng `rateFromCount` và KPI hiện nhãn "ước tính"); số camera online đếm từ `useCameras()` |
| `useRealSitesFromCameras` | `use-real-sites.ts` | Gom site từ roster camera + vi phạm thật |
| `useYolo` | `useYolo.ts` | Socket.IO → YOLO Bridge (`NEXT_PUBLIC_YOLO_SERVER_URL`) |
| `useVoiceRecorder` | `useVoiceRecorder.ts` | `MediaRecorder` cho nút mic |
| `useAgentTasks`, `useAgentEvents` (poll khi thread đang chạy), `useAgentSettings`, `useSaveAgentSettings`, `useAskAgent` | `use-agent.ts` | `/api/agent/*` |
| `useCameraAgents` (poll 15s), `useSaveCameraAgent`, `useDigestCamera` | `use-agent.ts` | `/api/agent/cameras*` |

## Component chính (`src/components/`)

- **layout/** — `Sidebar.tsx`, `Header.tsx`
- **dashboard/** — `AlertTimeline.tsx`, `ComplianceChart.tsx`, `SiteStatusGrid.tsx`, `ViolationDonut.tsx`
- **cameras/** — `CameraCard.tsx`, `CameraGrid.tsx`, `MicButton.tsx`, `WebcamPreview.tsx`
- **violations/** — `ViolationsTable.tsx`, `ViolationDetailModal.tsx`
- **alerts/** — `AlertsTable.tsx`
- **settings/** — `CameraMonitoringCard.tsx`, `CameraEditDialog.tsx`, `TelegramBotCard.tsx`, `ZaloOaCard.tsx`, `AlertRulesCard.tsx`, `AlertRuleEditDialog.tsx` (người nhận nhập theo từng kênh đang bật), `ui.tsx`
- **sites/** — `SiteDetailModal.tsx` · **users/** — `UserTable.tsx`, `UserEditDialog.tsx`
- **settings/** — `CameraMonitoringCard.tsx`, `CameraEditDialog.tsx`, `TelegramBotCard.tsx`, `AlertRulesCard.tsx`, `AlertRuleEditDialog.tsx`, `AuditLogCard.tsx`, `ui.tsx`
- **sites/** — `SiteDetailModal.tsx` · **users/** — `UserTable.tsx`, `UserEditDialog.tsx`, `AddUserDialog.tsx`
- **agent/** — `AgentTimeline.tsx`, `AgentReviewCard.tsx`, `AskAgentBox.tsx`, `SubjectAgentPanel.tsx`, `BandBadge.tsx`, `CameraAgentCard.tsx` (tab/khối Agent trong modal vi phạm/camera/site + trang `/agent`). `SubjectAgentPanel` với `subjectType="camera"` hiện thêm khối đầu panel: trạng thái subagent (bật/tắt), token hôm nay/trần, digest gần nhất và **toàn bộ** trí nhớ camera — lấy từ `useCameraAgents()` lọc theo `cameraId` (không gọi API này ở modal vi phạm/công trường)
- **ui/** — shadcn/Radix primitives, `Toaster.tsx` · **Providers.tsx** — React Query + session

## Dữ liệu mock còn lại

`src/data/mock-cameras.ts` và `mock-violations.ts` vẫn được dùng làm **roster camera demo** (tên/site cho ô camera) và dữ liệu mẫu cho một vài modal. Vi phạm hiển thị là dữ liệu thật từ DB; KPI camera online của bảng điều khiển đã chuyển sang `useCameras()` (dữ liệu thật).

## Stack UI

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS 4 · Radix UI / shadcn/ui · Tanstack Query 5 · Recharts · Lucide React · Zod.

---
👉 Tiếp theo: [Tích hợp YOLO](06-tich-hop-yolo.md)
