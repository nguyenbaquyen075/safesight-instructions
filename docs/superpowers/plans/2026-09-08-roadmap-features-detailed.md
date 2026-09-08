# Chín tính năng v0.9 — kế hoạch chi tiết từng task

> Bổ sung cho `2026-09-08-roadmap-features.md` (bảng tổng). Spec: `docs/superpowers/specs/2026-09-08-roadmap-features-design.md`. Mỗi task đọc mục tương ứng ở đây + mục F tương ứng trong spec. Quy ước chung và cách kiểm thử ở plan tổng.

Ký hiệu đường dẫn: `src/` = Next.js, `agent/` = worker, `ai-engine/` = Python. Test Node đặt trong `agent/test/*.test.ts` (chạy trên `agent-test.db`, dọn dữ liệu của mình). Hàm thuần cho Next đặt trong `src/lib/*-shape.ts` và test qua alias `@/lib/...`.

---

## T2 — `feat/mobile-pwa` (F2) — model: sonnet

**Files**
- Modify `src/app/(dashboard)/layout.tsx`: bọc `Sidebar` + `Header` trong `SidebarProvider` mới (`src/components/layout/sidebar-context.tsx`: `{ open, setOpen, collapsed, setCollapsed }`); nội dung `ml-0 md:ml-[260px]` (và `md:ml-[68px]` khi collapsed).
- Modify `src/components/layout/Sidebar.tsx`: dưới `md` → `fixed inset-y-0 left-0 z-50 w-[260px] -translate-x-full` khi `!open`, `translate-x-0` khi `open`, overlay `fixed inset-0 bg-black/50 md:hidden` đóng khi click; đóng khi `pathname` đổi (`useEffect`); nút collapse hiện chỉ từ `md`.
- Modify `src/components/layout/Header.tsx`: nút hamburger `md:hidden` (`Menu` icon lucide, `aria-label="Mở menu"`, `aria-expanded`), header `sticky top-0 z-30`.
- Modify `src/components/violations/ViolationsTable.tsx`, `src/components/alerts/AlertsTable.tsx`, `src/components/users/UserTable.tsx`: bảng `hidden md:table`; thêm danh sách thẻ `md:hidden` (mỗi thẻ: dòng 1 tên/loại + badge trạng thái, dòng 2 camera/thời gian, dòng 3 hành động) dùng cùng handler.
- Create `public/manifest.webmanifest` (name "SafeSight", short_name, `display: standalone`, `theme_color: #0F172A`, `background_color: #0F172A`, icons `/icons/icon-192.png`, `/icons/icon-512.png`, `start_url: /`), `public/icons/icon-192.png`, `public/icons/icon-512.png` sinh một lần bằng `scripts/make-icons.mjs` (sharp, đọc `wiki/assets/safesight-logo.svg`) — commit PNG, script giữ lại.
- Create `public/sw.js`: precache `['/', '/manifest.webmanifest', '/icons/icon-192.png']`, chiến lược network-first cho navigation, bỏ qua `/api/` và `/snapshots/`; version string trong file.
- Modify `src/app/layout.tsx`: `metadata.manifest = '/manifest.webmanifest'`, `viewport.themeColor`, `appleWebApp`. Modify `src/components/Providers.tsx`: `useEffect` đăng ký `/sw.js` khi `process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator`.
- Docs: `DESIGN.md` (mục "Responsive": breakpoints `md` 768, drawer, thẻ thay bảng), `wiki/05` (layout), `docs/ba/06-ux-criteria.md` (bỏ điểm yếu sidebar), `docs/ba/14-nfr.md` NFR-19 ✅, `CHANGELOG.md`.

**Steps**: (1) context + drawer + overlay; (2) header hamburger; (3) 3 bảng → thẻ dưới md; (4) manifest/icons/sw/đăng ký; (5) `tsc`, `eslint`; (6) docs; (7) commit `feat(ui): responsive drawer layout and PWA manifest` + `docs/github/prs/feat-mobile-pwa.md`, `docs/github/issues/mobile-pwa.md`. Kiểm hình ảnh hoãn — ghi trong PR.

