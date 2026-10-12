## Tóm tắt
- Chỉ còn **2 video demo** (`IMG_2744 2.MOV` cho cam-007, `IMG_2745 2.MOV` cho cam-008): xoá `210321.mp4` và `test1.mp4`, `camera-videos.json` chỉ còn hai camera đó.
- Sửa gốc để việc này không làm engine treo: "camera demo" không còn đồng nghĩa với "khoá của `camera-videos.json`".
- `/cameras`: không còn video mặc định `210321.mp4`; số "Luồng hoạt động" lấy theo số luồng thật thay cho số 16 viết cứng.

## Issue
Closes #<n>

## Thay đổi chính
- `public/videos/210321.mp4`, `test1.mp4`: xoá. `src/data/camera-videos.json`: chỉ cam-007/008.
- `src/lib/camera-shape.ts`: `DEMO_CAMERA_IDS` = khoá json ∪ id của `mockCameras`.
- `ai-engine/yolo_inference.py` (`load_real_camera_overrides`): thêm id khớp `cam-\d{3}` vào tập camera demo. Không có thay đổi này, các camera mẫu (RTSP giả) bị coi là camera thật và engine treo ~30s mỗi camera — đã gặp khi chạy thử.
- `src/app/(dashboard)/cameras/page.tsx`: `videoForCamera()` trả `null` khi không có video → không dựng ô; "Luồng hoạt động" và câu mô tả dùng `onlineCameraTiles.length`.
- `mock-cameras.ts` (bỏ `videoUrl` chết), `AlertTimeline.tsx` (thumbnail), `mock-violations.ts`, `ai-engine/test_video_source.py`, `prisma/seed.mjs` (chú thích): trỏ sang video còn lại.

## Kiểm thử
- [x] `npm run test:agent` (227/227, DB tạm) · `npx tsc --noEmit` · `npx eslint .`
- [x] Python: `ai-engine/test_video_source.py` đạt.
- [x] Chạy thật trên DB mẫu 6 camera: engine chỉ mở cam-007/008, bridge có detection của đúng hai camera đó, `/cameras` có đúng 2 ô video và "Luồng hoạt động = 2".
- [ ] Kiểm tra hình ảnh mobile / chế độ sáng — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Thay đổi).

## Rủi ro và việc còn lại
- `training/generate_dataset.py` vẫn đọc `test1.mp4` để tạo dữ liệu huấn luyện; muốn chạy lại phải khôi phục file từ lịch sử git.
- Các số "Bộ xử lý AI 4/4", "Độ trễ 8ms", "Tiêu chuẩn Mũ" và "Camera trực tuyến 9/12" ở bảng điều khiển vẫn là số viết cứng/lấy từ roster mẫu — chưa đổi.
- Các video không còn dùng khác (`samples1.mp4`, `91769…`, `safety-*.mp4`) giữ nguyên.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
