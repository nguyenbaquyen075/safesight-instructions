# URD — Tài liệu yêu cầu người dùng (User Requirements Document)

> Cập nhật 2026-09-07. Nhu cầu theo từng vai trò, viết bằng ngôn ngữ người dùng; ánh xạ tới user story và chức năng.

## 1. Nhóm người dùng

| Vai trò | Mô tả ngắn | Thiết bị chính |
|---|---|---|
| Cán bộ an toàn (`SAFETY_OFFICER`) | Trực camera, nhắc nhở, xử lý vi phạm | Máy tính phòng trực |
| Giám sát viên (`SUPERVISOR`) | Theo dõi hiện trường, nhắc nhở qua loa | Máy tính bảng |
| Quản lý công trường (`SITE_MANAGER`) | Điều hành công trường được giao, nhận Telegram, đọc báo cáo | Điện thoại + máy tính |
| Quản trị tổ chức (`ORG_ADMIN`) | Cấu hình camera, cảnh báo, người dùng, agent | Máy tính |
| Quản trị hệ thống (`SUPER_ADMIN`) | Toàn quyền, nhiều tổ chức | Máy tính |

## 2. Yêu cầu người dùng

| ID | Vai trò | Người dùng cần | Lý do | Ánh xạ |
|---|---|---|---|---|
| UR-01 | Cán bộ an toàn | Thấy ngay ai đang thiếu PPE trên video, không phải tự soi | Phản ứng trong vài giây | US-01, F-CAM-01 |
| UR-02 | Cán bộ an toàn | Hệ thống không kêu khi người chỉ cúi xuống hoặc khuất một giây | Tin được cảnh báo | US-02, F-AI-02 |
| UR-03 | Cán bộ an toàn, Giám sát viên | Nói qua loa ngay từ màn hình | Không phải chạy ra hiện trường | US-04 |
| UR-04 | Cán bộ an toàn | Đánh dấu vi phạm đã xử lý / báo oan trong một chạm | Danh sách luôn đúng thực tế | US-05 |
| UR-05 | Quản lý công trường | Nhận tin kèm ảnh trên điện thoại khi có vi phạm, và biết khi nó lặp lại | Biết dù đang ở ngoài | US-06 |
| UR-06 | Quản lý công trường | Không nhận hàng chục tin cho cùng một người | Không tắt thông báo vì bị dội | US-07 |
| UR-07 | Quản lý công trường | Xem xu hướng tuân thủ theo ngày, theo camera | Họp đội có số liệu | US-15 |
| UR-08 | Quản lý công trường | Chỉ thấy công trường của mình | Không nhầm, không lộ dữ liệu công trường khác | US-16 |
| UR-09 | Quản trị tổ chức | Thêm camera RTSP / webcam trong vài phút | Mở rộng giám sát không cần lập trình | US-09 |
| UR-10 | Quản trị tổ chức | Kiểm tra bot Telegram trước khi tin dùng | Không phát hiện sai token vào lúc có sự cố | US-08 |
| UR-11 | Quản trị tổ chức | Demo hệ thống bằng video mẫu khi chưa có camera | Trình bày cho khách hàng | US-10 |
| UR-12 | Mọi vai trò | Ảnh bằng chứng khoanh đúng chỗ thiếu | Nhắc nhở công bằng, báo cáo được | US-03 |
| UR-13 | Quản lý công trường | Có "người trực đêm" tự phát hiện camera / hệ thống đứng | Không mất dữ liệu cả đêm | US-12 |
| UR-14 | Cán bộ an toàn | Trợ lý xem trước và nói vi phạm nào chắc chắn | Ưu tiên đúng việc | US-11 |
| UR-15 | Quản trị tổ chức | Tắt trợ lý bằng một công tắc | Giữ quyền kiểm soát | US-13 |
| UR-16 | Quản lý công trường | Hỏi bằng tiếng Việt "hôm nay thế nào" | Không tự lọc dữ liệu | US-14 |
| UR-17 | Quản lý công trường | Xuất báo cáo tuần gửi chủ đầu tư | Nghĩa vụ báo cáo | US-17 (backlog) |
| UR-18 | Mọi vai trò | Tự đổi mật khẩu | Bảo mật tài khoản | US-18 (backlog) |

## 3. Ràng buộc từ phía người dùng

- Toàn bộ giao diện và thông báo bằng tiếng Việt; thuật ngữ PPE dịch rõ ("mũ bảo hộ", "áo phản quang").
- Phòng trực dùng nền tối, chữ lớn; máy tính bảng ngoài trời cần nút chạm lớn.
- Người dùng không cài phần mềm: chỉ trình duyệt; kỹ thuật viên cài một lần trên máy chủ.
- Không lưu video liên tục; chỉ lưu ảnh tại thời điểm vi phạm.

## 4. Chưa đáp ứng (theo dõi ở lộ trình)

UR-17, UR-18; số camera online trên bảng điều khiển lấy từ dữ liệu thật; lọc theo vùng để bỏ người ngoài hàng rào; responsive trên điện thoại.
