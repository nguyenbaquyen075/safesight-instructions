# Clip bằng chứng ngắn cho mỗi vi phạm

## Vấn đề
Mỗi vi phạm hiện chỉ có MỘT tấm ảnh tĩnh. Người duyệt không phân biệt được người đó
vừa tháo mũ ra, đang đội vào, hay đúng là làm việc không mũ suốt — nên rất hay phải
tranh cãi "ảnh chụp đúng lúc bất lợi". Cột `Violation.clipUrl` đã có sẵn trong schema
và giao diện đã dựng chỗ phát video từ bản mock, nhưng KHÔNG có gì sinh ra clip thật
(F-AI-03 mới dừng ở ảnh).

## Đề xuất
- Engine giữ vòng đệm 20 khung gần nhất cho mỗi luồng (≈5s ở 4 fps).
- Khi chốt vi phạm: ghi `public/snapshots/clip_<cameraId>_<timestamp>.mp4` (mp4v, 4 fps)
  gồm 20 khung TRƯỚC, rồi ghi thêm 12 khung SAU trong các vòng lặp kế tiếp và tự đóng —
  tổng ≈ 8 giây, KHÔNG chặn vòng lặp nhận diện và không đổi logic nhận diện.
- `POST /api/violations` nhận `clipUrl` tuỳ chọn, lưu vào `Violation.clipUrl`; DTO trả về.
- Modal chi tiết vi phạm phát clip (ảnh snapshot làm poster), không có clip thì hiện ảnh.
- `snapshot.cleanup` của agent và `clear_snapshots()` xử lý `clip_*.mp4` cùng luật với ảnh.
- `read_violation` trả `clipUrl` và nhắc agent rằng có clip cho NGƯỜI xem (agent chưa
  đọc được video, chưa có ffmpeg).

## Tiêu chí nghiệm thu
- [ ] Vòng đệm khung và bộ đếm khung-sau là mã thuần, test chạy không cần cv2/torch
      (`python3 -m unittest ai-engine/test_clips.py`).
- [ ] Vòng lặp nhận diện chỉ thêm: đẩy khung vào đệm + ghi một khung cho mỗi clip đang mở;
      không đổi tracker, không đổi ngưỡng, không đổi luật chốt vi phạm.
- [ ] Vi phạm không ghi được clip vẫn hợp lệ (API không nhận `null`, DTO trả `undefined`).
- [ ] Clip của vi phạm còn OPEN/UNDER_REVIEW không bị cleanup xoá dù quá 24h; clip của vi
      phạm đã đóng thì xoá cùng ảnh. `preview_*.jpg` không bao giờ bị coi là bằng chứng.
- [ ] `clear_snapshots()` dọn cả `clip_*.mp4` khi engine khởi động/tắt.
- [ ] Tài liệu cùng commit: wiki/04, wiki/05, wiki/06, `docs/ba` (F-AI-03, SCR-06), CHANGELOG.
