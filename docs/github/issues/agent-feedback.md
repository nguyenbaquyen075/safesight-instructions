# Phản hồi đúng/sai cho phán quyết của agent và xuất dữ liệu retrain
branch: feat/agent-feedback

## Vấn đề
Agent phán quyết vi phạm thật/báo oan nhưng không ai đo được nó đúng bao nhiêu phần trăm,
và các trường hợp nó đánh sai không được gom lại để huấn luyện lại model. Vòng
AI → người → dữ liệu → model đang hở.

## Đề xuất
- Trong thẻ review của agent, người dùng bấm "Đúng" / "Sai" (kèm ghi chú khi sai); lưu vào
  `Violation.reviewFeedback`, ghi `AuditLog`.
- `/agent` có thẻ "Độ chính xác của agent" theo camera và theo loại (7/30 ngày); `/reports` xuất
  CSV các vi phạm có phản hồi (ảnh, clip, phán quyết, nhãn người) làm dataset retrain.
- Subagent camera đọc được tỉ lệ bị đánh sai của camera mình để thận trọng hơn (PROBABLE thay vì VERIFIED).

## Tiêu chí nghiệm thu
- [ ] `agentAccuracy(rows)` thuần có test; PATCH feedback từ chối vi phạm chưa có review (409).
- [ ] Cả hai file schema Prisma cập nhật, test parity xanh.
- [ ] CSV UTF-8 có BOM, mở được bằng Excel; wiki/08 hướng dẫn dùng CSV để retrain.
- [ ] Tài liệu wiki/05, wiki/09, wiki/08, BA F-AGENT-11, CHANGELOG cùng PR.
