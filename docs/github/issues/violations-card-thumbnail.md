# Thẻ vi phạm phải hiện ảnh bằng chứng trước khi bấm vào
branch: fix/violations-card-thumbnail

## Vấn đề
Trên `/violations`, thẻ chỉ vẽ `clipUrl` trong một `<video>` không có ảnh bìa: thẻ có clip thì khung đen cho tới khi rê chuột vào, thẻ không có clip thì chỉ hiện biểu tượng khiên. Ảnh chụp bằng chứng (`snapshotUrl`) chỉ thấy được sau khi mở modal chi tiết.

## Đề xuất
- Thẻ có clip: dùng ảnh chụp làm `poster` của video.
- Thẻ không có clip: hiện thẳng ảnh chụp thay cho biểu tượng; biểu tượng chỉ còn khi không có cả hai.

## Tiêu chí nghiệm thu
- [ ] Mọi thẻ có `snapshotUrl` hiện ảnh ngay khi mở trang, không cần rê chuột hay bấm vào.
- [ ] Rê chuột vẫn phát clip như cũ.
