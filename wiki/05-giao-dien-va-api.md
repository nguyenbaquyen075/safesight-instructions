# 05 — Giao diện & API

## Landing page công khai

Thiết kế industrial editorial: hero hai cột ảnh/chữ, preview riêng tại `#product-preview`, tính năng đánh số và quy trình hai cột. Mobile hero xếp dọc; giữ các anchor cũ. Hai theme ivory/charcoal-green được định nghĩa riêng trong `landing-page/styles.css`.

`landing-page/index.html` chạy độc lập trên GitHub Pages, không phải route Next.js, không thay `/` hoặc `/login`. Theme sáng/tối chỉ áp dụng landing, lưu bằng `safesight-theme`, mặc định theo hệ thống. Menu mobile hỗ trợ Escape; FAQ dùng `details/summary`; CTA dẫn tài liệu và mã nguồn thật, không gọi API. Ảnh và khung PPE ở hero được ghi rõ là minh họa. Xem local bằng cách mở file HTML; không cần khởi động DB, AI hoặc Agent.

## Danh mục trang (route)

Nhóm layout `(dashboard)` dùng chung Sidebar + Header (`src/components/layout/`). Quyền xem trang theo vai trò khai báo một chỗ ở `src/lib/auth/permissions.ts` (`PAGE_ROLES`), Sidebar ẩn menu và `DashboardLayout` chặn truy cập thẳng bằng URL.

**Responsive & PWA:** trạng thái mở/thu gọn Sidebar và trạng thái mở drawer di động dùng chung một context (`src/components/layout/sidebar-context.tsx`, `SidebarProvider`/`useSidebar`). Dưới `md` (768px) Sidebar là drawer cố định ẩn ngoài màn hình (`-translate-x-full`), mở bằng nút hamburger ở Header (`aria-expanded`), có overlay tối đóng khi bấm ra ngoài, tự đóng khi đổi route; nút thu gọn chỉ hiện từ `md` trở lên. Nội dung chính bỏ margin trái dưới `md`, chỉ áp `md:ml-[260px]`/`md:ml-[68px]` khi ở màn lớn. Ba bảng dữ liệu chính (`ViolationsTable`, `AlertsTable`, `UserTable`) dùng `hidden md:block` cho bảng và một danh sách thẻ `md:hidden` (tên/loại + badge trạng thái, camera/thời gian, hành động) thay thế dưới `md`. Ứng dụng cài được như PWA: `public/manifest.webmanifest` (icon `public/icons/icon-192.png`/`icon-512.png` sinh một lần bằng `node scripts/make-icons.mjs` từ `wiki/assets/safesight-logo.svg`), `public/sw.js` (network-first cho điều hướng, bỏ qua `/api/` và `/snapshots/`) đăng ký trong `Providers.tsx` chỉ khi `NODE_ENV === 'production'`. Chỉ cache response điều hướng khi `response.ok && !response.redirected` (một redirect như `/` → `/login` lúc chưa đăng nhập mà bị cache sẽ ném `TypeError` cho lần phục vụ offline sau); `SHELL_URLS` không precache `/`, và khi mất mạng lẫn cache đều không có, fallback là một `Response` HTML tĩnh dựng sẵn ("Mất kết nối mạng") thay vì phục vụ lại `/` đã cache.

Badge số ở mục "Thông báo" của Sidebar lấy từ DB qua `useOpenViolationCount()` (`GET /api/violations/count` trả `{ open, openIds }` theo phạm vi site, chỉ id, không join) — không tải cả danh sách vi phạm, không còn đọc `localStorage['safesight_alerts']`. Số hiển thị = vi phạm `open` trừ các id đã đánh dấu "đã đọc" ở `/alerts` (`useReadAlertIds()` trong `src/hooks/use-read-alerts.ts`, nguồn `localStorage['safesight_read_alerts']`), nên "Đánh dấu tất cả đã đọc" phản ánh đúng lên badge. Badge ẩn khi 0, hiển thị `99+` khi vượt 99.

