# Khung GIÀY nằm trên ống chân và đôi khi hai ô dồn lên một chân
branch: fix/ppe-boots-box

## Vấn đề
Khung GIÀY được vẽ thành ô vuông nhỏ quanh điểm khớp cổ chân của model tư thế. Cổ chân nằm trên giày nên khung trượt lên ống chân; ngoài ra model tư thế đôi khi đặt cả hai cổ chân lên cùng một bàn chân, nên hai ô chồng nhau trên một chân còn chân kia không có ô. Đo trên video mẫu: IoU trung vị với ô giày của model chỉ 0.30, hai ô chồng nhau ở 6/180 lần người-khung.

## Đề xuất
- Vẫn neo vào cổ chân hiện tại (model giày chỉ chạy mỗi 3 khung nên ô của nó trễ), nhưng dịch xuống và to ra theo chiều dài cẳng chân; chiếc giày nào model giày thấy thì nhớ độ lệch/cỡ riêng của nó.
- Hai khung chồng nhau thì chỉ giữ một; khung chân kia lấy từ ô giày model giày thấy ở chỗ khác nếu có.
- Chỉ đổi toạ độ vẽ, không đổi quyết định đủ/thiếu giày.

## Tiêu chí nghiệm thu
- [ ] Khung GIÀY nằm trên thân giày trên video mẫu (nhìn bằng mắt trên màn hình).
- [ ] Không còn hai ô chồng nhau trên một chân.
- [ ] Quyết định người/mũ/áo/găng không đổi so với `main` trên cùng khung hình.
