# Cảnh báo vi phạm mới chỉ gửi được qua Telegram

## Vấn đề

`AlertChannel` có sẵn `webhook` (và nay thêm `zalo`) nhưng `src/lib/alert-notifier.ts` chỉ lọc đúng kênh `telegram`: quy tắc bật kênh khác thì không gửi gì, cũng không ghi `Alert` để biết là đã bỏ qua. Công trường dùng Zalo nhiều hơn Telegram, còn bên tích hợp (ERP/HSE) cần nhận sự kiện vi phạm bằng webhook có chữ ký để tự xác thực. Toàn bộ logic gửi lại nằm chung một hàm với logic ngưỡng/cooldown nên thêm kênh mới là phải sửa vào giữa vòng lặp gửi.

## Đề xuất

- Model `ZaloSettings` (một dòng, `accessTokenEncrypted` AES-256-GCM như `TelegramSettings`, `isEnabled`) + `src/lib/zalo.ts` (`sendText`, `sendImage` qua `POST https://openapi.zalo.me/v3.0/oa/message/cs`, `getOa` cho nút kiểm tra kết nối).
- `src/lib/webhook.ts`: POST JSON kèm header `X-SafeSight-Signature: sha256=<HMAC-SHA256 của body bằng WEBHOOK_SECRET>`, timeout 5 giây.
- Tách `alert-notifier.ts` thành `src/lib/alert-channels/{index,telegram,zalo,webhook}.ts` theo `interface AlertSender { send(input): Promise<{ ok, error? }> }`, chọn sender bằng `senderFor(channel)`; giữ nguyên chữ ký và hành vi Telegram của `notifyViolation()`.
- UI: thẻ "Zalo OA" trong `/settings` (cạnh thẻ Telegram), dialog quy tắc cảnh báo hiện ô người nhận riêng cho từng kênh đang bật kèm gợi ý định dạng.
- `AlertRule.recipients` vẫn là một mảng JSON: mục của kênh mới mang tiền tố (`zalo:123`, `webhook:https://…`), mục không tiền tố tiếp tục là chat_id Telegram.

## Tiêu chí nghiệm thu

- [ ] Quy tắc Telegram đã tạo trước đây chạy y như cũ: cùng caption, mỗi chat_id một dòng `Alert` (`channel = 'telegram'`), ngưỡng/cooldown không đổi.
- [ ] Bật kênh Zalo với access token hợp lệ → tin nhắn tới đúng Zalo user id, `Alert.channel = 'zalo'`; token sai → `Alert.errorMessage` ghi lỗi Zalo trả về.
- [ ] Kênh webhook gửi đúng body `{ event, violation, camera, site, snapshotUrl }`, chữ ký khớp HMAC-SHA256 bên nhận tự tính; **không** gửi `camera.rtspUrl`.
- [ ] Thiếu `WEBHOOK_SECRET` hoặc kênh đang tắt → bỏ qua im lặng, không ghi `Alert` (cooldown không bị khoá bởi lần gửi chưa từng xảy ra).
- [ ] Dialog quy tắc chặn lưu khi bật một kênh mà chưa có người nhận của kênh đó; Zalo chỉ nhận chữ số, webhook chỉ nhận URL https.
- [ ] `npm run test:agent`, `npx tsc --noEmit`, `npx eslint .` xanh; tài liệu (`wiki/02`, `wiki/03`, `wiki/04`, `wiki/05`, README, `.env.docker.example`, `docs/ba/04`, `docs/ba/07`, `CHANGELOG.md`) cập nhật cùng commit.
