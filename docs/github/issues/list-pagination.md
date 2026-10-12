# Trang Vi phạm và Thông báo dựng toàn bộ danh sách nên đứng hình
branch: fix/list-pagination

## Vấn đề
`GET /api/violations` trả toàn bộ vi phạm (~3.700 dòng, 2 MB trên dev.db thật) và hai trang tự tải lại mỗi 15 giây, mỗi dòng dựng một thẻ: `/violations` có ~249.000 phần tử (thẻ đầu hiện sau ~22 giây, trình duyệt bận ~20 giây mỗi lần tải và ~13 giây mỗi lần tự tải lại), `/alerts` ~180.000 phần tử (bận gần 15 giây trong mỗi 15 giây nhàn rỗi).

## Đề xuất
- Dựng 24 thẻ (`/violations`) / 20 thông báo (`/alerts`) đầu, nút "Hiện thêm" mỗi lần thêm một trang, đặt lại khi đổi bộ lọc hoặc tìm kiếm.
- Thống kê, xuất CSV và "Đánh dấu tất cả đã đọc" vẫn dùng toàn bộ danh sách đã lọc.

## Tiêu chí nghiệm thu
- [ ] Hai trang hiện nội dung trong dưới 1 giây trên dữ liệu thật, và luồng chính không bận liên tục khi nhàn rỗi.
- [ ] "Hiện thêm", bộ lọc, tìm kiếm và mở cửa sổ chi tiết vẫn hoạt động.
