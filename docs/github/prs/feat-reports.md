## Tóm tắt
- Quản lý công trường có trang `/reports` để lọc vi phạm theo công trường / camera / khoảng ngày, xem tổng hợp theo camera rồi xuất CSV hoặc in ra PDF gửi chủ đầu tư.
- Agent tự viết báo cáo tuần theo giờ đặt trên `/agent`, gửi Telegram và để lại bản mới nhất ngay trên trang Báo cáo.
- Không thêm dependency: CSV bằng `Blob` + `URL.createObjectURL`, PDF bằng `window.print()` với `@media print`.

## Issue
Closes #<n>

## Thay đổi chính
- `src/lib/report-shape.ts` (mới): `buildReportSummary(rows)` — gộp vi phạm theo camera thành `{ total, real, falsePositive, open }`, giữ bất biến `total = real + falsePositive + open` (`open` gộp `OPEN` + `UNDER_REVIEW` để không có nhóm nào rơi ra ngoài), sắp xếp theo tổng giảm dần rồi theo tên camera. Kiểu `ViolationReport` dùng chung cho route và hook.
- `src/app/api/reports/violations/route.ts` (mới): `GET ?siteId&cameraId&from&to`, `requireSession` + `allowedSiteIds` (403 khi `siteId` ngoài phạm vi), mặc định 7 ngày, `take: 2000` mới nhất trước, DTO qua `toViolationDTO` sẵn có.
- `src/hooks/use-reports.ts` (mới): `useViolationReport(filters)`.
- `src/app/(dashboard)/reports/page.tsx` (mới): bộ lọc (dùng lại `useSites`/`useCameras`), 4 ô số tổng, bảng tổng hợp theo camera, bảng chi tiết (vẽ 200 dòng mới nhất, CSV xuất đủ), "Xuất CSV" (UTF-8 có BOM), "In / PDF", và khối báo cáo tuần mới nhất của agent (`useAgentEvents({ type: 'report', limit: 1 })`, markdown hiện theo đoạn). Dùng lại `SectionHeader`/`SettingCard`/`InputGroup` theo DESIGN.md.
- `src/lib/auth/permissions.ts`, `src/components/layout/Sidebar.tsx`, `src/app/(dashboard)/layout.tsx`: `/reports` vào `PAGE_ROLES` (SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER), menu "Báo cáo" (icon `FileText`), tiêu đề Header, `print:ml-0` cho khung nội dung.
- `src/app/globals.css`: khối `@media print` — đổi token màu sang nền sáng (dashboard nền tối in ra giấy sẽ mất chữ), ẩn `aside`/`header`/`.no-print`, `tr { break-inside: avoid }`.
- Agent: `weekly.report` vào `RESEARCH_KINDS` + `PRIORITY` 150 (`agent/lib/tasks.ts`); `nextWeekly(spec, now)` thuần + `ensureTask` trong `agent/lib/recurring.ts`; OPENING riêng (`agent/lib/preamble.ts`); bộ tool như `shift.report` (`agent/lib/toolsets.ts`); `agent/session.ts` chạy `effort: 'high'` và phát thêm `AgentEvent report { text }` cuối phiên.
- `prisma/schema.prisma`: `AgentSettings.weeklyReportAt String @default("MON 08:00")`; `PATCH /api/agent/settings` nhận giá trị theo regex `^(SUN|MON|...|SAT) HH:mm$`; `/agent` có ô "Giờ báo cáo tuần" (dropdown thứ + `input type="time"`) nên không nhập sai định dạng được.

## Kiểm thử
- [x] `npm run test:agent` — 135 pass / 0 fail (127 cũ + 8 mới: `agent/test/report-shape.test.ts`, `agent/test/weekly-report.test.ts`)
- [x] `npx tsc --noEmit` · `npx eslint .` — sạch
- [ ] Python: không đụng `ai-engine/`
- [ ] Kiểm tra hình ảnh desktop/mobile — **hoãn**: không chạy server/Chrome trên máy vận hành ở đợt này. Đã xử lý bằng code: bảng nằm trong `overflow-x-auto` + `min-w`, bộ lọc `grid-cols-1 sm:grid-cols-2 xl:grid-cols-5`, chỉ dùng token màu của DESIGN.md nên nền tối/bản in đều nhất quán.

## Tài liệu
- `wiki/04-mo-hinh-du-lieu.md` (cột `weeklyReportAt`), `wiki/05-giao-dien-va-api.md` (route `/reports`, API `/api/reports/violations`, hook `useViolationReport`, ghi chú CSS in), `wiki/09-agent.md` (kind `weekly.report`, bộ tool, `AgentEvent report`).
- `docs/ba/04` (F-RPT-01 → v0.9, F-AGENT-05 mới), `docs/ba/05` (2 dòng ma trận), `docs/ba/07` (SCR-20 mới, SCR-10 thêm "Giờ báo cáo tuần"), `docs/ba/08` (sitemap), `docs/ba/13` (US-17 ✅), `CHANGELOG.md`.

## Rủi ro và việc còn lại
- Bảng chi tiết chỉ vẽ 200 dòng mới nhất (API trả tối đa 2.000) — CSV vẫn đủ; cần xem hết trên màn hình thì thêm phân trang sau (đã ghi `ponytail:` tại chỗ).
- `weekly.report` mới chỉ được nghiệm thu qua test lịch; chất lượng bản báo cáo do model viết chưa chạy thật với LLM.
- Khoảng ngày tính theo giờ máy chủ; hệ thống chỉ chạy một múi giờ nên chưa xử lý đa múi giờ.
- Chưa chụp màn hình desktop/mobile (xem mục Kiểm thử).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
