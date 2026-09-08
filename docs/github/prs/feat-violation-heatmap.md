## Tóm tắt
- Hai khối mới dưới các biểu đồ hiện có trên `/analytics`: bản đồ nhiệt **giờ×thứ** (lưới 7×24 tô theo `--danger`) và bản đồ nhiệt **vị trí** (chọn camera, chấm mờ tại tâm bbox chồng lên ảnh xem trước `preview_<cameraId>.jpg`).
- Bộ lọc 7/30/90 ngày (mặc định 30) riêng cho hai khối này, dùng dữ liệu `useViolations()`/`useCameras()` đã tải sẵn của trang — không thêm API, không đổi các khối phía trên.
- Phần gộp dữ liệu thuần (`hourWeekdayGrid`, `bboxCenters`, `maxCell`) tách trong `src/lib/heatmap-shape.ts`, có test.

## Issue
Closes #<n>

## Thay đổi chính
- `src/lib/heatmap-shape.ts` (mới): `hourWeekdayGrid(rows)` đếm vi phạm theo (thứ, giờ) từ `detectedAt` (giờ địa phương trình duyệt, hàng 0 = Chủ nhật khớp `Date.getDay()`, bỏ qua ngày không parse được); `bboxCenters(rows)` quy đổi từng `bboxData[i]` (tỉ lệ 0–1, đúng cách `yolo_inference.py` ghi) thành tâm `{x, y, type}`, bỏ qua box thiếu/hỏng trường thay vì ném lỗi; `maxCell(grid)` tìm ô lớn nhất để chuẩn hoá alpha.
- `src/components/analytics/TimeHeatmap.tsx` (mới): lưới 7×24 `div`, nền `rgba(220,38,38,alpha)` (alpha chuẩn hoá theo `maxCell`), nhãn giờ mỗi 3 giờ + nhãn thứ viết tắt, tooltip `title` đầy đủ; cuộn ngang trong `overflow-x-auto` (không tràn trang) trên mobile.
- `src/components/analytics/PositionHeatmap.tsx` (mới): dropdown chọn camera (dùng lại `InputGroup` từ `components/settings/ui.tsx`); `<img>` nền + `<canvas>` chấm mờ chồng lên trên — cùng cấu trúc lớp nền/lớp vẽ với `ZoneEditor.tsx` (ảnh tự bắn `onLoad`/`onError`, không cần effect tải ảnh) nên tránh được lỗi lint `react-hooks/set-state-in-effect`; ảnh lỗi thì nền `--surface` của container lộ ra, chấm vẫn vẽ bình thường qua `radialGradient` alpha 0.25, bán kính 18 (đơn vị canvas 800×450).
- `src/app/(dashboard)/analytics/page.tsx`: thêm `useCameras()`, state `heatmapRangeDays` (7/30/90, mặc định 30) và nút chọn khoảng riêng cho hai khối mới; lọc `violations` theo `detectedAt` trong khoảng đó rồi truyền cho hai component trên — chỉ thêm, không sửa KPI/`ComplianceChart`/`ViolationDonut` hiện có.

## Kiểm thử
- [x] `npm run test:agent` (155/155 pass — 147 baseline + 8 test mới trong `agent/test/heatmap-shape.test.ts`)
- [x] `npx tsc --noEmit` · `npx eslint .` (sạch — sửa 2 lỗi lint trong lúc làm: `Date.now()` gọi trong render → `new Date().getTime()`; `setState` đồng bộ trong effect của `PositionHeatmap` → chuyển ảnh nền sang `<img onLoad/onError>` như `ZoneEditor`, effect chỉ còn vẽ canvas)
- [ ] Python: không đụng `ai-engine`
- [ ] Kiểm tra hình ảnh desktop/mobile — hoãn: môi trường worktree không chạy server/Chrome theo ràng buộc; đề nghị reviewer bấm thử `/analytics` ở cả hai bề rộng, đổi camera/khoảng ngày, và một camera chưa có `preview_<id>.jpg` để xem nhánh lỗi ảnh.

## Tài liệu
`wiki/05-giao-dien-va-api.md` (route `/analytics`, mục Component chính), `docs/ba/04-function-list.md` (F-AN-03), `docs/ba/07-screen-specs.md` (SCR-09), `CHANGELOG.md`.

## Rủi ro và việc còn lại
- Kiểm tra hình ảnh thật (desktop/mobile) chưa chạy — cần trình duyệt/server, hoãn theo ràng buộc môi trường của worktree; reviewer nên xác nhận trước khi merge, đặc biệt cuộn ngang của lưới giờ×thứ trên màn hẹp và vùng chấm trên canvas vị trí.
- `PositionHeatmap` vẽ canvas ở độ phân giải cố định 800×450 rồi co giãn bằng CSS; bán kính chấm 18 là đơn vị canvas nên kích thước hiển thị thực tế phụ thuộc bề rộng khung — chấp nhận được cho mục đích minh hoạ mật độ, không cần chính xác tuyệt đối theo px màn hình.
- Bộ lọc 7/30/90 ngày chỉ áp cho hai khối bản đồ nhiệt mới, không áp cho KPI/biểu đồ tuân thủ/donut phía trên (các khối đó dùng hook riêng `useDashboardKPIs`/`useComplianceTrend`/`useViolationBreakdown`, ngoài phạm vi F7).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
