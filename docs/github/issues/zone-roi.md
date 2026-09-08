# Vùng nhận diện (Zone/ROI) theo camera

## Vấn đề
Camera hiện xét PPE cho MỌI người trong khung hình. Ở công trường thật, khung camera
luôn dính vỉa hè, đường đi, nhà dân bên cạnh — khách qua đường không đội mũ bảo hộ
cũng bị ghi vi phạm. Vi phạm oan làm loãng danh sách và bào mòn niềm tin của cán bộ
an toàn vào hệ thống. Model `Zone` đã có sẵn trong schema nhưng chưa nối vào tracker
(F-AI-05, P1).

## Đề xuất
- Mỗi camera khai được các vùng làm việc dạng đa giác (`Zone.type = MONITORING`,
  `polygonData` = `[{x,y}]` toạ độ tỉ lệ 0–1 theo khung hình).
- AI engine đọc vùng từ DB (kết nối SQLite chỉ-đọc đang dùng) lúc khởi động và mỗi 60s;
  người có **điểm chân** (giữa cạnh dưới khung người) nằm ngoài **mọi** vùng bị loại
  TRƯỚC khi xét PPE — không sinh vi phạm, không tính là người quan sát. Camera chưa khai
  vùng nào thì xét cả khung như hiện tại.
- Engine ghi ảnh xem trước `public/snapshots/preview_<cameraId>.jpg` (JPEG rộng 640px)
  mỗi 30 giây để trình vẽ vùng có nền thật của camera.
- API `GET/PUT /api/cameras/[id]/zones` (quyền theo site), giao diện vẽ vùng nằm trong
  dialog sửa camera ở Cài đặt > Giám sát.

## Tiêu chí nghiệm thu
- [ ] Point-in-polygon và bộ lọc người là hàm thuần, có test chạy không cần torch/cv2
      (`python3 -m unittest ai-engine/test_zones.py`), phủ cả đa giác lõm và nhiều vùng.
- [ ] `process_frame(frame, zones=...)` bỏ người ngoài vùng trước khi xét PPE; gọi không
      truyền `zones` giữ nguyên hành vi cũ (không đổi logic nhận diện).
- [ ] Vùng sửa trên web có hiệu lực trong vòng 60 giây, không cần khởi động lại engine.
- [ ] Ảnh xem trước xuất hiện tối đa 30 giây sau khi engine chạy, không làm chậm vòng lặp
      nhận diện và không bao giờ bị đọc lúc đang viết dở.
- [ ] `PUT` xác thực bằng zod (tối đa 10 vùng, mỗi vùng 3–20 điểm, toạ độ 0–1), kiểm quyền
      `assertSiteAccess`, gửi danh sách rỗng thì xoá hết vùng của camera.
- [ ] Trình vẽ: bấm thêm điểm, kéo di chuyển, chuột phải xoá điểm, nhiều vùng, nút Lưu;
      có trạng thái đang tải và trạng thái chưa có ảnh xem trước ("chạy AI engine trước").
- [ ] Tài liệu cùng commit: wiki/06, wiki/05, `docs/ba` (F-AI-05 → v0.9, SCR-13), CHANGELOG.
