# 04 — Danh sách chức năng

Phân loại: **Workflow** (trong luồng nghiệp vụ), **Basic** (thêm / tìm / xem / sửa / xoá), **Advanced** (kỹ thuật cao), **Other** (nhập/xuất, thông báo, báo cáo…). Size: S / M / L. Phase: `v0.6` = đã có; `v0.8` = subagent theo camera (đã có, sau v0.6); `v0.9` = tạo người dùng, đổi mật khẩu, nhật ký thao tác (đã có, sau v0.8); `P1` / `P2` / `P3` = ưu tiên trong [lộ trình](../../wiki/07-lo-trinh-phat-trien.md).

| Trace code | Data object | Module | Function | Size | Type | Description / Objective / Remarks | Phase |
|---|---|---|---|---|---|---|---|
| F-AUTH-01 | User | Xác thực | Đăng nhập | S | Basic | NextAuth Credentials, JWT, vai trò trong session | v0.6 |
| F-AUTH-02 | User | Xác thực | Đăng xuất | S | Basic | Xoá session | v0.6 |
| F-AUTH-03 | User | Xác thực | Đổi mật khẩu | S | Basic | Trang `/profile`; `PATCH /api/users/me/password` xác minh mật khẩu cũ bằng bcrypt | v0.9 |
| F-AUTH-04 | User | Xác thực | Quên mật khẩu | M | Basic | Cần kênh email, chưa nối | P3 |
| F-AUTH-05 | User | Xác thực | Chặn trang theo vai trò | S | Workflow | `PAGE_ROLES`: Sidebar ẩn menu, layout chặn URL trực tiếp | v0.6 |
| F-DASH-01 | Violation | Trang chủ | Xem KPI tuân thủ | M | Advanced | KPI, xu hướng tuân thủ, donut theo loại vi phạm, dòng thời gian cảnh báo tính từ vi phạm thật. Từ v0.9 tỉ lệ tuân thủ = `1 − vi phạm / phút-người quan sát được` (`ObservationStat` + `GET /api/stats/compliance`); ngày chưa có quan sát mới rơi về ước lượng cũ và KPI ghi rõ "ước tính". Số camera online đếm từ camera thật | v0.6 → v0.9 |
| F-DASH-02 | Site | Trang chủ | Xem trạng thái công trường | S | Basic | Lưới công trường + số camera / cảnh báo | v0.6 |
| F-SITE-01 | Site | Công trường | Xem danh sách công trường | S | Basic | Lọc theo trạng thái | v0.6 |
| F-SITE-02 | Site | Công trường | Xem chi tiết công trường | S | Basic | Modal + tab Agent | v0.6 |
| F-SITE-03 | Site | Công trường | Thêm công trường | S | Basic | Mặc định trạng thái SETUP | v0.6 |
| F-SITE-04 | Site | Công trường | Sửa / xoá công trường | S | Basic | API mới có GET; UI sửa/xoá chưa có | P2 |
| F-CAM-01 | Camera | Camera | Xem lưới camera trực tiếp | M | Workflow | Video + khung YOLO qua Socket.IO, lọc "chỉ vi phạm" | v0.6 |
| F-CAM-02 | Camera | Camera | Thêm camera thật | S | Basic | Nguồn `webcam:N` / `rtsp://` | v0.6 |
| F-CAM-03 | Camera | Camera | Sửa nguồn / vị trí / trạng thái camera | S | Basic | Cài đặt → Giám sát | v0.6 |
| F-CAM-04 | Camera | Camera | Xoá camera | S | Basic | Kéo theo vi phạm của camera | v0.6 |
| F-CAM-05 | Camera | Camera | Gán video mẫu cho camera | S | Other | Nguồn `video:<tên>`; tải video ≤ 200MB, chặn `../` | v0.6 |
| F-CAM-06 | Camera | Camera | Thăm dò camera theo yêu cầu | S | Workflow | Sửa camera → agent tạo `health.probe` | v0.6 |
| F-AI-01 | Violation | AI Engine | Nhận diện PPE theo thời gian thực | L | Advanced | YOLOv8 11 lớp + model găng / giày + pose; BoT-SORT | v0.6 |
| F-AI-02 | Violation | AI Engine | Chốt vi phạm theo thời gian | M | Workflow | conf ≥ 0.6, thiếu liên tục ≥ 3s, 1 vi phạm / người theo món nặng nhất | v0.6 |
| F-AI-03 | Violation | AI Engine | Chụp ảnh bằng chứng | S | Workflow | Khung tại đầu / cổ tay / cổ chân từ keypoint | v0.6 |
| F-AI-04 | Violation | AI Engine | Báo lại vi phạm kéo dài | S | Workflow | Mỗi 60s / người, tăng `occurrenceCount` | v0.6 |
| F-AI-05 | Zone | AI Engine | Lọc theo vùng nhận diện | M | Advanced | Vùng `MONITORING` (3–20 điểm, tỉ lệ 0–1); người có điểm chân ngoài mọi vùng bị bỏ trước khi xét PPE; engine đọc lại DB mỗi 60s | v0.9 |
| F-AI-06 | — | AI Engine | Nghiệm thu model | M | Other | `eval_ppe_decision.py` (báo oan / bỏ sót), `sweep_threshold.py` | v0.6 |
| F-VIO-01 | Violation | Vi phạm | Xem danh sách vi phạm | S | Basic | Lọc theo loại, mức, trạng thái, camera | v0.6 |
| F-VIO-02 | Violation | Vi phạm | Xem chi tiết vi phạm | S | Basic | Ảnh bằng chứng, bbox, tab Agent | v0.6 |
| F-VIO-03 | Violation | Vi phạm | Cập nhật trạng thái vi phạm | S | Workflow | open → under_review → resolved / false_positive | v0.6 |
| F-VIO-04 | Violation | Vi phạm | Xoá vi phạm | S | Basic | Có xác nhận, không hoàn tác | v0.6 |
| F-VIO-05 | Violation | Vi phạm | Tiếp nhận vi phạm từ AI | S | Workflow | `POST /api/violations`, header `X-AI-Engine-Secret` | v0.6 |
| F-ALR-01 | Alert | Thông báo | Xem danh sách cảnh báo | S | Basic | Sinh từ vi phạm thật | v0.6 |
| F-ALR-02 | Alert | Thông báo | Xác nhận cảnh báo | S | Workflow | new → acknowledged | v0.6 |
| F-ALR-03 | Alert | Thông báo | Đánh dấu đã đọc tất cả | S | Other | Chưa có | P2 |
| F-RULE-01 | AlertRule | Cảnh báo | Tạo / sửa / xoá quy tắc cảnh báo | M | Basic | Theo công trường; Telegram cần ≥ 1 chat_id | v0.6 |
| F-RULE-02 | AlertRule | Cảnh báo | Bật / tắt quy tắc | S | Basic | `isActive` | v0.6 |
| F-TG-01 | TelegramSettings | Cảnh báo | Cấu hình bot Telegram | S | Basic | Token mã hoá AES-256-GCM | v0.6 |
| F-TG-02 | TelegramSettings | Cảnh báo | Kiểm tra kết nối bot | S | Other | Gọi `getMe` | v0.6 |
| F-TG-03 | Alert | Cảnh báo | Gửi cảnh báo Telegram theo quy tắc | M | Workflow | Ngưỡng, cooldown; nhắc nhở lần 1, leo thang từ lần 2 | v0.6 |
| F-TG-04 | Alert | Cảnh báo | Gửi cảnh báo Zalo OA và Webhook ký HMAC | M | Workflow | Zalo OA `message/cs`; webhook POST JSON kèm `X-SafeSight-Signature` | v0.9 |
| F-TG-05 | ZaloSettings | Cảnh báo | Cấu hình + kiểm tra kết nối Zalo OA | S | Basic | Access token mã hoá AES-256-GCM, kiểm bằng `getoa` | v0.9 |
| F-TG-06 | Alert | Cảnh báo | Gửi cảnh báo SMS / Email | M | Other | Enum có, chưa nối | P3 |
| F-VOICE-01 | Camera | Cảnh báo giọng nói | Ghi âm và phát tới loa công trường | M | Workflow | Mic trên camera đang vi phạm và trong modal vi phạm | v0.6 |
| F-VOICE-02 | Camera | Cảnh báo giọng nói | Nhận và phát audio tại loa | S | Workflow | Trang `/site-speaker` theo camera | v0.6 |
| F-AN-01 | Violation | Phân tích | Xem xu hướng tuân thủ | M | Advanced | Recharts | v0.6 |
| F-AN-02 | Violation | Phân tích | Xem phân bố vi phạm theo loại | S | Advanced | Donut | v0.6 |
| F-RPT-01 | Violation | Báo cáo | Xuất báo cáo CSV / PDF | M | Other | Trang `/reports` chưa có | P2 |
| F-AGENT-01 | AgentTask | Agent | Quét sức khoẻ hệ thống định kỳ | M | Advanced | 60s; 6 loại phát hiện; tự khắc phục trong giới hạn | v0.6 |
| F-AGENT-02 | Violation | Agent | Review vi phạm bằng bằng chứng | L | Advanced | Claude Tool Runner; band VERIFIED / PROBABLE / POSSIBLE | v0.6 |
| F-AGENT-03 | Alert | Agent | Leo thang Telegram khi VERIFIED thật | S | Workflow | Tôn trọng cooldown | v0.6 |
| F-AGENT-04 | AgentEvent | Agent | Tổng hợp theo camera / báo cáo ca | M | Other | `camera.digest`, `shift.report` theo giờ cấu hình | v0.6 |
| F-AGENT-05 | AgentEvent | Agent | Hỏi đáp về hệ thống / vi phạm / camera / công trường | M | Advanced | Trang `/agent` và tab Agent trong modal | v0.6 |
| F-AGENT-06 | AgentSettings | Agent | Bật / tắt agent, chọn model, trần token | S | Basic | Kill switch; tắt thì chỉ ghi nhận | v0.6 |
| F-AGENT-07 | AgentEvent | Agent | Xem dòng thời gian và hàng đợi | S | Basic | Audit mọi tool call, verdict, action | v0.6 |
| F-AGENT-08 | CameraAgent | Agent | Bật / tắt subagent camera, đặt nhịp tổng hợp và trần token riêng | M | Basic | Thẻ camera trên `/agent`; nhịp 5–1440 phút; trần camera kiểm sau kill switch và trần toàn cục | v0.8 |
| F-AGENT-09 | CameraAgent | Agent | Trí nhớ theo camera | M | Advanced | Tool `remember_camera` ghi tối đa 20 ghi chú × 300 ký tự; hiện trên thẻ và panel camera; xoá có xác nhận | v0.8 |
| F-AGENT-10 | AgentTask | Agent | Tổng hợp ngay theo camera | S | Workflow | Xếp `camera.digest` (gộp với lượt đang chờ) + poke; trả `taskId` | v0.8 |
| F-RF-01 | — | Kiểm thử Roboflow | Đối chiếu model cloud trên ảnh tĩnh | S | Other | Kéo thả ảnh, 2 workflow, mỗi lần 1 credit | v0.6 |
| F-USER-01 | User | Người dùng | Xem danh sách người dùng | S | Basic | | v0.6 |
| F-USER-02 | User | Người dùng | Sửa vai trò và công trường được gán | S | Basic | `role`, `assignedSites` | v0.6 |
| F-USER-03 | User | Người dùng | Xoá người dùng | S | Basic | | v0.6 |
| F-USER-04 | User | Người dùng | Tạo người dùng | S | Basic | Dialog "Thêm người dùng" trên `/users`; `POST /api/users` (mật khẩu bcrypt, 409 khi email trùng) | v0.9 |
| F-SET-01 | Organization | Thiết lập | Xem tài khoản và tổ chức | S | Basic | Tab hiển thị, chưa lưu | P2 |
| F-SET-02 | — | Thiết lập | Bật / tắt loại phát hiện AI | S | Basic | Tab Giám sát AI hiện là mẫu tĩnh | P3 |
| F-PROF-01 | User | Hồ sơ cá nhân | Xem / cập nhật hồ sơ | S | Basic | Trang `/profile`: tên/email/vai trò chỉ đọc + đổi mật khẩu; vào từ menu avatar Header | v0.9 |
| F-AUD-01 | AuditLog | Quản trị | Xem nhật ký thao tác | S | Basic | Tab "Nhật ký" trong `/settings`; `logAudit()` ghi ở users/cameras/alert-rules/Telegram/agent settings | v0.9 |
