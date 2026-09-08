# 07 — Mô tả màn hình (screen spec)

Mỗi màn hình một bảng: `STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc`. Tối đa 5 trường bắt buộc / màn hình. Thứ tự trường theo đúng giao diện.

## SCR-01 Đăng nhập (`/login`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Email | free text (email) | Có | trống | Định dạng email; khớp `User.email` |
| 2 | Mật khẩu | password | Có | trống | So với `passwordHash` (bcrypt) |
| 3 | Đăng nhập | button | — | — | Sai thông tin → thông báo lỗi chung, không nói rõ sai email hay mật khẩu; đúng → về `/` |

## SCR-02 Bảng điều khiển (`/`)

Màn hình hiển thị, không có trường nhập. Thành phần: 4 thẻ KPI (tổng vi phạm, tỉ lệ tuân thủ, camera online, cảnh báo mới), biểu đồ xu hướng tuân thủ 7 ngày, donut vi phạm theo loại, dòng thời gian cảnh báo, lưới trạng thái công trường. Dữ liệu tính từ `/api/violations`; số camera online hiện lấy từ roster mẫu (P2 chuyển sang bảng `Camera`).

## SCR-03 Camera (`/cameras`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Chỉ hiện camera đang vi phạm | checkbox | Không | bỏ tích | Tích → ẩn ô camera không có vi phạm đang diễn ra |
| 2 | Ô camera | frame (card) | — | — | Video + khung detection; viền đỏ khi có vi phạm; nhấn mở modal sự kiện trực tiếp (tab Agent) |
| 3 | Mic | button (giữ để nói) | — | ẩn | Chỉ hiện trên ô đang vi phạm; giữ → ghi âm, thả → gửi tới loa công trường; tự dừng sau 30s |

## SCR-04 Loa công trường (`/site-speaker`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Camera | single choice dropdown (danh mục Camera) | Có | camera đầu tiên | Chỉ nhận audio gửi cho camera đã chọn |
| 2 | Mở loa | button | — | — | Bắt buộc nhấn một lần để mở khoá autoplay trên máy tính bảng |
| 3 | Trạng thái phát | label | — | "Chờ" | "Đang phát" khi phát thành công; lỗi phát → hiện lỗi, không đánh dấu đã phát |

## SCR-05 Vi phạm (`/violations`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Tìm kiếm | free text | Không | trống | Lọc theo camera, loại |
| 2 | Loại vi phạm | dropdown fix cứng (`ViolationType`) | Không | Tất cả | 16 giá trị; nhãn tiếng Việt |
| 3 | Mức độ | dropdown fix cứng (`Severity`) | Không | Tất cả | critical / high / medium / low |
| 4 | Trạng thái | dropdown fix cứng (`ViolationStatus`) | Không | Tất cả | open / under_review / resolved / false_positive |
| 5 | Bảng vi phạm | table | — | mới nhất trước | Cột: thời gian, camera, loại, mức, độ tin cậy, số lần, trạng thái, band agent |
| 6 | Đã xử lý | button (mỗi dòng) | — | — | Chỉ hiện khi trạng thái `open`; nhấn → `resolved`, toast xác nhận |
| 7 | Xoá | icon (mỗi dòng) | — | — | Hộp xác nhận "Không thể hoàn tác"; lỗi → toast |
| 8 | Chi tiết | textlink (dòng) | — | — | Mở SCR-06, tự chuyển `open → under_review` |

## SCR-06 Chi tiết vi phạm (modal, mở từ SCR-05 hoặc SCR-03)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Tab | tab: Bằng chứng / Agent | — | Bằng chứng | |
| 2 | Ảnh bằng chứng | image + bbox overlay | — | snapshot | Khung đỏ tại vị trí thiếu PPE; hệ thống tự sinh, không sửa |
| 3 | Thông tin | section chỉ đọc | — | — | Camera, công trường, loại, mức, độ tin cậy, thời gian, số lần tái diễn |
| 4 | Trạng thái | dropdown fix cứng | — | trạng thái hiện tại | Đổi → PATCH ngay, toast |
| 5 | Mic | button (giữ để nói) | — | — | Gửi tới loa của camera này |
| 6 | Tab Agent · Thẻ phán quyết | card chỉ đọc | — | "Chưa review" | Band (VERIFIED/PROBABLE/POSSIBLE), verdict, chip quan sát, ghi chú, thời điểm |
| 7 | Tab Agent · Câu hỏi | free text (textarea) | Có khi gửi | trống | Gửi → poll 2s, "Agent đang trả lời…", im lặng 90s coi là xong |
| 8 | Quay lại | button | — | — | Đóng modal |

