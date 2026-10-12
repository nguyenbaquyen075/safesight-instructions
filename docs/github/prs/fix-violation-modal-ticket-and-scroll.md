## Tóm tắt
- Biểu mẫu **"Giao việc khắc phục"**: ảnh vi phạm đầy đủ (không méo) ở bên trái, thông tin giao việc bên phải.
- Cuộn trong cửa sổ chi tiết vi phạm **không còn làm trang nền chạy theo**.

## Issue
Closes #<n>

## Thay đổi chính
- `src/components/violations/ViolationDetailModal.tsx`: biểu mẫu giao việc thành lưới 2 cột (`lg:grid-cols-2`); cột trái là ảnh/clip `object-contain`, cao `min(62vh, 560px)`; cột phải gồm các ô nhập và nút, nút đặt `mt-auto` ngang đáy ảnh. `overscroll-contain` cho cột nội dung và lớp phủ biểu mẫu; gọi `useLockBodyScroll()`.
- `src/hooks/use-lock-body-scroll.ts` (mới): khoá `overflow` của `html`/`body` khi `active`, bù bề rộng thanh cuộn bằng `padding-right`, khôi phục khi đóng.
- Không đổi API, dữ liệu hay luồng giao việc.

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint` (các file đã sửa).
- [x] Chrome headless trên dev server nền `main` (DB mẫu, vi phạm mẫu có ảnh dọc 1080×1920): 3 cỡ cửa sổ (1440×900, 1280×620, điện thoại 390×700) — ảnh `object-contain`, bên trái ở màn hình rộng, nút Giao việc thấy được, không tràn ngang; cuộn chuột thật (xuống 6 lần, lên 8 lần, trên nền tối 4 lần) không làm trang nền chạy (400 → 400); đóng cửa sổ không để lại khoá trên `html`/`body`.
- [ ] `npm run test:agent` không chạy riêng cho nhánh này (không đụng agent).
- [ ] Kiểm tra chế độ sáng và cảm ứng điện thoại — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Sửa).

## Rủi ro và việc còn lại
- Chỉ áp cho `ViolationDetailModal`; các cửa sổ khác (ví dụ phóng to camera) chưa dùng `useLockBodyScroll`.
- Cột ảnh có chiều cao cố định theo cửa sổ nên cột phải có thể có khoảng trống giữa phần ô nhập và nút khi màn hình cao.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
