# Bản đồ nhiệt vi phạm (F7)

## Vấn đề

`/analytics` hiện chỉ có xu hướng tuân thủ theo ngày và donut theo loại vi phạm — không thấy được vi phạm tập trung vào khung giờ/thứ nào trong tuần, hay tập trung ở đâu trên khung hình camera. Hai câu hỏi đó cần quét thủ công cả bảng `/violations`, không có cái nhìn tổng hợp.

## Đề xuất

- Hai khối mới dưới các biểu đồ hiện có trên `/analytics`, dùng dữ liệu `useViolations()` đã tải sẵn (không thêm API):
  - **Theo giờ và thứ trong tuần**: lưới 7×24 (thứ × giờ), tô đậm theo `--danger` tỉ lệ với số vi phạm rơi vào ô đó; tooltip xem số liệu chính xác.
  - **Theo vị trí trên camera**: dropdown chọn camera, vẽ chấm mờ tại tâm bbox (`bboxData`, tỉ lệ 0–1) từng vi phạm chồng lên ảnh xem trước `preview_<cameraId>.jpg` (từ T1); ảnh lỗi/chưa có thì hiện nền xám thay vì vỡ layout, chấm vẫn vẽ.
- Bộ lọc thời gian 7/30/90 ngày (mặc định 30) riêng cho hai khối này, không đổi hành vi các khối phía trên.
- Phần gộp dữ liệu (giờ×thứ, tâm bbox) tách thành hàm thuần trong `src/lib/heatmap-shape.ts` để test được không cần render React.

## Tiêu chí nghiệm thu

- [ ] Lưới giờ×thứ hiển thị đúng số vi phạm mỗi ô, ô đậm nhất là ô nhiều vi phạm nhất trong khoảng lọc; tooltip đúng "Thứ, giờ — n vi phạm".
- [ ] Đổi camera ở bản đồ vị trí ra đúng ảnh xem trước + đúng chấm của camera đó; camera chưa có ảnh xem trước vẫn hiện chấm trên nền xám, không vỡ layout.
- [ ] Đổi 7/30/90 ngày lọc đúng lại cả hai khối, không ảnh hưởng KPI/biểu đồ tuân thủ/donut phía trên.
- [ ] `src/lib/heatmap-shape.ts` có test cho: gộp đúng theo giờ/thứ, tính đúng tâm bbox, bỏ qua bbox hỏng/thiếu trường mà không ném lỗi.
- [ ] `npm run test:agent`, `npx tsc --noEmit`, `npx eslint .` đều xanh.
- [ ] Tài liệu (`wiki/05`, `docs/ba/04` F-AN-03, `docs/ba/07` SCR-09, `CHANGELOG.md`) cập nhật cùng commit.
- [ ] Kiểm tra hình ảnh thật trên trình duyệt (desktop/mobile) hoãn lại — môi trường worktree không chạy server/Chrome; ghi rõ trong PR để reviewer bấm thử.