## T3 — `feat/evidence-clips` (F3) — model: opus

**Files**
- Create `ai-engine/clips.py`: `class FrameRing(maxlen=20)` (`push(frame)`, `snapshot()` trả list copy), `class ClipWriter(path, fps=4, size)` (`write(frame)`, `close()`), `class PendingClip(writer, remaining_after=12)`; thuần Python + cv2 (test thuần cho ring bằng list, không cần cv2: tách `FrameRing` sang không phụ thuộc cv2).
- Modify `ai-engine/yolo_inference.py`: mỗi stream có `ring = FrameRing()`; sau khi đọc frame → `ring.push(frame)`; khi `report_violation(cam_id, d)` tạo `clip_<key>.mp4` (key = `cam_id`+timestamp như tên snapshot) từ `ring.snapshot()`, thêm `PendingClip` vào `st["pending_clips"]`; cuối mỗi vòng lặp: mọi pending ghi frame hiện tại, `remaining_after -= 1`, đóng khi 0. `report_violation` gửi `clipUrl: /snapshots/clip_<key>.mp4`. `clear_snapshots()` xoá cả `clip_*.mp4`.
- Modify `prisma/schema.prisma`: `Violation.clipUrl String?`. Modify `src/app/api/violations/route.ts` (zod `clipUrl: z.string().optional()`, ghi), `src/lib/violation-shape.ts` (DTO `clipUrl`), `src/types/models.ts`.
- Modify `src/components/violations/ViolationDetailModal.tsx`: tab Bằng chứng: nếu `clipUrl` → `<video controls muted playsInline preload="metadata" poster={snapshotUrl}>`; ảnh giữ bên dưới.
- Modify `agent/direct/cleanup.ts`: file đủ điều kiện gồm `clip_*.mp4` cùng luật (referenced qua `clipUrl`, closed, > 24h). Modify `agent/tools/read_violation.ts`: trả `clipUrl` + dòng text "có clip 8s, người quản lý xem trong modal".
- Tests: `ai-engine/test_clips.py` (ring giữ đúng 20, thứ tự), `agent/test/violation-shape` (thêm `clipUrl` null/giá trị), `agent/test/actions.test.ts` hoặc test cleanup (clip của vi phạm mở không bị xoá).
- Docs: `wiki/04`, `wiki/06`, `wiki/05`, `docs/ba/07` SCR-06, `docs/ba/04` F-AI-03, `CHANGELOG.md`.
- Commit `feat(evidence): record a short clip per confirmed violation` + PR/issue md.

## T4 — `feat/reports` (F4) — model: opus

