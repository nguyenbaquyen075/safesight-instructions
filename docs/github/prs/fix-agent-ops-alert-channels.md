## Tóm tắt
- Leo thang vận hành của agent (engine treo, camera mất, việc quá hạn…) giờ tới **mọi kênh** đã cấu hình trong `AlertRule` — Zalo OA và Webhook, không chỉ Telegram.

## Issue
Closes #<n>

## Thay đổi chính
- `agent/lib/notify.ts`: `opsTargets(rules)` thuần (rule đang bật có `violationTypes` rỗng, không có thì rule bật đầu tiên → mỗi kênh có sender × mỗi người nhận, tôn trọng tiền tố `zalo:`/`webhook:`); `sendOpsAlert(text, senders = senderFor)` gửi qua `src/lib/alert-channels`, một kênh lỗi không chặn kênh khác, trả `{ sent, perChannel }`.
- `src/lib/alert-channels/*`: `AlertSendInput.violation`/`camera` tuỳ chọn; Telegram gửi text khi không có ảnh, Zalo fallback `sendText`, Webhook gửi `{ event: 'ops', caption }`. Đường vi phạm không đổi.
- `agent/direct/actions.ts`: nhãn event `ops.alert` (thay `ops.telegram`).

## Kiểm thử
- [x] `agent/test/*.test.ts` 188/188 (`ops-alert.test.ts` 8 test, sender giả, viết RED trước)
- [x] `npx tsc --noEmit` · `npx eslint .`

## Tài liệu
wiki/09 (đường leo thang vận hành, lý do không ghi bảng `Alert`), CHANGELOG.

## Rủi ro và việc còn lại
- Cảnh báo vận hành không có dòng `Alert` (bảng cần `violationId`) nên không hiện ở `/alerts`, chỉ ở nhật ký `AgentEvent`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
