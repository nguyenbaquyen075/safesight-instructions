# Trang tổng quan: thông báo nhỏ và công trường không có ảnh minh hoạ
branch: fix/dashboard-illustrations

## Vấn đề
Trên bảng điều khiển, "Thông báo gần đây" chỉ có ô ảnh nhỏ 64×48 (video mẫu cố định) trong khung 300px hiện 5 dòng, còn "Trạng thái công trường" không có ảnh nào nên khó nhận ra công trường và vi phạm.

## Đề xuất
- Thông báo hiện ảnh bằng chứng của vi phạm (lớn hơn), khung cao 440px, hiện 8 thông báo.
- Mỗi công trường có ảnh minh hoạ ở đầu thẻ (ảnh bằng chứng mới nhất của công trường đó); ảnh lỗi/đã bị xoá thì dùng ảnh công trường chung.

## Tiêu chí nghiệm thu
- [ ] Mọi thông báo và mọi công trường hiện một ảnh (ảnh thật hoặc ảnh dự phòng), không có ô trống.
- [ ] Hai khung cao bằng nhau, không tràn ngang.