**Files**
- Create `src/app/api/reports/violations/route.ts`: `GET ?siteId&cameraId&from&to` (mặc định 7 ngày; `requireSession` + scope `allowedSiteIds`; 403 nếu siteId ngoài scope) → `{ range, byCamera: [{ cameraId, cameraName, siteName, total, real (status resolved), falsePositive, open }], rows: ViolationDTO[] (≤ 2000, mới nhất trước) }`. Hàm thuần `buildReportSummary(rows)` trong `src/lib/report-shape.ts` + test.
- Create `src/app/(dashboard)/reports/page.tsx`: bộ lọc (Site dropdown từ `useSites`, Camera từ `useCameras` lọc theo site, `from`/`to` date input), bảng tổng hợp theo camera, bảng chi tiết, nút "Xuất CSV" (tạo CSV từ `rows` bằng `Blob` + `URL.createObjectURL`, BOM UTF-8), nút "In / PDF" (`window.print()`); CSS `@media print` trong `globals.css` ẩn sidebar/header/nút. Thêm `/reports` vào `PAGE_ROLES` (SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER) và Sidebar (`FileText`), tiêu đề trong `layout.tsx`.
- Agent: `agent/lib/tasks.ts` thêm `'weekly.report'` vào `RESEARCH_KINDS` + `PRIORITY` 150; `prisma/schema.prisma` `AgentSettings.weeklyReportAt String @default("MON 08:00")`; `agent/lib/recurring.ts` `nextWeekly(spec, now)` (thuần: `"MON 08:00"` → Date kế tiếp) + `ensureTask({ kind: 'weekly.report', subjectType: 'system', ... })`; `agent/lib/preamble.ts` OPENING cho `weekly.report` (7 ngày: theo công trường/camera: vi phạm thật, báo oan, camera báo oan nhiều, việc mở, sự cố vận hành; gửi `escalate` không violationId; kết thúc bằng bản báo cáo markdown); `agent/lib/toolsets.ts` như `shift.report`; `agent/session.ts` cuối phiên nếu kind `weekly.report` → `emit type:'report' data:{ text }`. `GET /api/agent/events?type=report` đã có → `/reports` hiện báo cáo mới nhất (đoạn văn, không render markdown thô: chia đoạn theo dòng trống).
- UI cài đặt: `/agent` thêm ô "Giờ báo cáo tuần" (`MON 08:00`, validate regex) trong PATCH settings.
- Tests: `agent/test/weekly-report.test.ts` (`nextWeekly` cho vài mốc; `ensureRecurring` tạo task đúng dueAt), `agent/test/report-shape.test.ts`.
- Docs: `wiki/05` (route/page), `wiki/09` (kind mới), `docs/ba/04` F-RPT-01 → v0.9, `docs/ba/13` US-17 ✅, `docs/ba/07` SCR-17, `docs/ba/08` sitemap, `CHANGELOG.md`.
- Commit `feat(reports): reports page with CSV/print and the agent weekly report` + PR/issue md.

## T6 — `feat/compliance-observations` (F6) — model: opus

**Files**
- Modify `ai-engine/yolo_inference.py`: mỗi stream đếm `obs = { minute: str, persons_max: int, person_seconds: float, frames: int }`; mỗi frame `person_seconds += len(persons_in_zone) * dt` (dt = thời gian từ frame trước, giới hạn ≤ 1s); khi sang phút mới (hoặc 60s) → gom mọi stream thành mảng và `POST /api/observations` (header secret, timeout 2s, `except` log 1 lần/status như bridge). `process_frame` trả thêm số người trong vùng (đã lọc zone nếu T1 đã gộp; nếu chưa, đếm `persons`) — trả qua thuộc tính `tracker.last_person_count` để không đổi chữ ký.
- `prisma/schema.prisma`: `model ObservationStat { id String @id @default(cuid()); cameraId String; siteId String; minute DateTime; persons Int; personSeconds Int; @@unique([cameraId, minute]) @@index([siteId, minute]) }`.
- Create `src/app/api/observations/route.ts`: POST (secret engine như violations), zod mảng ≤ 200 phần tử, `upsert` theo `(cameraId, minute)` (siteId từ Camera), 201 `{ upserted }`.
- Create `src/app/api/stats/compliance/route.ts`: `GET ?siteId&from&to` (session + scope) → theo ngày `{ day, personMinutes, violations, complianceRate }`; hàm thuần `complianceByDay(stats, violations, from, to)` trong `src/lib/compliance-shape.ts` (`rate = clamp(1 − violations / max(personMinutes, 1), 0, 1)`; ngày không có quan sát → `null`).
- Modify `src/hooks/use-dashboard.ts`: `useDashboardKPIs` lấy `complianceRate` hôm nay và trend từ `/api/stats/compliance` (hook `useComplianceStats`), fallback `rateFromCount` + cờ `estimated: true` khi `null`; `useComplianceTrend` dùng cùng nguồn. KPI card hiển thị "ước tính" khi `estimated`. Số camera online: đếm từ `useCameras()` thay `mockCameras` (bỏ import mock ở hook này).
- Tests: `agent/test/compliance.test.ts` (`complianceByDay`: có dữ liệu, không có, clamp), `agent/test/observations-shape.test.ts` (zod).
- Docs: `wiki/04` (model), `wiki/05` (2 route, hook), `wiki/06` (đếm người), `docs/ba/14` NFR mới, `docs/ba/04` F-DASH-01, `docs/ba/13` US-20 ✅, `CHANGELOG.md`.
- Commit `feat(stats): compliance rate from observed person-minutes` + PR/issue md.

