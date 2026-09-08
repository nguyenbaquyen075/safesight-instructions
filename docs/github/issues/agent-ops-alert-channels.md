# Leo thang vận hành của agent chỉ đi Telegram, bỏ qua Zalo/Webhook
branch: fix/agent-ops-alert-channels

## Vấn đề
Review health (`arch/agent/parallel-notification-path`): `agent/lib/notify.ts` tự tìm rule
Telegram và gọi `TelegramClient` trực tiếp, không qua `src/lib/alert-channels`. Công trường cấu
hình cảnh báo qua Zalo OA hoặc Webhook không bao giờ nhận được leo thang vận hành của agent
(engine treo, camera mất, việc quá hạn), và mọi kênh mới về sau cũng bị bỏ sót.

## Đề xuất
- `opsTargets(rules)` thuần: rule đang bật có `violationTypes` rỗng (không có thì rule bật đầu tiên) →
  danh sách (kênh, người nhận) cho mọi kênh có sender; `sendOpsAlert` gửi qua `senderFor(channel)`.
- Không ghi `Alert` (bảng cần `violationId`), ghi rõ trong wiki/09.

## Tiêu chí nghiệm thu
- [ ] Test `opsTargets` với rule nhiều kênh và tiền tố `zalo:`/`webhook:`; `sendOpsAlert` với sender giả.
- [ ] Test escalate/alert-channels hiện có vẫn xanh.
