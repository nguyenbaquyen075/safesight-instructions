## Tóm tắt
- `/violations` dựng 24 thẻ đầu, `/alerts` 20 thông báo đầu, nút **"Hiện thêm"** mỗi lần thêm một trang; đặt lại khi đổi bộ lọc/tìm kiếm.
- Hết đứng hình: trước ~250.000 / ~180.000 phần tử, sau ~1.900 / ~1.200.

## Issue
Closes #<n>

## Thay đổi chính
- `src/app/(dashboard)/violations/page.tsx`, `src/app/(dashboard)/alerts/page.tsx`: `PAGE_SIZE`, state `visibleCount`, `slice(0, visibleCount)`, dòng "Đang hiện X / Y" và nút "Hiện thêm"; `animationDelay` tính theo vị trí trong trang để thẻ mới không trễ hàng giây.
- Thống kê, xuất CSV, "Đánh dấu tất cả đã đọc" không đổi (vẫn trên toàn bộ danh sách đã lọc). API không đổi.

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint` (các file đã sửa).
- [x] Đo trên dữ liệu thật của dev.db (3.665 vi phạm, bản `main-moi`): thẻ đầu 22 s → 0,3 s; phần tử 249.445 → 1.860; bận khi tải ~20 s → 0,4 s; chu kỳ tải lại 15 s bận 13,6 s → 36 ms; `/alerts` 179.734 → 1.208 phần tử.
- [x] Chrome headless trên nền `main` (DB mẫu 36 vi phạm): ban đầu 24/20, "Hiện thêm" ra đủ, đổi bộ lọc/tìm kiếm đặt lại, bấm thẻ vẫn mở cửa sổ chi tiết.
- [ ] `npm run test:agent` không chạy riêng (không đụng agent).
- [ ] Chế độ sáng và điện thoại cho nút "Hiện thêm" — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Sửa).

## Rủi ro và việc còn lại
- API vẫn trả toàn bộ danh sách mỗi 15 giây (~1 giây, 2 MB); khi dữ liệu lên vài chục nghìn dòng nên phân trang ở phía server (việc riêng).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