| Route | File | Vai trò được xem | Nội dung |
|---|---|---|---|
| `/login` | `src/app/login/page.tsx` | — | NextAuth Credentials |
| `/` | `(dashboard)/page.tsx` | tất cả | KPI, biểu đồ tuân thủ, dòng thời gian cảnh báo, trạng thái công trường |
| `/sites` | `(dashboard)/sites/page.tsx` | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER | Quản lý công trường |
| `/cameras` | `(dashboard)/cameras/page.tsx` | tất cả | Lưới camera live, khung detection từ YOLO, lọc "chỉ vi phạm", nút mic cảnh báo |
| `/site-speaker` | `(dashboard)/site-speaker/page.tsx` | tất cả | "Loa công trường": chọn camera, phát audio nhận từ mic; nhận thêm `voice-announce` và đọc bằng `speechSynthesis` (`lang=vi-VN`, rate 0.95), nút "Thử loa", danh sách 10 thông báo gần nhất, cảnh báo khi trình duyệt không có Web Speech API |
| `/alerts` | `(dashboard)/alerts/page.tsx` | tất cả | Danh sách cảnh báo từ vi phạm thật |
| `/violations` | `(dashboard)/violations/page.tsx` | tất cả | Bảng vi phạm + modal chi tiết (ảnh snapshot) |
| `/analytics` | `(dashboard)/analytics/page.tsx` | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER, SAFETY_OFFICER | Xu hướng tuân thủ + donut vi phạm, bản đồ nhiệt vi phạm theo giờ×thứ và theo vị trí camera (lọc 7/30/90 ngày) |
| `/roboflow` | `(dashboard)/roboflow/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Kéo thả ảnh, đối chiếu model cloud (tốn credit) |
| `/users` | `(dashboard)/users/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Quản lý người dùng |
| `/settings` | `(dashboard)/settings/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Giám sát (camera thật/video mẫu), Telegram bot, Zalo OA, quy tắc cảnh báo |
| `/settings` | `(dashboard)/settings/page.tsx` | SUPER_ADMIN, ORG_ADMIN | Giám sát (camera thật/video mẫu), Telegram bot, quy tắc cảnh báo, tab "Nhật ký" (`AuditLogCard`, đọc `GET /api/audit-log`) |
| `/agent` | `(dashboard)/agent/page.tsx` | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER | Dòng thời gian `AgentEvent`, hàng đợi task, sweep gần nhất, cài đặt, mục "Subagent theo camera" (lưới `CameraAgentCard`: bật/tắt, nhịp tổng hợp, token hôm nay/trần, digest gần nhất, vi phạm mở, báo oan 24h, 3 ghi chú mới nhất, "Tổng hợp ngay", "Xoá trí nhớ"), thẻ "Độ chính xác của agent" (chọn 7/30 ngày, nguồn `GET /api/stats/agent-accuracy`: đã phán quyết / có phản hồi / tỉ lệ sai, bảng theo camera và theo loại vi phạm), ô hỏi toàn hệ thống dạng bong bóng chat (`AskAgentBox`), capabilities |
| *(mọi trang)* | `components/agent/AgentChatWidget.tsx` (gắn ở `(dashboard)/layout.tsx`) | như trang đang xem | Widget **Trợ lý SafeSight** nổi góc phải dưới: nút tròn mở panel chat toàn hệ thống (`useAskSession` + `ChatThread`/`ChatComposer`, gửi qua `POST /api/agent/ask`, poll `/api/agent/events?sessionId`), ẩn trên `/agent` và khi in |
| `/profile` | `(dashboard)/profile/page.tsx` | tất cả (không có trong `PAGE_ROLES` → mở cho mọi vai trò) | Xem tên/email/vai trò (chỉ đọc) + form đổi mật khẩu (`PATCH /api/users/me/password`); vào từ menu avatar ở Header |
| `/reports` | `(dashboard)/reports/page.tsx` | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER | Lọc công trường/camera/khoảng ngày (mặc định 7 ngày), 4 ô số tổng, bảng tổng hợp theo camera, bảng chi tiết (200 dòng mới nhất), "Xuất CSV" (Blob UTF-8 có BOM, đủ số dòng API trả), "In / PDF" (`window.print()`), nút "Xuất phản hồi agent (CSV)" (link mở tab mới tới `GET /api/reports/agent-feedback` kèm bộ lọc đang chọn), mục "Việc khắc phục" (việc còn mở/quá hạn gộp theo công trường + 20 việc quá hạn đầu, nguồn `GET /api/actions`), báo cáo tuần mới nhất của agent |

Bản in của `/reports` dùng khối `@media print` ở cuối `src/app/globals.css`: đổi token màu sang nền sáng (giao diện nền tối in ra giấy sẽ mất chữ), ẩn `aside`/`header`/`.no-print`, bỏ `margin-left` của khung nội dung (`print:ml-0` trong `(dashboard)/layout.tsx`).

Quên mật khẩu (đặt lại khi không nhớ mật khẩu cũ) chưa làm — cần gửi email, để lại backlog.

## Danh mục API route (`src/app/api/`)

Tất cả route đọc/ghi DB thật qua Prisma (`src/lib/prisma.ts`). Middleware (`src/proxy.ts`) **không** chạy trên `/api`, nên mỗi handler tự kiểm quyền bằng `src/lib/auth/site-access.ts`: `requireSession()` (401 khi chưa đăng nhập), `allowedSiteIds()` (null = vai trò toàn tổ chức SUPER_ADMIN/ORG_ADMIN, ngược lại là `assignedSites`), `assertSiteAccess()` (403 khi đụng site ngoài phạm vi). Danh sách vi phạm/camera/công trường lọc sẵn theo `allowedSiteIds()`; xin `?siteId=` ngoài phạm vi trả 403.

`src/lib/audit-log.ts` (`logAudit({ session, action, resource, resourceId?, details?, request? })`) ghi 1 dòng `AuditLog` cho mọi POST/PATCH/DELETE đáng chú ý (người dùng, camera, quy tắc cảnh báo, Telegram, cài đặt agent, subagent camera); IP lấy từ header `x-forwarded-for` (hop đầu), mặc định `'local'`. Không bao giờ throw — audit log hỏng không được làm hỏng thao tác chính.

| Route | Method | Ghi chú |
|---|---|---|
| `/api/auth/[...nextauth]` | * | NextAuth handler |
| `/api/violations` | GET, POST | GET cần session, lọc `siteId/type/severity/status` bằng SQL và theo phạm vi site; POST chỉ cho AI engine, bắt buộc header `X-AI-Engine-Secret` (không có session), nhận thêm `clipUrl` tuỳ chọn (clip bằng chứng ~8s) rồi gọi `notifyViolation()` (Telegram / Zalo OA / webhook ký HMAC) |
| `/api/violations/count` | GET | Cần session; `{ open, openIds }` theo phạm vi site — badge Sidebar dùng thay vì tải cả danh sách |
| `/api/violations/[id]` | GET, PATCH, DELETE | Chi tiết / đổi trạng thái / xoá; cả 3 method kiểm `assertSiteAccess` |
| `/api/violations/[id]/feedback` | PATCH | Người chấm phán quyết của agent; cần session + `assertSiteAccess` theo site của vi phạm. Body zod `{ correct: boolean, note?: ≤ 300 }` (`reviewFeedbackSchema` trong `src/lib/agent-accuracy-shape.ts`); vi phạm chưa có `agentReview` → **409**. Ghi đè phản hồi cũ (chỉ giữ lần chấm mới nhất), ghi `AuditLog` `violation.review.feedback`, trả DTO vi phạm |
| `/api/violations/[id]/actions` | GET, POST | Việc khắc phục của một vi phạm; cả 2 cần session + `assertSiteAccess` theo site của vi phạm. POST: zod `createActionSchema` (`src/lib/corrective-action-shape.ts`: `assigneeId?`, `assigneeName` 2–80, `description` 5–500, `dueAt` ISO **ở tương lai**, thiếu thì mặc định +24 h); vi phạm đang `OPEN` được chuyển sang `UNDER_REVIEW`; ghi `AuditLog` `violation.action.create`, trả 201 `CorrectiveActionDTO` |
| `/api/actions/[id]` | PATCH | Cần session + `assertSiteAccess` theo site của việc; zod `updateActionSchema` (`status` `OPEN`/`DONE`/`CANCELLED`, `evidenceNote?` ≤ 500). `DONE` ghi `completedAt`; khi vi phạm không còn việc `OPEN` nào và đã có ít nhất một việc `DONE` thì vi phạm chuyển `RESOLVED`. Ghi `AuditLog` `violation.action.update` |
| `/api/actions` | GET | Cần session; `?siteId&status=open\|overdue&limit` (mặc định 100, kẹp trong 1–200). Luôn chỉ trả việc `OPEN`; `overdue` lọc thêm `dueAt < now`. Không có `siteId` thì lọc theo `allowedSiteIds()`; xin site ngoài phạm vi → 403. Nguồn của mục "Việc khắc phục" ở `/reports` |
| `/api/cameras/[id]` | GET, PATCH, DELETE | Sửa nguồn (`rtspUrl`), trạng thái, xoá; cả 3 method kiểm `assertSiteAccess`. DELETE xoá luôn dòng `CameraAgent` cùng id (không có quan hệ Prisma) |
| `/api/cameras/[id]/zones` | GET, PUT | Vùng của camera, **mọi loại** (`MONITORING`/`RESTRICTED`/`WARNING`/`SUSPENDED_LOAD`); `assertSiteAccess`. GET mở cho mọi vai trò có quyền xem site đó; PUT thêm điều kiện SUPER_ADMIN/ORG_ADMIN (khớp `PAGE_ROLES['/settings']` — lối vào duy nhất trên giao diện) và ghi `AuditLog` `camera.zones.update`. PUT thay TOÀN BỘ danh sách mọi loại (`{ zones: [{ name?, type?, points: [{x,y}] }] }`, `type` mặc định `MONITORING`, tối đa 10 vùng, mỗi vùng 3–20 điểm toạ độ tỉ lệ 0–1); `zones: []` = xoá hết. DTO trả về kèm `type`. AI engine tự đọc lại bảng `Zone` mỗi 60s |
| `/api/cameras/[id]/announce` | POST | Phát một câu qua loa của camera; cần session + `assertSiteAccess` theo site của camera. Body `{ text?: string ≤ 200, violationId?: string }` — không có `text` thì bắt buộc `violationId` và câu được dựng bằng `announcementFor()` (`src/lib/announce-shape.ts`), vi phạm không thuộc camera này → 404. Gọi `announce()` (`src/lib/announce.ts`) đẩy `POST /announce` sang YOLO Bridge (`YOLO_BRIDGE_URL` hoặc `NEXT_PUBLIC_YOLO_SERVER_URL`, mặc định `http://127.0.0.1:4001`, header `X-AI-Engine-Secret`, timeout 3s) rồi trả `{ ok, listeners?, error?, text }`; ghi `AuditLog` `camera.announce` |
| `/api/cameras` | GET, POST | Danh sách (cần session, lọc theo phạm vi site) + thêm camera thật (`assertSiteAccess`); POST ghi `AuditLog` |
| `/api/cameras/[id]` | GET, PATCH, DELETE | Sửa nguồn (`rtspUrl`), trạng thái, xoá; cả 3 method kiểm `assertSiteAccess`. DELETE xoá luôn dòng `CameraAgent` cùng id (không có quan hệ Prisma); PATCH/DELETE ghi `AuditLog` |
| `/api/observations` | POST | Chỉ cho AI engine (header `X-AI-Engine-Secret`, không session): `{ observations: [{ cameraId, minute (ISO phút), persons, personSeconds }] }` tối đa 200 dòng; upsert `ObservationStat` theo `(cameraId, minute)` trong **một** `$transaction` cho cả lô nên gửi lại cùng một phút không nhân đôi mẫu số; `siteId` suy từ Camera, camera đã xoá thì bỏ qua dòng đó. Trả 201 `{ upserted }` |
| `/api/stats/agent-accuracy` | GET | Cần session; `?siteId&from&to` (mặc định 30 ngày, trần 366 ngày, `siteId` ngoài phạm vi → 403) → `{ totals, byCamera, byType }` với mỗi ô là `{ reviewed, withFeedback, wrong }`; chỉ đếm vi phạm agent ĐÃ phán quyết. Hàm thuần `agentAccuracy()` ở `src/lib/agent-accuracy-shape.ts`; tỉ lệ sai do giao diện tính `wrong / withFeedback` |
| `/api/stats/compliance` | GET | Cần session; `?siteId&from&to` (mặc định 30 ngày, trần 366 ngày) → mảng theo ngày `{ day, personMinutes, violations, complianceRate }`; `complianceRate` = `1 − vi_phạm / max(phút_người, 1)` (0–1), `null` khi ngày đó chưa có quan sát. Hàm thuần `complianceByDay()` ở `src/lib/compliance-shape.ts` |
| `/api/videos` | GET, POST | Liệt kê / tải video mẫu vào `public/videos/` |
| `/api/sites`, `/api/sites/[id]` | GET | Công trường; cần session, chỉ trả site trong `assignedSites` |
| `/api/users`, `/api/users/[id]` | GET, POST · GET, PATCH, DELETE | Người dùng; cả 5 method chỉ SUPER_ADMIN/ORG_ADMIN (khớp `PAGE_ROLES['/users']`). Chỉ SUPER_ADMIN mới cấp được vai trò `SUPER_ADMIN` (`assignableRoles` trong `src/lib/auth/permissions.ts`); PATCH không cho tự đổi vai trò của chính mình và DELETE không cho tự xoá (403). POST: zod `createUserSchema` (`src/lib/user-shape.ts`: `name`, `email`, `password` ≥ 8, `role` enum, `assignedSites`), băm mật khẩu bằng `bcryptjs`, `orgId` lấy theo tổ chức của người tạo (fallback tổ chức đầu tiên cho tài khoản dev cứng không có dòng User), 409 khi email trùng. POST/PATCH/DELETE đều ghi `AuditLog` |
| `/api/users/me/password` | PATCH | `{ currentPassword, newPassword ≥ 8 }`; xác minh mật khẩu cũ bằng bcrypt, 400 khi sai hoặc khi tài khoản không có `passwordHash` (tài khoản dev cứng); ghi `AuditLog` |
| `/api/audit-log` | GET | SUPER_ADMIN/ORG_ADMIN; `?limit` (mặc định 50, tối đa 200) `&resource` |
| `/api/alert-rules` | GET, POST | Quy tắc cảnh báo theo site; POST cần vai trò `ALERT_RULE_WRITE_ROLES` (SUPER_ADMIN/ORG_ADMIN/SITE_MANAGER) **và** `assertSiteAccess`, ghi `AuditLog` |
| `/api/alert-rules/[id]` | PATCH, DELETE | Cùng điều kiện vai trò + site như POST; cả 2 ghi `AuditLog` |
| `/api/settings/telegram` | GET, POST | Lưu bot token (mã hoá) + bật/tắt; POST ghi `AuditLog` (không log token thô) |
| `/api/settings/telegram/test` | POST | Gọi `getMe` kiểm tra token |
| `/api/settings/zalo` | GET, POST | Lưu access token OA (mã hoá) + bật/tắt; POST ghi `AuditLog` (không log token thô) |
| `/api/settings/zalo/test` | POST | Gọi `getoa` kiểm tra access token |
| `/api/roboflow` | POST | Gọi Roboflow Workflow phía server, giữ API key; chỉ admin |
| `/api/reports/agent-feedback` | GET | Cần session; `?siteId&from&to` (cùng cách hiểu khoảng ngày với `/api/stats/agent-accuracy`) → CSV `text/csv; charset=utf-8` có BOM + `Content-Disposition: attachment`, cột `violationId,cameraId,type,detectedAt,snapshotUrl,clipUrl,agentVerdict,band,humanCorrect,note`, tối đa 20.000 dòng mới nhất. Chỉ vi phạm đã có phản hồi của người — bộ dữ liệu retrain, xem [Train model](08-train-model-them-ppe.md) |
| `/api/reports/violations` | GET | Cần session; `?siteId&cameraId&from&to` (mặc định 7 ngày, biên ngày tính theo UTC như `/api/stats/compliance`, `siteId` ngoài phạm vi → 403) → `{ range, byCamera, rows }`, `rows` tối đa 2.000 dòng mới nhất. Gộp theo camera bằng `buildReportSummary` trong `src/lib/report-shape.ts` |
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
| `useViolations`, `useOpenViolationCount`, `useViolationActions`, `useOpenCorrectiveActions`, `useCreateCorrectiveAction`, `useUpdateCorrectiveAction`, `useSubmitReviewFeedback` | `use-violations.ts` | `/api/violations`, `/api/violations/count`, `/api/violations/[id]/actions`, `/api/actions`, `/api/violations/[id]/feedback` |
| `useCameras`, `useCreateCamera`, `useUpdateCamera`, `useDeleteCamera`, `useCameraZones`, `useSaveCameraZones`, `useAnnounceCamera` | `use-cameras.ts` | `/api/cameras`, `/api/cameras/[id]/zones`, `/api/cameras/[id]/announce` |
| `useSites`, `useSite` | `use-sites.ts` | `/api/sites` |
| `useViolationReport` | `use-reports.ts` | `/api/reports/violations` |
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
| `useAgentAccuracy(days)` | `use-agent.ts` | `/api/stats/agent-accuracy?from=` (thẻ "Độ chính xác của agent" ở `/agent`) |

