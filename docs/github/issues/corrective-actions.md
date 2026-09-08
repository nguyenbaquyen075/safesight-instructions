# Giao và theo dõi việc khắc phục vi phạm (CAPA)
branch: feat/corrective-actions

## Vấn đề
Nút "Lập phiếu phạt" trong modal vi phạm chỉ hiện toast, không lưu gì. Sau khi phát hiện vi
phạm, hệ thống không biết ai phải xử lý, hạn nào, đã khắc phục chưa — phần "hành động khắc phục"
của quy trình an toàn lao động đang nằm ngoài hệ thống.

## Đề xuất
- Model `CorrectiveAction` (người phụ trách, mô tả, hạn, trạng thái, ghi chú bằng chứng, thời điểm leo thang).
- API tạo/sửa/liệt kê việc theo vi phạm và theo công trường (đang mở / quá hạn); tạo việc đưa
  vi phạm sang `UNDER_REVIEW`, xong hết việc thì `RESOLVED`; ghi `AuditLog`.
- Modal: "Giao xử lý" thay "Lập phiếu phạt", danh sách việc với chip "Quá hạn", nút "Đã khắc phục".
  `/reports` thêm mục việc khắc phục.
- Agent: sweep sức khoẻ phát hiện việc quá hạn → leo thang vận hành một lần mỗi việc;
  `read_violation` và báo cáo ca/tuần biết việc còn mở.

## Tiêu chí nghiệm thu
- [ ] zod tạo/cập nhật, `isOverdue`, `decide` sinh `capa.overdue`, `applyFindings` đặt `escalatedAt` và tạo đúng một task — có test.
- [ ] Cả hai file schema Prisma cập nhật, test parity xanh.
- [ ] Tài liệu wiki/04, wiki/05, wiki/09, BA F-VIOL-05 + UC mới, CHANGELOG cùng PR.
