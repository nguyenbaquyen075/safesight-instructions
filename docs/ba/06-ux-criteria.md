# 06 — Tiêu chí UX và phân tích thiết kế

Nguồn token giao diện: [`DESIGN.md`](../../DESIGN.md). Tài liệu này nêu tiêu chí nghiệp vụ mà thiết kế phải đáp ứng.

## Phân tích người dùng

| Vai trò | Ai | Trình độ CNTT | Tần suất | Bối cảnh sử dụng |
|---|---|---|---|---|
| Cán bộ an toàn, Giám sát viên | Nhân sự an toàn tại công trường, 25–50 tuổi | Cơ bản | Cả ca, nhiều lần / giờ | Phòng trực hoặc máy tính bảng ngoài hiện trường, ánh sáng mạnh, tay bận, cần phản ứng trong vài giây |
| Quản lý công trường | Chỉ huy công trường | Cơ bản đến khá | Vài lần / ngày | Xem tình hình, quyết định nhắc nhở, đọc báo cáo ca |
| Quản trị tổ chức / hệ thống | Bộ phận kỹ thuật, IT | Khá | Khi cấu hình | Thêm camera, cấu hình Telegram, người dùng, agent |

## Phân tích tác vụ đặc trưng

1. **Nhìn thấy vi phạm ngay:** mở dashboard hoặc lưới camera, vi phạm phải nổi bật bằng màu đỏ và khung trên video, không cần tìm.
2. **Xác minh trong 10 giây:** mở chi tiết, xem ảnh bằng chứng có khung tại vị trí thiếu PPE, đọc phán quyết của agent (band + quan sát), quyết định thật hay báo oan.
3. **Hành động một chạm:** nhắc nhở qua mic ngay trên ô camera đang vi phạm; đánh dấu đã xử lý ngay trên danh sách.
4. **Cấu hình một lần:** Telegram, quy tắc cảnh báo, camera đặt trong Cài đặt, có kiểm tra kết nối trước khi lưu.

## Tiêu chí trải nghiệm

| Tiêu chí | Áp dụng trong SafeSight |
|---|---|
| Chính trực | Mọi vi phạm kèm ảnh bằng chứng và độ tin cậy; agent ghi rõ band và quan sát, không giấu phán quyết; audit mọi hành động tự động |
| Giải pháp | Giảm báo oan (chốt ≥ 3s, agent review) để người dùng không mất niềm tin vào cảnh báo |
| Kỳ vọng | Cảnh báo Telegram đến trong vòng vài giây sau khi chốt; khung hiển thị đúng vị trí trên video (đồng bộ `videoPos`) |
| Sự đồng cảm | Tiếng Việt toàn bộ giao diện; nhãn vi phạm dễ hiểu ("Thiếu mũ bảo hộ"); nền tối cho phòng trực 24/7 |
| Cá nhân hoá | Menu và trang theo vai trò; quản lý công trường chỉ thấy công trường của mình |
| Thời gian và công sức | Một lệnh chạy cả hệ thống; thao tác chính ≤ 2 chạm; giá trị mặc định cho mọi form |

## Nguyên tắc hình ảnh và đồng nhất

- Màu ngữ nghĩa cố định: đỏ = vi phạm / nguy hiểm, vàng = cảnh báo / chờ, xanh lá = an toàn / đã xử lý, xanh dương = hành động chính. Không dùng màu khác cho các ý này.
- Lỗi hiển thị bằng toast góc màn hình kèm hướng xử lý ("Xoá thất bại, thử lại sau"); trạng thái tải và trống phải có nội dung, không để trắng.
- Mọi form dùng chung `SectionHeader`, `SettingCard`, `InputGroup`, `Switch` (`src/components/settings/ui.tsx`).
- Nút chính có focus ring rõ để dùng bàn phím; kích thước chạm ≥ 40px trên máy tính bảng.
- Khoảng cách theo lưới 4px, thẻ bo 16px, chữ nhãn 10px in hoa.

## Điểm còn yếu (đưa vào lộ trình)

- Sidebar cố định 260px, chưa responsive dưới 768px; điện thoại bị cắt nội dung (ghi nhận, chưa sửa).
- Trang Cài đặt có tab "Giám sát AI" và "Bảo mật" là mẫu tĩnh, dễ gây hiểu lầm là đã lưu.
