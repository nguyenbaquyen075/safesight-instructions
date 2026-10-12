## Tóm tắt
- Video demo cam-007 cắt còn **31,4 giây** (trước 38,4): bỏ đoạn công nhân thứ hai đi vào ở cuối, đoạn làm model găng nhầm cổ tay áo rằn ri thành găng.
- Chỉ gỡ cảnh gây lỗi khỏi bản demo; **model găng chưa được sửa**.

## Issue
Closes #<n>

## Thay đổi chính
- `public/videos/IMG_2744 2.MOV`: cắt bằng `avconvert --preset PresetPassthrough --duration 31.4` (không chuyển mã). H.264 720×1280, 30 fps. So tuần tự từng khung với bản cũ: 942/942 khung giống hệt (chênh lớn nhất 0.0). Người mới bắt đầu vào khung ở ~31,7s; 31,4s còn sạch.
- `CHANGELOG.md` (Unreleased → Thay đổi).

## Kiểm thử
- [x] Codec/kích thước/fps giữ nguyên (h264, 720×1280); đọc tuần tự được toàn bộ 942 khung; các khung cuối chỉ còn 1 người (pose model).
- [ ] Chưa chạy engine với file mới trên nền `main` — hoãn (đã chạy với bản HEVC gốc cùng điểm cắt trong thư mục làm việc của anh).
- [ ] Không có test tự động liên quan.

## Tài liệu
CHANGELOG.

## Rủi ro và việc còn lại
- File binary mới (~9 MB) vào lịch sử git; bản 11,7 MB cũ vẫn ở lịch sử.
- Lỗi gốc là model: người khác mặc áo hoa văn tương tự ngoài thực tế vẫn có thể bị nhầm thành có găng. Cần quyết định hướng sửa (ngưỡng / logic theo thời gian / train lại có ví dụ âm).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
