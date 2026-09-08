## Tóm tắt
- Nối thật hai kênh cảnh báo mới: **Zalo OA** và **Webhook có chữ ký HMAC**, bên cạnh Telegram đã có.
- Tách `alert-notifier.ts` thành các sender theo kênh (`src/lib/alert-channels/`), giữ nguyên chữ ký và hành vi của `notifyViolation()` cho Telegram.
- Cho cán bộ ATLĐ dùng Zalo thay vì Telegram, và cho hệ thống bên thứ ba (ERP/HSE) nhận sự kiện vi phạm tự xác thực được.

## Issue
Closes #<n>

## Thay đổi chính
- `prisma/schema.prisma`: thêm model `ZaloSettings` (`accessTokenEncrypted`, `isEnabled`) — soi gương `TelegramSettings`, dùng chung khoá `TELEGRAM_ENCRYPT_KEY`. `src/types/enums.ts`: thêm `AlertChannel.ZALO`.
- `src/lib/zalo.ts` (`ZaloClient.sendText/sendImage/getOa`), `src/lib/webhook.ts` (`signWebhookBody`, `postWebhook` — header `X-SafeSight-Signature`, `AbortSignal.timeout(5000)`, `fetchImpl` để test không đụng mạng).
- `src/lib/alert-channels/{index,telegram,zalo,webhook}.ts`: `interface AlertSender { send(input) }` + `senderFor(channel)`. `AlertSendResult` có thêm cờ `skipped` cho trường hợp kênh chưa cấu hình/đang tắt — bỏ qua im lặng, **không** ghi `Alert`, đúng như hành vi cũ khi tắt Telegram (nếu ghi `Alert` thành công thì cooldown sẽ bị khoá bởi một lần gửi chưa từng xảy ra).
- `src/lib/alert-notifier.ts`: giữ nguyên `notifyViolation(violation, camera, { caption? })` (agent `escalate` và `POST /api/violations` gọi vào đây), ngưỡng/cooldown/caption không đổi; phần gửi lặp theo kênh của quy tắc rồi tới người nhận của kênh đó, `Alert.channel` ghi đúng kênh.
- Người nhận: `AlertRule.recipients` vẫn là **một** mảng JSON, mục của kênh mới mang tiền tố (`zalo:123`, `webhook:https://…`), mục không tiền tố tiếp tục là chat_id Telegram → quy tắc cũ chạy nguyên trạng, không cần migration dữ liệu. Parser/validator per-channel nằm trong `src/lib/validation/alert-rule.ts` (module thuần, client component import được).
- UI: `ZaloOaCard.tsx` + `use-zalo-settings.ts` + `/api/settings/zalo`, `/api/settings/zalo/test` (soi gương Telegram, cùng ràng buộc `ORG_WIDE_ROLES`); `AlertRuleEditDialog.tsx` hiện một khối người nhận cho mỗi kênh đang bật kèm gợi ý định dạng.
- Bảo mật: body webhook **không** chứa `camera.rtspUrl` (chuỗi này có tài khoản/mật khẩu camera, bên nhận là hệ thống ngoài); thiếu `WEBHOOK_SECRET` thì không gửi bản chưa ký.

## Kiểm thử
- [x] `npm run test:agent` — 110/110 xanh (18 test mới trong `agent/test/alert-channels.test.ts`: chọn sender theo kênh, chữ ký HMAC đối chiếu `createHmac` độc lập, `postWebhook` với `fetch` giả, validator/định tuyến người nhận, escape caption sang Zalo).
- [x] `npx tsc --noEmit` · `npx eslint .` — sạch.
- [ ] Python: không đụng `ai-engine/`.
- [ ] Kiểm tra hình ảnh desktop/mobile — **hoãn** (quy ước v0.9: không chạy server/Chrome trên máy vận hành). Thẻ Zalo tái dùng nguyên bố cục `SettingCard`/`InputGroup`/`Switch` của thẻ Telegram; khối người nhận thêm `min-w-0` + `break-all` để URL dài không đẩy tràn ngang dialog.
- [x] Kiểm hồi quy chạy tay trên `agent-test.db` (script tạm, không commit): quy tắc Telegram với chat_id không tiền tố vẫn sinh đúng 2 dòng `Alert` `channel='telegram'` cho 2 người nhận; kênh chưa cấu hình không sinh dòng nào; kênh webhook có secret sinh 1 dòng `channel='webhook'` với `errorMessage` khi endpoint không tới được.

## Tài liệu
`wiki/02-kien-truc-he-thong.md` (khối kênh cảnh báo + sơ đồ luồng), `wiki/03-cai-dat-va-van-hanh.md` (`WEBHOOK_SECRET`, `PUBLIC_BASE_URL`), `wiki/04-mo-hinh-du-lieu.md` (`ZaloSettings`), `wiki/05-giao-dien-va-api.md` (route `/api/settings/zalo*`, hook, component), `README.md` (mục biến môi trường), `.env.docker.example`, `docs/ba/04-function-list.md` (F-TG-04 → v0.9, tách F-TG-05/F-TG-06), `docs/ba/07-screen-specs.md` (SCR-14 thêm thẻ Zalo OA, SCR-15 người nhận theo kênh), `CHANGELOG.md`.

## Rủi ro và việc còn lại
- Access token Zalo OA hết hạn sau 25 giờ; bản này chỉ lưu token thủ công, chưa tự refresh bằng `refresh_token` — cần một task riêng nếu vận hành muốn chạy dài ngày.
- Zalo chỉ gửi kèm ảnh khi có `PUBLIC_BASE_URL` (Zalo tự tải ảnh từ URL công khai); không có thì gửi chữ. Webhook cũng dùng biến này cho `snapshotUrl` tuyệt đối.
- Chưa test hình ảnh thẻ Zalo và dialog nhiều kênh trên trình duyệt (hoãn theo quy ước v0.9).
- Kênh `sms`/`email`/`in_app`/`siren`/`pa_system` vẫn chỉ là enum, chưa có sender (F-TG-06, P3).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
