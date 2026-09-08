## Tóm tắt
- Người dùng đánh dấu phán quyết của agent là **Đúng / Sai** (kèm ghi chú khi sai) ngay trong thẻ review của vi phạm; lưu `Violation.reviewFeedback`, ghi `AuditLog`, sửa được.
- `/agent` có thẻ **"Độ chính xác của agent"** (7/30 ngày) theo camera và theo loại vi phạm; `/reports` xuất **CSV phản hồi** (ảnh, clip, phán quyết, nhãn người) làm dataset retrain.
- Subagent camera đọc được tỉ lệ bị đánh sai của camera mình và thận trọng hơn (PROBABLE thay vì VERIFIED khi ≥ 30% sai trên ≥ 3 phản hồi).

## Issue
Closes #<n>

## Thay đổi chính
- Schema (cả hai file Prisma, test parity): `Violation.reviewFeedback String?` JSON `{ correct, note?, userId, userName?, at }` (userId/userName lấy từ session; thẻ hiện "<tên> đã đánh giá lúc <giờ>").
- `src/lib/agent-accuracy-shape.ts`: `reviewFeedbackSchema`, `agentAccuracy(rows)`, `accuracyRange`, `csvRow`, `AGENT_FEEDBACK_CSV_HEADER` — thuần, có test. JSON hỏng không bao giờ được tính là "agent đúng".
- Routes: `PATCH /api/violations/[id]/feedback` (session + `assertSiteAccess`, 409 khi chưa có review), `GET /api/stats/agent-accuracy?siteId&from&to`, `GET /api/reports/agent-feedback?siteId&from&to` (CSV UTF-8 BOM, `attachment`, scope `allowedSiteIds`, tối đa 20 000 dòng — vượt thì header `X-Truncated` và tên file `-partial`); thống kê cũng giới hạn 20 000 dòng mới nhất, bảng sắp theo số sai giảm dần.
- UI: `AgentReviewCard` (hàng "Phán quyết này đúng không?"), thẻ độ chính xác trên `/agent` (`useAgentAccuracy`), nút xuất trên `/reports`.
- Agent: `read_camera_history.agentFeedback { total, wrong, wrongRate }` 7 ngày; `agent/skills/ppe-review/SKILL.md` thêm quy tắc thận trọng.

## Kiểm thử
- [x] `agent/test/*.test.ts` 223/223 (`agent-accuracy-shape.test.ts` 9 test + 1 case `read_camera_history`, RED trước)
- [x] `npx tsc --noEmit` · `npx eslint .`
- [ ] Kiểm tra hình ảnh desktop/mobile — hoãn tới sau khi gộp

## Tài liệu
wiki/04, wiki/05, wiki/08 (mục "Xuất phản hồi agent làm dataset"), wiki/09, docs/ba/04, CHANGELOG.

## Rủi ro và việc còn lại
- Một phản hồi mỗi vi phạm (mới nhất thắng), lịch sử ở `AuditLog`.
- `dev.db` cần `npx prisma db push` sau khi gộp.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