## T7 — `feat/violation-heatmap` (F7) — model: sonnet

**Files**
- Create `src/lib/heatmap-shape.ts`: `hourWeekdayGrid(rows) → number[7][24]`, `bboxCenters(rows) → { x, y, type }[]` (từ `bboxData` %/0–1, bỏ qua lỗi), `maxCell(grid)`; test `agent/test/heatmap-shape.test.ts`.
- Create `src/components/analytics/TimeHeatmap.tsx` (lưới 7×24 `div` với `background: rgba(220,38,38,alpha)`, nhãn giờ/thứ, tooltip `title`), `src/components/analytics/PositionHeatmap.tsx` (chọn camera; `<canvas>` vẽ `/snapshots/preview_<id>.jpg` nếu tải được (onerror → nền `--surface`), chấm `radialGradient` alpha 0.25 r=18px tại tâm bbox; legend).
- Modify `src/app/(dashboard)/analytics/page.tsx`: hai mục mới dưới các biểu đồ hiện có, dùng `useViolations()` + bộ lọc khoảng ngày sẵn có của trang (nếu chưa có thì 7/30/90 ngày).
- Docs: `wiki/05`, `docs/ba/07` SCR-09, `docs/ba/04` F-AN-03, `CHANGELOG.md`.
- Commit `feat(analytics): violation heatmaps by time and position` + PR/issue md.

## T9 — `feat/postgres-multi-worker` (F9) — model: opus

**Files**
- Create `prisma/postgres/schema.prisma`: bản sao schema với `provider = "postgresql"` (giữ String cho enum để không lệch code) — thêm test `agent/test/schema-parity.test.ts` so sánh hai file sau khi chuẩn hoá dòng `provider`.
- Modify `package.json` scripts: `db:pg:generate` (`prisma generate --schema prisma/postgres/schema.prisma`), `db:pg:push`.
- Modify `src/lib/prisma.ts`: nếu `DATABASE_URL` bắt đầu `postgres` → `new PrismaPg({ connectionString })` (`@prisma/adapter-pg` đã cài) else `PrismaLibSqlWal`. Modify `prisma/seed.mjs` tương tự.
- Modify `agent/lib/camera-agent.ts` `rememberCamera`: đọc `memory`+`updatedAt`, `updateMany({ where: { id, updatedAt: prev }, data })`; nếu `count === 0` đọc lại và thử lần 2; test mô phỏng xung đột (cập nhật giữa hai bước qua hook `beforeWrite` tùy chọn cho test).
- Modify `agent/lib/env.ts` `workerId: process.env.AGENT_WORKER_ID ?? hostname()-pid`; `session.started.data.workerId`; `agent/lib/guard.ts` comment rate limit per-worker; `wiki/09` mục "Nhiều worker".
- `docker-compose.yml`: service `postgres` (image `postgres:16-alpine`, profile `pg`, volume `pgdata`), `dashboard` nhận `DATABASE_URL` từ `.env`; `wiki/03` mục chuyển sang Postgres (generate schema pg, push, migrate dữ liệu bằng script `scripts/sqlite-to-postgres.mjs` đọc SQLite qua Prisma sqlite client và ghi qua pg client theo bảng — chỉ các bảng chính, ghi rõ thứ tự khoá ngoại).
- Docs: `wiki/03`, `wiki/04`, `wiki/09`, README Docker, `.env.docker.example`, `docs/ba/14` NFR-20, `CHANGELOG.md`. PR ghi rõ: chưa nghiệm thu trên Postgres thật.
- Commit `feat(db): PostgreSQL adapter selection and multi-worker safe memory` + PR/issue md.

## Ghi chú cho T1/T5/T8 (đang chạy với spec F1/F5/F8)
Reviewer sau khi xong: kiểm đúng theo spec + quality; sửa 1 vòng nếu cần.
