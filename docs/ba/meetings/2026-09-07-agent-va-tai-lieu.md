# Nhật ký quyết định — Agent giám sát tự động và chuẩn hoá tài liệu

| | |
|---|---|
| Ngày | 2026-09-07 |
| Hình thức | Trao đổi qua phiên làm việc với trợ lý phát triển (không phải cuộc họp chính thức) |
| Tham dự | Chủ dự án (operator), trợ lý phát triển |
| Nguồn | `docs/superpowers/specs/2026-09-07-safesight-agent-design.md`, lịch sử commit |

## 1. Nội dung trao đổi
- Chuẩn hoá tài liệu, cấu hình, lint toàn dự án; thống nhất npm.
- Thiết kế agent giám sát tự động cho SafeSight, tham khảo kiến trúc agent hai lane của dự án CRM nội bộ.
- Quy ước commit, định danh code, tài liệu đi cùng commit.
- Trình bày repo chuyên nghiệp: README, Docker, CI, Release, GitHub Pages.
- Thay `SPEC.md` bằng bộ tài liệu BA chuẩn của team.

## 2. Quyết định
| # | Quyết định | Lý do | Ảnh hưởng |
|---|---|---|---|
| 1 | Agent đảm nhận cả ba vai trò: trực vận hành, cán bộ an toàn, hỏi đáp; làm trong một đợt | Giá trị đầy đủ ngay từ đầu | `agent/`, `wiki/09-agent.md`, UC-07, UC-16..22 |
| 2 | Worker Node trong repo + Anthropic SDK Tool Runner, kiến trúc hai lane | Tận dụng stack sẵn có, lane trực tiếp không phụ thuộc API | Tiến trình thứ 4, port 4002 |
| 3 | Agent được toàn quyền hành động nhưng có kill switch, giới hạn tần suất, trần token, audit đầy đủ | Tự động hoá thật sự nhưng người giữ quyền dừng | NFR-07, ma trận phân quyền |
| 4 | Chỉ band VERIFIED mới được tự đổi trạng thái hoặc leo thang | Tránh agent phán sai gây hại | BR-07-2 |
| 5 | Commit message và định danh code tiếng Anh; UI, comment, tài liệu tiếng Việt; tài liệu cập nhật cùng commit | Quy ước repo (`AGENTS.md`) | Quy tắc triển khai 5 |
| 6 | Phát hành theo tag semver + CHANGELOG; Docker image trên GHCR; landing page trên GitHub Pages | Trình bày chuyên nghiệp, triển khai lặp lại được | Workflows, README |
| 7 | Bỏ `SPEC.md`, thay bằng `docs/ba/` gồm 15 sản phẩm BA + SRS / URD / BRD / HDSD / biên bản | Chuẩn tài liệu bắt buộc của team | Toàn bộ `docs/ba/` |

## 3. Việc cần làm
| # | Việc | Người phụ trách | Hạn | Trạng thái |
|---|---|---|---|---|
| 1 | Chạy nghiệm thu lane nghiên cứu với `ANTHROPIC_API_KEY` thật | Chủ dự án | Sprint sau | Mở |
| 2 | Giới hạn vai trò xoá vi phạm / cảnh báo | Đội phát triển | Sprint sau | Mở |
| 3 | Escape HTML caption Telegram mặc định; kiểm chủ phiên `events?sessionId` | Đội phát triển | Sprint sau | Mở |
| 4 | Responsive sidebar < 768px | Đội phát triển | P2 | Mở |

## 4. Vấn đề mở
- `DATABASE_URL` production và nơi đặt AI engine (máy GPU tại công trường hay VPS).
- Có đưa Roboflow vào luồng video (WebRTC) không, hay giữ model local hoàn toàn.
