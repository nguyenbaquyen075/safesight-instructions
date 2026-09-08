# Giao diện di động và PWA (F2)

## Vấn đề

Sidebar cố định 260px và ba bảng dữ liệu chính (`ViolationsTable`, `AlertsTable`, `UserTable`) chỉ hiển thị tốt trên desktop. Dưới 768px, Sidebar không thể ẩn nên chiếm gần hết màn hình, còn bảng cuộn ngang khó thao tác bằng ngón tay. Ứng dụng cũng chưa cài được như app trên điện thoại (không có manifest, không hoạt động offline dù chỉ ở mức shell tối thiểu).

## Đề xuất

- Sidebar trở thành drawer dưới `md` (768px): ẩn mặc định ngoài màn hình, mở bằng nút hamburger ở Header, overlay tối đóng khi bấm ra ngoài, tự đóng khi đổi route. Trạng thái mở/thu gọn dùng chung một context (`SidebarProvider`/`useSidebar`) giữa Sidebar, Header và layout dashboard. Nút thu gọn (tính năng desktop) chỉ hiện từ `md` trở lên; hành vi thu gọn/badge hiện có giữ nguyên.
- Ba bảng dữ liệu chính hiện bảng đầy đủ từ `md` trở lên (`hidden md:block`) và một danh sách thẻ dưới `md` (`md:hidden`, 3 dòng: tên/loại + badge trạng thái, camera/thời gian, hành động), dùng lại đúng handler của bảng.
- PWA: `public/manifest.webmanifest` (tên, icon, `display: standalone`, theme tối), icon 192/512px sinh một lần từ `wiki/assets/safesight-logo.svg` bằng `sharp` (đã có sẵn trong dependencies) qua script `scripts/make-icons.mjs`, commit thẳng file PNG. `public/sw.js` cache shell tối thiểu (network-first cho điều hướng, bỏ qua `/api/` và `/snapshots/`), đăng ký trong `Providers.tsx` chỉ ở production. Không làm push notification (để backlog riêng).

## Tiêu chí nghiệm thu

- [ ] Dưới 768px: Sidebar ẩn mặc định, nút hamburger ở Header mở drawer kèm overlay, bấm overlay hoặc đổi route đóng drawer lại.
- [ ] Từ 768px trở lên: layout, nút thu gọn, badge "Thông báo" hoạt động y như trước khi có thay đổi này.
- [ ] `ViolationsTable`, `AlertsTable`, `UserTable` hiển thị đúng dạng thẻ dưới `md`, đủ 3 dòng thông tin và các hành động (Resolve/Acknowledge/Edit/Delete/dropdown) hoạt động giống bảng.
- [ ] `public/manifest.webmanifest` hợp lệ (tên, icon 192/512, theme tối); `public/sw.js` không cache `/api/` hay `/snapshots/`; service worker chỉ đăng ký khi `NODE_ENV === 'production'`.
- [ ] `npm run test:agent`, `npx tsc --noEmit`, `npx eslint .` đều xanh.
- [ ] Tài liệu (`DESIGN.md`, `wiki/05`, `docs/ba/06`, `docs/ba/14` NFR-19, `CHANGELOG.md`) cập nhật cùng commit.
- [ ] Kiểm tra hình ảnh thật trên trình duyệt (desktop/mobile) hoãn lại — môi trường worktree không chạy server/Chrome; ghi rõ trong PR để reviewer bấm thử.
