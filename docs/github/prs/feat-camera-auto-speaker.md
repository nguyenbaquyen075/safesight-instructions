## Tóm tắt
- Nút **"Loa tự động"** trên `/cameras`: đọc to lỗi PPE đang bắt được bằng giọng `vi-VN` của trình duyệt, theo vòng — mỗi camera lỗi một lần cách nhau 2 giây, nghỉ 10 giây giữa hai vòng.
- Chạy hoàn toàn ở trình duyệt từ detection đang hiện trên lưới, không cần bridge event hay API mới.

## Issue
Closes #<n>

## Thay đổi chính
- `src/hooks/useAutoSpeaker.ts` (mới): vòng đọc (`INTERVAL_MS` 2s, `ROUND_GAP_MS` 10s), bỏ qua khi `speechSynthesis.speaking`, chỉ giữ camera còn lỗi. `speak()` dùng ngay trong thao tác bấm nút để vừa mở quyền phát âm vừa đọc câu xác nhận.
- `src/lib/speak.ts` (mới): `speakVietnamese()` chọn giọng `vi-VN`, trả thông báo lỗi tiếng Việt nếu trình duyệt/máy thiếu giọng; xếp hàng nối đuôi, không `cancel`.
- `src/app/(dashboard)/cameras/page.tsx`: nút bật/tắt cạnh bộ lọc; câu dựng từ `isViolation` + `missingPpe` của người trong detection.
- Không đụng `/site-speaker`, bridge, `POST /api/violations` hay agent — `main` đã có `/announce` + `voice-announce` riêng.

## Kiểm thử
- [x] `npm run test:agent` (227/227, trên DB tạm vì Prisma chặn `--accept-data-loss`) · `npx tsc --noEmit` · `npx eslint .`
- [x] Chrome headless với `speechSynthesis` giả lập: bật nói xác nhận; vòng đọc đúng 2s trong vòng / nghỉ 10–12s giữa vòng; mỗi vòng mỗi camera một lần; tắt thì im; thiếu giọng vi-VN thì không đọc và hiện chữ đỏ.
- [ ] Giọng đọc thật phát ra loa (Chrome headless không có giọng tiếng Việt) — cần nghe thử trên máy có giọng "Linh".
- [ ] Kiểm tra hình ảnh mobile / chế độ sáng cho nút mới — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Thêm), wiki/05 (dòng `/cameras`).

## Rủi ro và việc còn lại
- Báo theo từng khung hình chưa qua bộ lọc 3 giây của engine, nên người đi ngang bị che thoáng qua có thể bị báo thoáng qua.
- Câu dài (thiếu cả 4 món) có thể đọc lâu hơn 2 giây nên nhịp thực tế chậm hơn một chút.
- Giọng là giọng máy chuẩn của thiết bị; dịch vụ giọng đám mây là việc riêng.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
