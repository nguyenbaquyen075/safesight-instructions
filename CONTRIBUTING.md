# Đóng góp cho SafeSight

Khi tham gia, bạn đồng ý tuân theo [Quy tắc ứng xử](./CODE_OF_CONDUCT.md) của dự án.

Cảm ơn anh/chị đã quan tâm. Quy trình ngắn gọn:

1. **Mở issue** mô tả lỗi hoặc đề xuất trước khi làm thay đổi lớn.
2. **Tạo nhánh** từ `main`: `feat/<ten>`, `fix/<ten>`, `docs/<ten>`.
3. **Đọc tài liệu** trong [`wiki/`](./wiki/README.md) và quy ước trong [`AGENTS.md`](./AGENTS.md) (định danh code tiếng Anh, commit message tiếng Anh dạng `type(scope): summary`, tài liệu cập nhật cùng commit).
4. **Kiểm tra trước khi gửi**: `npm run lint`, `npx tsc --noEmit`, `npm run test:agent`. Thay đổi AI engine thì chạy thêm `ai-engine/eval_ppe_decision.py` và `ai-engine/sweep_threshold.py` (xem README mục "File model cần có"). Thêm gói Python mới thì ghim phiên bản vào `ai-engine/requirements.txt` trong cùng commit.
5. **Gửi Pull Request** vào `main`; CI (lint, types, tests, Docker build) phải xanh. Mô tả rõ thay đổi, cách kiểm thử và ảnh chụp nếu có giao diện.

Mọi đóng góp được phát hành theo giấy phép MIT của dự án.