## Component chính (`src/components/`)

- **layout/** — `Sidebar.tsx` (drawer di động + thu gọn), `Header.tsx` (hamburger dưới `md`), `sidebar-context.tsx` (`SidebarProvider`/`useSidebar`)
- **dashboard/** — `AlertTimeline.tsx`, `ComplianceChart.tsx`, `SiteStatusGrid.tsx`, `ViolationDonut.tsx`
- **analytics/** — `TimeHeatmap.tsx` (lưới 7×24 giờ×thứ, tô theo `--danger`), `PositionHeatmap.tsx` (chọn camera, ảnh xem trước `preview_<id>.jpg` + chấm mờ tại tâm bbox); phần thuần gộp dữ liệu ở `src/lib/heatmap-shape.ts` (`hourWeekdayGrid`, `bboxCenters`, `maxCell`)
- **cameras/** — `CameraCard.tsx`, `CameraGrid.tsx`, `MicButton.tsx`, `WebcamPreview.tsx`
- **violations/** — `ViolationsTable.tsx`, `ViolationDetailModal.tsx` (tab Chi tiết liệt kê việc khắc phục của vi phạm với chip trạng thái/`Quá hạn` và nút "Đã khắc phục" mở ô ghi chú bằng chứng; nút "Giao xử lý" mở biểu mẫu chọn người — `<datalist>` gợi ý từ `useUsers()`, vai trò không phải quản trị vẫn gõ tay được — mô tả và hạn `datetime-local` mặc định +24 h; nút "Phát loa" giữ nguyên)
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