## SCR-07 Thông báo (`/alerts`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Bảng cảnh báo | table | — | mới nhất trước | Cột: thời gian, vi phạm, kênh, người nhận, trạng thái, lỗi gửi |
| 2 | Xác nhận | button (mỗi dòng) | — | — | Chỉ khi `new`; nhấn → `acknowledged` |

## SCR-08 Công trường (`/sites`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Trạng thái | dropdown fix cứng | Không | TẤT CẢ | TẤT CẢ / HOẠT ĐỘNG / THIẾT LẬP |
| 2 | Thẻ công trường | card | — | — | Tên, địa chỉ, số camera, số cảnh báo, tỉ lệ tuân thủ; nhấn mở modal chi tiết (tab Agent) |
| 3 | Thêm công trường · Tên | free text | Có | trống | ≤ 100 ký tự |
| 4 | Thêm công trường · Địa chỉ | free text | Không | trống | |
| 5 | Thêm công trường · Trạng thái | hệ thống tự sinh | — | SETUP | Không sửa ở màn thêm mới |

## SCR-09 Phân tích (`/analytics`)

Màn hình hiển thị: biểu đồ xu hướng tuân thủ theo ngày, donut theo loại vi phạm, bảng top camera vi phạm. Bộ lọc thời gian: dropdown fix cứng 7 / 30 / 90 ngày, mặc định 7.

Bên dưới các biểu đồ hiện có (v0.9): hai khối **bản đồ nhiệt vi phạm**, dùng chung nút lọc 7/30/90 ngày (mặc định 30) — riêng cho hai khối này, không ảnh hưởng các khối phía trên.
- **Theo giờ và thứ trong tuần**: lưới 7×24 (thứ × giờ), ô càng đậm càng nhiều vi phạm rơi vào khung giờ đó; hover xem số liệu (tooltip).
- **Theo vị trí trên camera**: dropdown chọn camera, vẽ chấm mờ tại tâm bbox từng vi phạm chồng lên ảnh xem trước `preview_<cameraId>.jpg`; ảnh lỗi/chưa có thì hiện nền xám + thông báo, chấm vẫn vẽ bình thường.

