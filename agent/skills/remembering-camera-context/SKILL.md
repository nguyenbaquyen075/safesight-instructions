---
name: remembering-camera-context
description: Dùng khi phiên thuộc về một camera (có mục "Trí nhớ camera" trong lời mở đầu) và bạn sắp gọi remember_camera, hoặc khi trí nhớ cũ mâu thuẫn với điều vừa quan sát.
---
# Trí nhớ camera

Trí nhớ camera là danh sách ngắn (tối đa 20) những **sự thật bền** về một camera mà phiên sau
dùng lại mà không cần đọc lại lịch sử. Trong lời mở đầu mỗi ghi chú hiện dạng `- #<chỉ số> [ngày] nội dung`;
`<chỉ số>` là giá trị `replaceIndex` khi cần sửa. Hệ thống tự lưu ngày và phiên ghi; bạn chỉ ghi nội dung.

## Một ghi chú là gì

Một ghi chú = **một** sự thật bền, viết theo đúng thứ tự ba phần, ≤ 300 ký tự:

```
<điều kiện hoặc khu vực> → <ảnh hưởng tới nhận diện> → <cách xử lý khi review>
```

Ví dụ đạt:

```
16h–17h nắng chiều chiếu thẳng ống kính → găng tay hay bị báo oan → giờ này chỉ kết luận thiếu găng khi thấy rõ bàn tay trần
```

```
Góc trái khung là vỉa hè ngoài hàng rào → người đi đường bị khoanh khung → đánh person-outside-work-zone, không record_verdict violation
```

Điều kiện viết theo khung giờ tròn ("16h–17h"), không theo phút của một ngày. Ghi chú không chứa ngày tháng (hệ thống đã lưu), số đếm của một ngày, lời kể về việc chỉnh sửa, id vi phạm, tên người.

## Bền hay không bền

| Bền → `remember_camera` | Không bền → `write_note` / `schedule_followup` |
|---|---|
| Góc máy, vùng nhìn, vật che khuất cố định | Một vi phạm, một người, một ca |
| Khung giờ ngược sáng, đèn nhấp nháy, mưa che ống kính theo mùa | Số vi phạm hôm nay |
| Khu vực ngoài hàng rào / vùng không phải nơi làm việc | Sự cố camera đứng một lần |
| Loại báo oan lặp lại nhiều ngày và nguyên nhân | Nghi ngờ chưa xác minh |
| Lịch làm việc cố định (ca đêm, giờ giao vật tư) | Việc cần làm trong ca |

Quy tắc chốt: điều đó có còn đúng **tuần sau** không? Có → trí nhớ. Không → nhận xét hoặc hẹn xem lại.

## Khi trí nhớ cũ sai

Ghi chú cũ mâu thuẫn với điều vừa quan sát → gọi `remember_camera` với `replaceIndex` của ghi chú
đó và nội dung **mới hoàn toàn** theo công thức trên. Không thêm ghi chú thứ hai để "đính chính".

## Trước khi ghi

1. Đã có ghi chú cùng ý trong "Trí nhớ camera" → không ghi lại, chỉ sửa nếu sai.
2. Sự thật đến từ nhiều lần quan sát hoặc người dùng đã xác nhận — một lần chưa đủ.
3. Tối đa 3 lần mỗi phiên; dùng khi đáng, không dùng cho đủ.

## Khi review một vi phạm

Trí nhớ là **gợi ý nơi cần nhìn kỹ**, không phải kết luận: trí nhớ nói "16h–17h hay báo oan găng"
thì vẫn phải nhìn bàn tay trong ảnh rồi mới ghi quan sát.

## Hẹn xem lại

`schedule_followup` chỉ nhận `kind` là `followup` (xem lại một chủ thể) hoặc `camera.digest` (tổng hợp
camera). Không có kind nào khác.
