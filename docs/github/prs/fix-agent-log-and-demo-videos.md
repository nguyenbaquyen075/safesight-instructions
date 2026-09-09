## Tóm tắt
- Modal camera/vi phạm/công trường, tab Agent: **ô chat lên trước**, nhật ký gập lại (20 sự kiện gần nhất, hộp cuộn riêng) — trước đây phải cuộn qua toàn bộ log mới hỏi được subagent.
- `/agent`: dòng thời gian **phân trang** 50 sự kiện với "Tải thêm" (trần 500) trong hộp cuộn 60vh thay vì tải cứng 150 dòng.
- Video demo của cam-001/005/007/008 đổi từ **HEVC/H.265** (Chrome/Linux không giải mã → ô đen dù engine vẫn bắt) sang **H.264 720p**, nhẹ hơn 3–13 lần.

## Issue
Báo trực tiếp từ vận hành (ảnh chụp màn hình), không có issue riêng.

## Thay đổi chính
- `src/components/agent/SubjectAgentPanel.tsx`: thứ tự ô chat → task chờ → `<details>` "Nhật ký agent" (`max-h-72 overflow-y-auto`) + liên kết sang `/agent`.
- `src/app/(dashboard)/agent/page.tsx`: `limit` state (PAGE 50, MAX 500), nút "Tải thêm", dòng "Đang hiện N sự kiện", hộp `max-h-[60vh]`.
- `src/app/(dashboard)/cameras/page.tsx`: `aria-label` cho nút mở chi tiết camera (icon không nhãn).
- `public/videos/210321.mp4`, `IMG_2744 2.MOV`, `IMG_2745 2.MOV`: chuyển mã `ffmpeg … -c:v libx264 -crf 24 -pix_fmt yuv420p`, cạnh dài 1280, bỏ audio; tên file giữ nguyên nên `camera-videos.json` và engine không đổi.

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint .`
- [x] Chrome headless trên dev server: `/agent` 50 → 100 sự kiện sau "Tải thêm", hộp cuộn; modal camera: ô chat hiện không cần cuộn, nhật ký gập/mở được; `<video>` cam-001 `videoWidth=1280` đang phát (trước đó đen).
- [ ] Engine đang chạy vẫn đọc inode file cũ cho tới khi khởi động lại (không ảnh hưởng nhận diện).

## Tài liệu
CHANGELOG (Unreleased → Sửa), wiki/03 (ghi chú codec video demo + lệnh ffmpeg).

## Rủi ro và việc còn lại
- Ba file video là binary trong git; lịch sử vẫn giữ bản HEVC cũ.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