## SCR-10 Agent (`/agent`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Bật agent | switch | — | theo `AgentSettings` | Tắt → agent chỉ ghi nhận, không hành động; lưu ngay |
| 2 | Model | dropdown fix cứng | — | `claude-opus-5` | `claude-opus-5` / `claude-sonnet-5` |
| 3 | Độ kỹ khi review | dropdown fix cứng | — | `medium` | low / medium / high |
| 4 | Trần token / ngày | number | — | theo cài đặt | Số nguyên ≥ 0, không thập phân; lưu khi rời ô |
| 5 | Giờ báo cáo ca | time | — | theo cài đặt | HH:mm |
| 5b | Giờ báo cáo tuần | dropdown thứ + time | — | `MON 08:00` | Thứ 2…Chủ nhật + HH:mm; lưu ngay khi đổi thứ, lưu khi rời ô giờ |
| 6 | Sweep gần nhất | card chỉ đọc | — | — | Thời điểm, phát hiện, hành động |
| 7 | Hàng đợi | table chỉ đọc | — | — | kind, đối tượng, lý do, lần thử, hạn |
| 8 | Dòng thời gian | list chỉ đọc | — | 50 sự kiện mới nhất | Icon theo loại sự kiện, giờ HH:mm:ss |
| 9 | Câu hỏi toàn hệ thống | free text (textarea) + button | Có khi gửi | trống | Giống SCR-06 mục 7 |
| 10 | Capabilities | chip chỉ đọc | — | — | Có/không `ANTHROPIC_API_KEY`, `.venv`, model |
| 11 | Bật subagent camera | switch (trên từng thẻ camera) | — | `true` | Lưu ngay, có toast; tắt → camera đó không chạy phiên nào |
| 12 | Nhịp tổng hợp (phút) | number | — | `30` | Số nguyên 5–1440; lưu khi rời ô, ngoài khoảng thì bỏ qua |
| 13 | Token hôm nay | thanh tiến trình chỉ đọc | — | `0 / 300.000` | `đã dùng / trần`; thanh đổi sang màu cảnh báo khi > 80% |
| 14 | Digest gần nhất · Vi phạm mở · Báo oan 24h | 3 ô số chỉ đọc | — | `chưa có` / `0` / `0%` | Thời điểm digest cuối, số vi phạm `OPEN`, tỉ lệ `FALSE_POSITIVE` trong 24h |
| 15 | Trí nhớ camera | list chỉ đọc | — | `(chưa có ghi chú)` | 3 ghi chú mới nhất, mono 12px, tiền tố `#<chỉ số> <ngày>`; panel camera hiện đủ 20 |
| 16 | Tổng hợp ngay / Xoá trí nhớ | 2 button | — | — | "Tổng hợp ngay" tắt khi subagent tắt, toast kèm mã task; "Xoá trí nhớ" hỏi xác nhận rồi xoá toàn bộ |

## SCR-11 Kiểm thử Roboflow (`/roboflow`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Workflow | radio 2 nút | — | `detech-ppe` | `detech-ppe` / `ppes-kaxsi`; đổi → chạy lại ảnh đang xem (tốn 1 credit) |
| 2 | Ảnh | file (kéo thả, jpg/png) | Có | trống | Thu nhỏ về 640px trên trình duyệt trước khi gửi |
| 3 | Kết quả | image + bbox, bảng class / confidence, độ trễ | — | — | Chỉ đọc |

## SCR-12 Người dùng (`/users`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Bảng người dùng | table | — | — | Tên, email, vai trò, công trường, trạng thái |
| 2 | Sửa · System Role | dropdown fix cứng (`UserRole`) | Có | vai trò hiện tại | 5 vai trò |
| 3 | Sửa · Assigned Sites | checkbox nhiều lựa chọn (danh mục Site) + Select All | Không | site hiện tại | Áp dụng cho Quản lý công trường |
| 4 | Xoá | icon | — | — | Xác nhận trước khi xoá |

Màn cập nhật (`UserEditDialog`): không sửa email và mật khẩu tại đây — đổi mật khẩu tự phục vụ ở `/profile` (SCR-18).

## SCR-17 Người dùng — dialog "Thêm người dùng" (`AddUserDialog`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Họ và Tên | free text | Có | trống | |
| 2 | Email | free text (email) | Có | trống | 409 nếu trùng email đã có |
| 3 | Mật khẩu | password | Có | trống | Tối thiểu 8 ký tự; băm bcrypt trước khi lưu |
| 4 | Vai trò | dropdown fix cứng (`UserRole`) | Có | Giám sát viên | 5 vai trò |
| 5 | Công trường được gán | checkbox nhiều lựa chọn (danh mục Site) | Không | rỗng | |

`orgId` của user mới lấy theo tổ chức của người tạo (không hiển thị, tự động).

