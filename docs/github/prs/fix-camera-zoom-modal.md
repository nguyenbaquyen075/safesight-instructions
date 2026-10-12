## Tóm tắt
- Cửa sổ phóng to camera hiện **đủ toàn cảnh như ô trên lưới**: video đúng tỉ lệ, nằm trọn trong khung, khung nhận diện khớp vật và đồng bộ với AI.
- Dùng lại `DemoVideoWithBoxes` thay cho cách vẽ riêng (khung 16:9 `object-fill`).

## Issue
Closes #<n>

## Thay đổi chính
- `src/app/(dashboard)/cameras/page.tsx`: `DemoVideoWithBoxes` thêm prop `fit` (`cover` cho ô lưới, `contain` cho cửa sổ phóng to; `min` thay `max` trong kích thước khối); `LiveEventModal` nhận `aiPos` và dùng `DemoVideoWithBoxes` với `fit="contain"`; khung video cao `min(62vh, 640px)` thay cho `aspect-video`.
- **Phụ thuộc `fix/cameras-overlay-aspect`**: nhánh này tách từ đó (cần khối đúng tỉ lệ và biến `ratio`); gộp nhánh đó trước.

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint` (file đã sửa).
- [x] Chrome headless trên dev server (nền `main`, video H.264 giải mã được): bấm phóng to cả 6 camera — 4 video ngang (1280×720, 3840×2160, 1920×1080) và 2 video dọc 720×1280 — đều đúng tỉ lệ, nằm trọn trong khung, cửa sổ vừa màn hình (video dọc: khối 314×558, trước bị kéo thành 874×492).
- [ ] Chưa nhìn khung nhận diện trong cửa sổ phóng to khi engine chạy trên nền `main` (đã thấy trên bản `main-moi` với engine).
- [ ] Chế độ sáng, điện thoại — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Sửa).

## Rủi ro và việc còn lại
- Video ngang trong khung cao hơn tỉ lệ 16:9 có dải đen trên/dưới (đã tính trong `contain`).
- Cửa sổ này chưa dùng `useLockBodyScroll` (xem nhánh `fix/violation-modal-ticket-and-scroll`).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
