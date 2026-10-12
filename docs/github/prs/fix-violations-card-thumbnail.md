## Tóm tắt
- Thẻ vi phạm trên `/violations` hiện **ảnh bằng chứng ngay trên thẻ**: có clip thì ảnh làm `poster`, không có clip thì hiện thẳng ảnh thay cho biểu tượng khiên.

## Issue
Closes #<n>

## Thay đổi chính
- `src/app/(dashboard)/violations/page.tsx`: thêm `poster={violation.snapshotUrl}` cho `<video>` và nhánh `<img src={violation.snapshotUrl}>` trước nhánh biểu tượng. Không đổi hành vi rê chuột phát clip, modal chi tiết hay API.

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint .`
- [x] Chrome headless trên dev server với dữ liệu mẫu: các thẻ hiện ảnh chụp kèm khung đỏ vùng thiếu mũ ngay khi mở trang, không lỗi console, không tràn ngang.
- [ ] Kiểm tra hình ảnh mobile / chế độ sáng — hoãn.
- [ ] `npm run test:agent` không chạy riêng cho nhánh này (không đụng agent; đã chạy 227/227 ở các nhánh cùng gốc).

## Tài liệu
CHANGELOG (Unreleased → Sửa).

## Rủi ro và việc còn lại
- Ảnh vi phạm mới vẫn bị engine xoá khi tắt/khởi động lại (`clear_snapshots()` theo thiết kế hiện có); vi phạm cũ trong DB mất ảnh nên thẻ vẫn rơi về biểu tượng.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
