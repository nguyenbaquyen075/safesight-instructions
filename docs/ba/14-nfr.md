# 14 — Yêu cầu phi chức năng (NFR)

Trạng thái: ✅ đã đáp ứng ở v0.6.0 · 🟡 một phần · 🔲 chưa.

## 1. An toàn và bảo mật

| ID | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| NFR-01 | Chế độ xác thực: đăng nhập bằng email + mật khẩu (bcrypt), session JWT có vai trò; mọi trang và API (trừ `/login`, `/api/auth`) yêu cầu đăng nhập | ✅ | NextAuth v5 Credentials |
| NFR-02 | Phân quyền theo vai trò cho trang (`PAGE_ROLES`) và theo công trường cho API (`requireSession`/`allowedSiteIds`/`assertSiteAccess`): vi phạm, camera, công trường, quy tắc cảnh báo đều cần session và lọc theo `assignedSites`; `/api/users` chỉ SUPER_ADMIN/ORG_ADMIN | ✅ | Xoá vi phạm chưa giới hạn vai trò trong cùng site |
| NFR-03 | AI Engine ghi vi phạm bằng bí mật dùng chung `X-AI-Engine-Secret`; sai thì 401 | ✅ | |
| NFR-04 | Bí mật (bot token Telegram) mã hoá AES-256-GCM khi lưu, không trả lại client | ✅ | Khoá `TELEGRAM_ENCRYPT_KEY` |
| NFR-05 | Khoá API bên thứ ba (Roboflow, Anthropic) chỉ ở server, không lộ ra trình duyệt | ✅ | |
| NFR-06 | Video camera xử lý tại chỗ, không đưa luồng video lên cloud; Roboflow chỉ cho ảnh tĩnh do người dùng chọn | ✅ | Quy tắc dự án |
| NFR-07 | Agent bị kill switch, giới hạn tần suất hành động, trần token / ngày toàn cục và trần riêng từng camera (`CameraAgent.dailyTokenCap`, mặc định 300k); `remember_camera` ≤ 3 lần/phiên; mọi hành động ghi audit `AgentEvent` | ✅ | |
| NFR-08 | YOLO Bridge có xác thực trước khi mở ra ngoài localhost | 🔲 | Lộ trình P3 |
| NFR-09 | Tải video mẫu: ≤ 200MB, chặn đường dẫn `../`, chỉ quản trị | ✅ | |
| NFR-10 | Nội dung động trong tin Telegram (HTML) được escape | 🟡 | Caption mặc định chưa escape (tồn đọng) |

## 2. Hiệu suất

| ID | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| NFR-11 | Thời gian phản hồi: khung detection tới dashboard ≤ 1s; Telegram ≤ 5s sau khi chốt; trang tải ≤ 2s trên mạng nội bộ | 🟡 | Đo tại dev; chưa đo production |
| NFR-12 | AI Engine ≥ 3 fps / camera trên CPU máy trạm; PPE mỗi 3 khung, pose mỗi khung | ✅ | Đo 3.7 fps |
| NFR-13 | Tải trọng: 1 máy chạy 6 camera demo đồng thời; bridge phát theo room để client chỉ nhận camera đang xem | ✅ | Chưa thử > 6 camera thật |
| NFR-14 | Nền tảng: Node ≥ 20 (khuyến nghị 24), Python 3.9–3.14, Linux; trình duyệt Chrome / Edge / Safari mới; máy tính bảng cho trang loa | ✅ | |
| NFR-15 | Agent: sweep 60s, tick 20s, lease 10 phút, tối đa 3 lần thử / việc | ✅ | |
| NFR-16 | Dung lượng snapshot có trần `SNAPSHOT_MAX_MB`, agent tự dọn | ✅ | |

## 3. Yêu cầu khác

| ID | Yêu cầu | Trạng thái | Ghi chú |
|---|---|---|---|
| NFR-17 | Màu sắc: nền tối theo `DESIGN.md`; đỏ = vi phạm, vàng = cảnh báo, xanh lá = an toàn, xanh dương = hành động chính; tương phản chữ ≥ 4.5:1 | ✅ | |
| NFR-18 | Quốc tế hoá: giao diện, thông báo, tài liệu tiếng Việt; định danh code, commit tiếng Anh; sẵn sàng thêm ngôn ngữ (chưa có i18n framework) | 🟡 | |
| NFR-19 | Dễ sử dụng: thao tác chính ≤ 2 chạm; form ≤ 5 trường bắt buộc; có trạng thái tải / trống / lỗi; focus ring cho bàn phím | 🟡 | Sidebar chưa responsive < 768px |
| NFR-20 | Backup: SQLite `dev.db` và thư mục `public/snapshots` sao lưu hằng ngày; Docker dùng volume `/app/data`; production chuyển PostgreSQL có backup tự động | 🔲 | Quy trình backup chưa viết |
| NFR-21 | Khả năng vận hành: một lệnh `npm run dev` chạy 4 tiến trình; tiến trình Python / agent tự chạy lại khi thoát; `/health` cho bridge và agent | ✅ | |
| NFR-22 | Khả năng kiểm thử: 45 test agent chạy trên SQLite tạm; CI lint / types / tests; nghiệm thu model bằng tỉ lệ báo oan / bỏ sót | ✅ | |
| NFR-23 | Tính suy giảm có kiểm soát: thiếu model phụ, thiếu `ANTHROPIC_API_KEY`, thiếu `.venv` thì hệ thống vẫn chạy phần còn lại và báo rõ | ✅ | |
| NFR-24 | Tài liệu: wiki kỹ thuật + bộ BA này cập nhật cùng commit khi đổi kiến trúc, trang, route, schema, model | ✅ | Quy tắc trong `AGENTS.md` |
