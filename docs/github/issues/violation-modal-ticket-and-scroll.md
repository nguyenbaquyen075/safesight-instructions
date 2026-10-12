# Biểu mẫu giao việc trong cửa sổ vi phạm méo ảnh bằng chứng và cuộn chuột làm trang nền chạy theo
branch: fix/violation-modal-ticket-and-scroll

## Vấn đề
1. Biểu mẫu "Giao việc khắc phục" hiện ảnh bằng chứng trong một dải ngang cao 160px với `object-cover`, nên ảnh dọc 1080×1920 bị cắt thành một lát méo, khó nhìn.
2. Khi cửa sổ chi tiết vi phạm đang mở, cuộn chuột trong cửa sổ (chạm đầu/cuối) hoặc trên vùng nền tối làm trang phía sau chạy lên xuống (đo thật: 700 → 2700 → 0).

## Đề xuất
- Biểu mẫu hai cột: ảnh/clip vi phạm đầy đủ bên trái, thông tin giao việc bên phải; màn hình hẹp xếp dọc.
- Khoá cuộn trang nền khi cửa sổ mở (giữ vị trí, bù thanh cuộn, trả lại khi đóng) và chặn cuộn tràn ở các vùng cuộn bên trong.

## Tiêu chí nghiệm thu
- [ ] Ảnh vi phạm hiện đủ, không méo, ở bên trái biểu mẫu; nút Giao việc thấy được ở mọi cỡ cửa sổ.
- [ ] Cuộn chuột trong cửa sổ hoặc trên nền tối không làm trang nền chạy; đóng cửa sổ trả lại vị trí cuộn.
