# Thống kê "Thiếu đồ bảo hộ" không đếm áo phản quang
branch: fix/ppe-vest-missing-count

## Vấn đề
Trong cửa sổ phóng to camera và bảng "Tổng quan tuân thủ PPE", số thiếu chỉ gồm mũ, găng, giày. Người thiếu cả mũ và áo chỉ hiện "Mũ 1" trong khi khung trên hình báo cả "THIẾU MŨ" và "THIẾU ÁO".

## Đề xuất
- Đếm thêm áo phản quang (`missingPpe` đã có `vest` từ tracker): "Mũ 1 · Áo 1 · Găng 0 · Giày 0" và thêm ô "Thiếu áo phản quang" ở bảng tổng quan.

## Tiêu chí nghiệm thu
- [ ] Người thiếu mũ và áo hiện đúng "Mũ 1 · Áo 1" trong cửa sổ phóng to camera.
- [ ] Bảng tổng quan có ô "Thiếu áo phản quang", không tràn ngang.
