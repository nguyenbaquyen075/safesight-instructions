# Cửa sổ phóng to camera bị kéo giãn và chỉ thấy một phần hình
branch: fix/camera-zoom-modal

## Vấn đề
Cửa sổ phóng to camera vẽ riêng: khung 16:9 cố định với `object-fill` (video dọc 9:16 bị kéo giãn gấp ~3 lần chiều ngang), video chạy 1× và không đồng bộ vị trí với AI nên khung nhận diện lệch khỏi hình, và còn vẽ cả khung người. Người xem không thấy đủ toàn cảnh như ở ô trên lưới.

## Đề xuất
- Dùng lại `DemoVideoWithBoxes` của ô trên lưới với chế độ `contain` (video nằm trọn trong khung, không cắt, không méo), khung video cao `min(62vh, 640px)`.

## Tiêu chí nghiệm thu
- [ ] Video dọc và ngang đều đúng tỉ lệ, nằm trọn trong khung; cửa sổ vừa màn hình.
- [ ] Khung nhận diện khớp vật và theo đúng vị trí video như ở ô trên lưới.
