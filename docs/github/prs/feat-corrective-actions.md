## Tóm tắt
- Vi phạm có thể **giao xử lý**: người phụ trách, mô tả, hạn (mặc định +24 h); danh sách việc với chip "Quá hạn" và nút "Đã khắc phục" (ghi chú bằng chứng). Giao việc đưa vi phạm sang `UNDER_REVIEW`; xong hết việc (≥ 1 DONE, không còn OPEN) thì `RESOLVED`.
- `/reports` có mục "Việc khắc phục" (đang mở / quá hạn theo công trường).
- Agent: sweep sức khoẻ phát hiện việc quá hạn → leo thang vận hành **một lần mỗi việc**; `read_violation` và báo cáo ca/tuần biết việc còn mở.

## Issue
Closes #<n>

## Thay đổi chính
- Schema (cả hai file Prisma, test parity): `CorrectiveAction` (assignee, description, dueAt, status OPEN/DONE/CANCELLED, evidenceNote, completedAt, escalatedAt, createdById) + `Violation.actions`.
- `src/lib/corrective-action-shape.ts`: zod tạo/cập nhật, `isOverdue`, `toActionDTO`. Routes `GET/POST /api/violations/[id]/actions`, `PATCH /api/actions/[id]` (auto-resolve chỉ khi vi phạm đang `OPEN`/`UNDER_REVIEW`, không đè `FALSE_POSITIVE`), `GET /api/actions?siteId&status=open|overdue&limit` (scope site, limit 1–200); `AuditLog` cho POST/PATCH.
- Modal: "Giao xử lý" thay "Lập phiếu phạt" (chọn người từ `GET /api/users` chỉ khi vai trò được vào `/users`, hoặc nhập tên; `assigneeId` chỉ gán khi tên khớp duy nhất).
- Agent direct lane: `HealthSignals.overdueActionIds`, finding `capa.overdue` (`detail = { count, ids }`, không rơi vào khối lặp chung), `applyFindings` tạo một task `ops.escalate` liệt kê ≤ 5 việc và đặt `escalatedAt` (idempotent); `read_violation.actions` (≤ 10), `read_agent_activity.openActions/overdueActions`, OPENING báo cáo ca/tuần.

## Kiểm thử
- [x] `agent/test/*.test.ts` 212/212 (`corrective-actions.test.ts` 12 test, RED trước; hai guard kiểm red/green thật)
- [x] `npx tsc --noEmit` · `npx eslint .`
- [ ] Kiểm tra hình ảnh desktop/mobile — hoãn tới sau khi gộp

## Tài liệu
wiki/04, wiki/05, wiki/09, docs/ba/04 F-VIO-06, docs/ba/11 UC-29, CHANGELOG.

## Rủi ro và việc còn lại
- `dev.db` cần `npx prisma db push` sau khi gộp.
- Test auto-resolve dùng chung hằng điều kiện với route thay vì gọi route (route cần session NextAuth).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
