## Tóm tắt
- Thống kê thiếu đồ bảo hộ **đếm thêm áo phản quang**: "Mũ 1 · Áo 1 · Găng 0 · Giày 0" thay vì chỉ "Mũ 1".

## Issue
Closes #<n>

## Thay đổi chính
- `src/app/(dashboard)/cameras/page.tsx`: `missingCounts` (cửa sổ phóng to) và `missingPpeCounts` (bảng tổng quan) thêm khoá `vest`; dòng thống kê thêm "Áo"; bảng tổng quan thêm ô "Thiếu áo phản quang" và lưới `sm:grid-cols-2 lg:grid-cols-4`.
- Không đổi engine hay quyết định thiếu/đủ (`missingPpe` đã có `vest`).

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint` (file đã sửa).
- [x] Chạy thật với engine trên bản `main-moi` (cùng thay đổi): người thiếu mũ và áo hiện "Mũ 1 · Áo 1 · Găng 0 · Giày 0".
- [x] Chrome headless trên nền `main` (không có engine nên số đều 0): ô "Thiếu áo phản quang" hiện, dòng "Mũ · Áo · Găng · Giày" hiện, không tràn ngang.
- [ ] Chưa chạy lại với engine trên nền `main`; chế độ sáng và điện thoại — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Sửa).

## Rủi ro và việc còn lại
- Chỉ đếm theo khung hình hiện tại của camera đang xem, giống ba món còn lại.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
