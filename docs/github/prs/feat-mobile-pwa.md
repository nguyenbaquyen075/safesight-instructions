## Tóm tắt
- Sidebar trở thành drawer di động dưới `md` (768px): nút hamburger ở Header, overlay đóng khi bấm ra ngoài, tự đóng khi đổi route; trạng thái mở/thu gọn dùng chung context mới `SidebarProvider`/`useSidebar`.
- `ViolationsTable`, `AlertsTable`, `UserTable` hiện dạng thẻ dưới `md` (3 dòng: tên/loại + badge, camera/thời gian, hành động) thay cho bảng cuộn ngang; bảng đầy đủ giữ nguyên từ `md` trở lên.
- Ứng dụng cài được như PWA: `public/manifest.webmanifest`, icon 192/512px sinh một lần bằng `scripts/make-icons.mjs` (dùng `sharp` đã có), `public/sw.js` cache shell tối thiểu (network-first, bỏ qua `/api/`, `/snapshots/`), đăng ký ở production.

## Issue
Closes #<n>

## Thay đổi chính
- `src/components/layout/sidebar-context.tsx` (mới): `SidebarProvider`/`useSidebar` — `{ open, setOpen, collapsed, setCollapsed }` dùng chung giữa Sidebar, Header, layout dashboard.
- `src/components/layout/Sidebar.tsx`: lấy `open`/`collapsed` từ context thay vì `useState` cục bộ; dưới `md` là `fixed` + `-translate-x-full` khi đóng, overlay `bg-black/50 md:hidden`, tự đóng khi `pathname` đổi; nút thu gọn chỉ hiện từ `md` (`hidden md:flex`). Badge/logic thu gọn hiện có không đổi.
- `src/components/layout/Header.tsx`: nút hamburger `md:hidden` (icon `Menu`, `aria-label="Mở menu"`, `aria-expanded`), tiêu đề/subtitle thêm `truncate` để không tràn khi có hamburger.
- `src/app/(dashboard)/layout.tsx`: bọc nội dung trong `SidebarProvider`; tách `DashboardShell` đọc `collapsed` từ context để canh `ml-0 md:ml-[260px]`/`md:ml-[68px]`.
- `src/components/violations/ViolationsTable.tsx`, `src/components/alerts/AlertsTable.tsx`, `src/components/users/UserTable.tsx`: bảng cũ bọc `hidden md:block`, thêm danh sách thẻ `md:hidden` dùng lại đúng handler (`onUpdateStatus`, `onAcknowledge`, `onEdit`/`onDelete`/`onToggleActive`). `UserTable` thêm hai helper nội bộ `getRoleBadgeClasses()` và `UserRowActions` để không lặp khối `DropdownMenu` giữa bảng và thẻ.
- `scripts/make-icons.mjs` (mới, chạy tay một lần): dùng `sharp` đọc `wiki/assets/safesight-logo.svg`, xuất `public/icons/icon-192.png`, `icon-512.png` (nền `#0F172A` khớp theme tối) — đã chạy và commit PNG.
- `public/manifest.webmanifest` (mới), `public/sw.js` (mới, network-first cho điều hướng, bỏ qua `/api/` và `/snapshots/`).
- `src/app/layout.tsx`: `metadata.manifest`, `metadata.appleWebApp`, `export const viewport` (`themeColor: '#0F172A'`).
- `src/components/Providers.tsx`: `useEffect` đăng ký `/sw.js` khi `NODE_ENV === 'production' && 'serviceWorker' in navigator`.

## Kiểm thử
- [x] `npm run test:agent` (127/127 pass — gặp lỗi môi trường ban đầu do `node_modules` dùng chung giữa các worktree: một worktree khác (`feat/reports`) chạy `prisma generate` đè client Prisma sinh (`weeklyReportAt` không có trong schema của nhánh này); chạy lại `prisma generate` cho đúng schema của worktree này rồi test lại thì xanh — không phải lỗi do thay đổi trong PR)
- [x] `npx tsc --noEmit` · `npx eslint .`
- [ ] Python: không đụng `ai-engine`
- [ ] Kiểm tra hình ảnh desktop/mobile — hoãn: không chạy server/Chrome trong môi trường worktree này (theo ràng buộc); đề nghị reviewer bấm thử `/violations`, `/alerts`, `/users` và menu hamburger ở cả hai bề rộng trước khi merge.

## Tài liệu
`DESIGN.md` (mục Responsive: breakpoint `md`, drawer, bảng → thẻ, PWA), `wiki/05-giao-dien-va-api.md` (route/component, mục Responsive & PWA mới), `docs/ba/06-ux-criteria.md` (bỏ điểm yếu "Sidebar chưa responsive"), `docs/ba/14-nfr.md` (NFR-19 → ✅), `CHANGELOG.md`.

## Rủi ro và việc còn lại
- Kiểm tra hình ảnh thật (desktop/mobile) chưa chạy — cần trình duyệt/server, hoãn theo ràng buộc môi trường của worktree; reviewer nên xác nhận trước khi merge.
- `node_modules` dùng chung giữa các worktree khiến Prisma Client sinh ra có thể lệch schema khi nhiều task chạy song song (gặp phải khi verify PR này) — không thuộc phạm vi F2, chỉ ghi nhận để các task khác biết chạy lại `prisma generate` nếu gặp lỗi "column does not exist" tương tự.
- Không làm push notification thật (cần VAPID/service phía sau) — để backlog riêng như trong issue.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
