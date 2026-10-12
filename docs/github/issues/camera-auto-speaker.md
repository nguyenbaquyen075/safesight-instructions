# Loa tự động trên trang Camera đọc lỗi PPE đang bắt được theo vòng

## Vấn đề
Người giám sát phải nhìn màn hình `/cameras` mới biết chỗ nào đang thiếu đồ bảo hộ. Loa công trường (`/site-speaker`) hiện chỉ phát khi agent chốt vi phạm hoặc khi bấm "Phát loa", nên không có cách nào để máy đang mở trang camera tự báo miệng lỗi đang xảy ra.

## Đề xuất
- Nút "Loa tự động" trên `/cameras`: bật thì đọc to các lỗi PPE hệ thống đang bắt được bằng giọng `vi-VN` của trình duyệt ("Tại <camera>, thiếu <món>. Yêu cầu khắc phục ngay.").
- Đọc theo vòng: mỗi camera đang lỗi một lần, cách nhau 2 giây, nghỉ 10 giây giữa hai vòng để người ở hiện trường kịp khắc phục.
- Dùng thẳng detection đang hiện trên lưới (không thêm bridge event hay API), độc lập với `/site-speaker` và tool `announce` của agent.

## Tiêu chí nghiệm thu
- [ ] Bấm bật thì loa nói câu xác nhận; máy thiếu giọng tiếng Việt thì báo lỗi rõ thay vì đọc sai.
- [ ] Mỗi vòng mỗi camera lỗi được đọc đúng một lần; hết lỗi thì im; câu trước chưa đọc xong thì không dồn thêm câu.
- [ ] Tắt nút thì không đọc thêm.
