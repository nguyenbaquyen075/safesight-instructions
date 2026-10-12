# Chỉ giữ 2 video demo và tách khái niệm "camera demo" khỏi camera-videos.json
branch: chore/demo-two-videos

## Vấn đề
Demo chỉ còn dùng 2 video (cam-007, cam-008) nhưng `public/videos/210321.mp4`, `test1.mp4` và các khoá cam-001/002/003/005 trong `src/data/camera-videos.json` vẫn còn; trang `/cameras` còn dùng `210321.mp4` làm video mặc định và đầu trang ghi cứng "16 luồng".
Cắt file json không đủ: AI engine và `DEMO_CAMERA_IDS` coi "camera demo" là *khoá của `camera-videos.json`*, nên các camera mẫu còn lại trong DB (địa chỉ RTSP giả) bị tính là camera thật và engine treo khi cố mở chúng.

## Đề xuất
- Xoá hai video không dùng; `camera-videos.json` chỉ còn cam-007/008.
- Camera demo = roster mẫu (`cam-NNN`, khớp `mock-cameras.ts`) ∪ camera có video; file json chỉ nói camera nào có video (cả ở web lẫn `yolo_inference.py`).
- `/cameras`: camera demo không có video thì không dựng ô; "Luồng hoạt động" lấy theo số luồng thật.

## Tiêu chí nghiệm thu
- [ ] Engine chỉ mở 2 luồng và không treo trên camera mẫu có RTSP giả.
- [ ] `/cameras` chỉ có 2 ô video; số luồng hiển thị đúng.
- [ ] Không còn tham chiếu tới `210321.mp4` / `test1.mp4` trong code web.
