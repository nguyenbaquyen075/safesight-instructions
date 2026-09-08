# Trang Báo cáo và báo cáo tuần của agent

## Vấn đề
Quản lý công trường phải gửi báo cáo vi phạm định kỳ cho chủ đầu tư nhưng dashboard
chưa có chỗ nào xuất được: `/violations` là danh sách thao tác hằng ngày (không lọc
theo khoảng ngày, không tổng hợp theo camera), `/analytics` chỉ có biểu đồ. Sidebar
cũng chưa có mục Báo cáo — trong sitemap `/reports` vẫn là "trang chưa có" (F-RPT-01,
US-17, P2). Agent đã biết viết báo cáo ca hằng ngày (`shift.report`) nhưng không có
bản tổng kết tuần, và mọi bản báo cáo agent viết chỉ nằm lẫn trong dòng thời gian
`AgentEvent` chứ không xem lại được ở một chỗ.

## Đề xuất
- Trang `/reports` (SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER): lọc công trường / camera /
  khoảng ngày (mặc định 7 ngày), bảng tổng hợp theo camera (tổng · vi phạm thật ·
  báo oan · còn mở) và bảng chi tiết; nút "Xuất CSV" (tạo file phía trình duyệt từ dữ
  liệu API) và "In / PDF" (`window.print()` + CSS `@media print`).
- API `GET /api/reports/violations?siteId&cameraId&from&to` lọc theo phạm vi site của
  người dùng, phần gộp số liệu là hàm thuần để test được.
- Agent có kind mới `weekly.report` (lane nghiên cứu) chạy theo
  `AgentSettings.weeklyReportAt` (`"MON 08:00"`, đặt trên `/agent`), gửi Telegram bằng
  `escalate` và ghi `AgentEvent report` để `/reports` hiện bản mới nhất.

## Tiêu chí nghiệm thu
- [ ] `buildReportSummary` là hàm thuần, có test: gộp đúng theo camera, giữ bất biến
      `tổng = thật + báo oan + còn mở`, sắp xếp ổn định.
- [ ] `nextWeekly("MON 08:00", now)` trả đúng mốc kế tiếp (đủ các trường hợp: hôm nay
      đã qua giờ, hôm nay chưa tới giờ, chuỗi hỏng → mặc định), có test.
- [ ] `ensureRecurring()` tạo đúng một `weekly.report` đang chờ với `dueAt` theo cài đặt
      và không nhân bản ở vòng sau.
- [ ] `GET /api/reports/violations` trả 403 khi `siteId` ngoài phạm vi người dùng, mặc
      định 7 ngày, giới hạn 2.000 dòng.
- [ ] "Xuất CSV" ra file UTF-8 có BOM (Excel tiếng Việt đọc đúng dấu), đủ số dòng API
      trả về; "In / PDF" cho bản in nền sáng, không có sidebar/header/bộ lọc.
- [ ] `/reports` có trong `PAGE_ROLES`, Sidebar và tiêu đề Header; vai trò không có
      quyền bị `DashboardLayout` chặn khi vào thẳng URL.
- [ ] Tài liệu cùng commit: wiki/04, wiki/05, wiki/09, `docs/ba` (F-RPT-01 → v0.9,
      US-17 ✅, SCR-20, sitemap, ma trận phân quyền), CHANGELOG.