## SCR-13 Cài đặt (`/settings`) — tab Giám sát: Thêm / sửa camera

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Tên camera | free text | Có | trống | Ví dụ "Webcam laptop test" |
| 2 | Công trình | dropdown (danh mục Site, lọc theo tổ chức) | Có | site đầu tiên | |
| 3 | Vị trí lắp đặt | free text | Không | trống | Ví dụ "Cổng chính" |
| 4 | Nguồn video | radio: Webcam / RTSP / Video mẫu | Có | Video mẫu | Webcam → nhập chỉ số (`webcam:0`); RTSP → nhập URL `rtsp://user:pass@host:554/...`; Video mẫu → dropdown từ `/api/videos` kèm nút tải video ≤ 200MB |
| 5 | Vùng nhận diện | trình vẽ đa giác trên ảnh xem trước | Không | vùng đã lưu của camera | Chỉ hiện khi SỬA camera đã có. Bấm ảnh = thêm điểm, kéo = di chuyển, chuột phải lên điểm = xoá; tối đa 10 vùng, mỗi vùng 3–20 điểm. Nút "Lưu vùng" gọi `PUT /api/cameras/[id]/zones` riêng, không đi cùng nút Lưu của dialog |
| 6 | Trạng thái | dropdown fix cứng (`CameraStatus`) | — | ONLINE | Khác ONLINE thì AI bỏ qua camera |

Màn cập nhật khác thêm mới: `id` không sửa; đổi nguồn → agent thăm dò lại camera.

Trạng thái của trình vẽ vùng: đang tải danh sách vùng = khối skeleton; chưa có
`public/snapshots/preview_<id>.jpg` = "Chưa có ảnh xem trước — chạy AI engine trước"
và nút Lưu bị khoá; vùng chưa đủ 3 điểm không được lưu (có toast nhắc). Lưu danh
sách rỗng = xoá hết vùng, AI xét lại toàn khung hình.

## SCR-14 Cài đặt — tab Thông báo: Bot Telegram

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Bật cảnh báo Telegram | switch | — | tắt | |
| 2 | Bot Token | password | Có khi lưu lần đầu | "Đã cấu hình" nếu có | Mã hoá AES-256-GCM trước khi lưu; không hiển thị lại |
| 3 | Kiểm tra kết nối | button | — | — | Gọi `getMe`; thành công hiện tên bot, thất bại hiện lỗi |
| 4 | Lưu | button | — | — | Thiếu `TELEGRAM_ENCRYPT_KEY` → lỗi rõ ràng |

Thẻ **Zalo OA** nằm ngay dưới, cùng bố cục:

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Bật cảnh báo Zalo | switch | — | tắt | |
| 2 | Access Token | password | Có khi lưu lần đầu | "Đã cấu hình" nếu có | Mã hoá AES-256-GCM trước khi lưu; token OA hết hạn sau 25 giờ, nhập lại khi cần |
| 3 | Kiểm tra kết nối | button | — | — | Gọi `getoa`; thành công hiện thông tin OA, thất bại hiện lỗi Zalo |
| 4 | Lưu | button | — | — | Chỉ SUPER_ADMIN/ORG_ADMIN |

## SCR-15 Cài đặt — tab Thông báo: Quy tắc cảnh báo (dialog)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Tên quy tắc | free text | Có | trống | Ví dụ "Cảnh báo thiếu mũ bảo hộ" |
| 2 | Công trường | dropdown (danh mục Site được phép) | Có | site đang chọn | Quản lý công trường chỉ thấy site được gán |
| 3 | Loại vi phạm | checkbox nhiều lựa chọn (`ViolationType`) | Không | trống = mọi loại | |
| 4 | Kênh gửi | checkbox (`AlertChannel`) | Có | Telegram | Đã nối: Telegram, Zalo OA, Webhook; mỗi kênh bật lên hiện một ô người nhận riêng ở mục 5 và bắt buộc ≥ 1 giá trị |
| 5 | Người nhận theo kênh | danh sách free text (một khối cho mỗi kênh đang bật) | Có với mọi kênh đã nối đang bật | trống | Telegram: chat_id chỉ số, có thể `-` ở đầu cho group. Zalo OA: user id chỉ số. Webhook: URL `https://`. Lưu chung `recipients` với tiền tố kênh (`zalo:`, `webhook:`); mục không tiền tố là chat_id Telegram của quy tắc cũ |
| 6 | Ngưỡng (số vi phạm) | number | — | 1 | Số nguyên ≥ 1 |
| 7 | Cooldown (giây) | number | — | 300 | Số nguyên ≥ 0 |
| 8 | Kích hoạt quy tắc | switch | — | bật | |

