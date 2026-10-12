## Tóm tắt
- Khung nhận diện trên `/cameras` **khớp đúng hình video**: khối chứa video và lớp khung có đúng tỉ lệ video và phủ kín ô.
- Trước đây khung ở phần dưới hình (bàn chân) hiện cao hơn giày thật ~45px với video dọc 9:16 trong ô 357×456; video ngang không đổi.

## Issue
Closes #<n>

## Thay đổi chính
- `src/app/(dashboard)/cameras/page.tsx` (`DemoVideoWithBoxes`): thẻ cha `overflow-hidden` có `containerType: 'size'`; khối con rộng `max(100cqw, 100cqh * ratio)`, cao `max(100cqh, 100cqw / ratio)`, căn giữa, chứa cả `<video>` và lớp khung. `ratio` lấy từ `videoWidth/videoHeight` sau `loadedmetadata` (trước đó dùng `100%` như cũ).
- Không đổi dữ liệu detection, engine hay API.

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint .`
- [x] Chrome headless trên dev server nền `main` (video H.264 giải mã được): 6 video (4 ngang, 2 dọc 720×1280) đều có khối video đúng tỉ lệ, phủ kín ô; video dọc: khối 357×635 căn giữa; bàn chân (75% chiều cao video) dịch 342px → 387px; khung mũ/áo/găng/giày khớp công nhân trong ảnh chụp.
- [ ] `npm run test:agent` không chạy riêng cho nhánh này (không đụng agent).
- [ ] Kiểm tra hình ảnh mobile / chế độ sáng — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Sửa).

## Rủi ro và việc còn lại
- Dùng container query units (`cqw`/`cqh`): trình duyệt cũ không hỗ trợ sẽ rơi về khối bằng ô như trước.
- Độ trễ giữa khung và hình khi video chạy (đồng bộ `videoPos`) là vấn đề riêng, chưa đụng tới.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
