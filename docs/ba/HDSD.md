# HDSD — Hướng dẫn sử dụng SafeSight

> Dành cho người dùng cuối theo từng vai trò. Cài đặt và vận hành kỹ thuật xem [wiki/03](../../wiki/03-cai-dat-va-van-hanh.md).

## 1. Đăng nhập

1. Mở địa chỉ hệ thống (mặc định `http://<máy chủ>:3000`).
2. Nhập email và mật khẩu do quản trị cấp, bấm **Đăng nhập**.
3. Sai thông tin: hệ thống báo lỗi chung; thử lại hoặc liên hệ quản trị.

Menu trái chỉ hiện các trang bạn có quyền xem.

## 2. Dành cho cán bộ an toàn và giám sát viên

### 2.1 Theo dõi camera
- Vào **Camera**. Mỗi ô là một camera; khung màu trên người: xanh = có PPE, đỏ = thiếu.
- Bật **Chỉ hiện camera đang vi phạm** để màn hình chỉ còn chỗ cần chú ý.
- Ô viền đỏ nghĩa là có vi phạm đang diễn ra; nhấn vào ô để xem chi tiết sự kiện.

### 2.2 Nhắc nhở qua loa
1. Trên ô camera đang vi phạm, **giữ** nút micro, nói, rồi **thả**.
2. Loa công trường của camera đó phát lại (trang **Loa công trường** phải đang mở trên máy tính bảng ở hiện trường và đã bấm **Mở loa** một lần).
3. Ghi âm tự dừng sau 30 giây. Nếu nút báo lỗi phát, kiểm tra trang loa có mở không.

### 2.3 Xử lý vi phạm
1. Vào **Vi phạm**, lọc theo loại / mức / trạng thái nếu cần.
2. Nhấn dòng vi phạm để xem ảnh bằng chứng (khung đỏ tại chỗ thiếu) và tab **Agent** (mức tin cậy VERIFIED / PROBABLE / POSSIBLE và quan sát của trợ lý).
3. Chọn trạng thái: **Đã xử lý** nếu vi phạm thật và đã nhắc nhở; **Báo oan** nếu ảnh không đúng.
4. Từ danh sách có thể bấm **Đã xử lý** ngay trên dòng ở trạng thái mở.
5. **Xoá** cần xác nhận và không hoàn tác; chỉ dùng cho bản ghi thử nghiệm.

### 2.4 Cảnh báo
Trang **Thông báo** liệt kê cảnh báo đã gửi (kênh, người nhận, lỗi nếu có). Bấm **Xác nhận** để đánh dấu đã biết.

## 3. Dành cho quản lý công trường

- **Bảng điều khiển**: KPI, xu hướng tuân thủ, phân bố vi phạm, trạng thái công trường.
- **Phân tích**: chọn 7 / 30 / 90 ngày để xem xu hướng và top camera vi phạm.
- **Telegram**: tin đầu tiên là "nhắc nhở", tin tiếp theo cho cùng người là "leo thang". Ngưỡng và thời gian chờ do quản trị đặt trong quy tắc cảnh báo.
- **Agent** (trang Agent): đọc dòng thời gian để biết đêm qua hệ thống đã làm gì; gõ câu hỏi tiếng Việt vào ô hỏi đáp, ví dụ "Hôm nay camera nào vi phạm nhiều nhất?".

## 4. Dành cho quản trị tổ chức

### 4.1 Thêm camera
1. **Cài đặt → Giám sát → Thêm camera**.
2. Nhập tên, chọn công trình, vị trí lắp đặt.
3. Nguồn video: **Webcam** (chỉ số thiết bị), **RTSP** (địa chỉ dạng `rtsp://user:pass@ip:554/...`), hoặc **Video mẫu** (chọn video đã tải, tối đa 200MB).
4. Lưu. Camera xuất hiện trên trang Camera trong vài giây; trợ lý tự thăm dò kết nối.

Đặt trạng thái **Bảo trì** khi tháo camera để AI bỏ qua.

### 4.2 Cấu hình Telegram
1. Tạo bot với @BotFather, lấy token; thêm bot vào nhóm nhận cảnh báo và lấy chat_id của nhóm (số âm cho group).
2. **Cài đặt → Thông báo → Bot Telegram**: dán token, bấm **Kiểm tra kết nối** (hiện tên bot là đúng), bật công tắc, **Lưu**.
3. **Quy tắc cảnh báo → Thêm**: tên, công trường, loại vi phạm (để trống = mọi loại), kênh Telegram, chat_id người nhận, **Ngưỡng** (số vi phạm để bắt đầu gửi, thường 1), **Cooldown** (giây chờ giữa hai lần gửi, ví dụ 300), bật **Kích hoạt**.
4. Thử bằng cách đứng trước camera không đội mũ: nhóm nhận ảnh sau vài giây.

### 4.3 Người dùng
**Người dùng**: sửa vai trò và công trường được gán (quản lý công trường chỉ thấy công trường trong danh sách này). Tạo người dùng mới hiện do kỹ thuật viên thực hiện qua cơ sở dữ liệu (đang trong lộ trình).

### 4.4 Agent
Trang **Agent**:
- **Bật agent**: tắt khi nghi ngờ phán đoán sai; hệ thống chỉ ghi nhận, không tự đổi trạng thái hay khởi động lại gì.
- **Model**, **Độ kỹ khi review**, **Trần token / ngày**, **Giờ báo cáo ca**: thay đổi có hiệu lực trong ≤ 20 giây.
- **Sweep gần nhất** và **Hàng đợi** cho biết trợ lý đang làm gì; **Dòng thời gian** ghi mọi hành động.

### 4.5 Kiểm thử Roboflow
Trang **Kiểm thử Roboflow** để so model cloud với model tại chỗ trên một ảnh; **mỗi lần chạy tốn 1 credit**, chỉ dùng khi cần đối chiếu.

## 5. Câu hỏi thường gặp

| Tình huống | Cách xử lý |
|---|---|
| Ô camera đen, không hình | Kiểm tra nguồn trong Cài đặt → Giám sát; xem trang Agent có báo `camera.stalled` không |
| Có vi phạm nhưng không nhận Telegram | Kiểm tra bot đã bật, quy tắc đang kích hoạt, chat_id đúng, và có đang trong cooldown không (trang Thông báo ghi lỗi gửi nếu có) |
| Khung đỏ hiện dù người đã đội mũ | Mở chi tiết, đánh dấu **Báo oan**; nếu lặp lại nhiều, báo kỹ thuật để nghiệm thu lại model |
| Loa không phát | Trang Loa công trường phải mở đúng camera và đã bấm **Mở loa** |
| Trợ lý không trả lời | Kiểm tra công tắc agent, trần token ngày và khoá API trong cấu hình máy chủ |