Trường bắt buộc: 1, 2, 4, 5 (có điều kiện) → 4 ≤ 5.

## SCR-16 Cài đặt — tab Tài khoản & Tổ chức

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Họ và Tên | free text | Có | tên người dùng | Hiện chưa lưu (P2) |
| 2 | Địa chỉ Email | free text (email) | Có | email | Không sửa |
| 3 | Tên Công ty | free text | Không | tên tổ chức | Hiện chưa lưu (P2) |
| 4 | Ngành nghề | free text | Không | trống | Hiện chưa lưu (P2) |

## SCR-18 Hồ sơ cá nhân (`/profile`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Họ và Tên, Email, Vai trò | text chỉ đọc | — | thông tin session | Không sửa tại đây (đổi ở `/users`, cần quyền admin) |
| 2 | Mật khẩu Hiện tại | password | Có | trống | So khớp bcrypt với `passwordHash` |
| 3 | Mật khẩu Mới | password | Có | trống | Tối thiểu 8 ký tự |
| 4 | Xác nhận Mật khẩu Mới | password | Có | trống | Phải khớp mục 3 (kiểm phía client) |

Tài khoản dev cứng (`admin@safesight.ai`, không có dòng `User` trong DB) không đổi được mật khẩu — API trả lỗi rõ ràng. Quên mật khẩu (khi không nhớ mật khẩu cũ, cần gửi email) chưa làm, để backlog.

## SCR-19 Cài đặt — tab Nhật ký (`AuditLogCard`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Bảng nhật ký | table | — | 100 dòng mới nhất | Cột: Thời gian, Người dùng, Hành động, Đối tượng, Chi tiết |

Trạng thái tải: skeleton khi đang tải, thông báo lỗi màu đỏ khi tải hỏng, dòng chữ nhạt khi rỗng.

## SCR-20 Báo cáo (`/reports`)

| STT | Tên trường | Kiểu dữ liệu | Bắt buộc | Giá trị khởi tạo | Mô tả ràng buộc |
|---|---|---|---|---|---|
| 1 | Công trường | dropdown động | — | Tất cả công trường | Chỉ các công trường trong phạm vi người dùng; đổi công trường thì xoá lựa chọn camera |
| 2 | Camera | dropdown động | — | Tất cả camera | Lọc theo công trường đã chọn |
| 3 | Từ ngày / Đến ngày | date | — | 7 ngày gần nhất | `Từ ngày` ≤ `Đến ngày` (ràng buộc bằng `min`/`max` của input) |
| 4 | 4 ô số tổng | card chỉ đọc | — | `0` | Tổng vi phạm, vi phạm thật (`RESOLVED`), báo oan (`FALSE_POSITIVE`), còn mở (`OPEN` + `UNDER_REVIEW`) |
| 5 | Tổng hợp theo camera | table chỉ đọc | — | — | Cột: Camera, Công trường, Tổng, Thật, Báo oan, Còn mở; camera nhiều vi phạm nhất lên đầu |
| 6 | Chi tiết vi phạm | table chỉ đọc | — | 200 dòng mới nhất | Cột: Thời gian, Camera, Loại, Mức độ, Trạng thái; API trả tối đa 2.000 dòng |
| 7 | Xuất CSV | button | — | — | Tắt khi không có dòng nào; file UTF-8 có BOM, xuất đủ số dòng API trả về |
| 8 | In / PDF | button | — | — | `window.print()`; bản in bỏ sidebar/header/bộ lọc và đổi sang nền sáng |
| 9 | Báo cáo tuần của agent | đoạn văn chỉ đọc | — | `Chưa có báo cáo tuần nào` | Sự kiện `report` mới nhất của agent, hiện theo đoạn (không render markdown thô) |

Trạng thái tải: skeleton khi đang tải, thông báo lỗi màu đỏ khi tải hỏng, dòng chữ nhạt khi khoảng ngày không có vi phạm.
