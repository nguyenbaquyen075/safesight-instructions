# 15 — Quy tắc triển khai dự án và bộ tài liệu

## Quy tắc triển khai

1. **Phân tích chi tiết trước khi làm.** Mọi tính năng mới đi qua brainstorming → spec trong `docs/superpowers/specs/` → plan trong `docs/superpowers/plans/` (quy trình Superpowers trong `AGENTS.md`). Spec là nguồn quyết định khi plan và code mâu thuẫn.
2. **Liệt kê đầu việc từng khâu.** Plan chia task nhỏ, mỗi task có: độ phức tạp (S/M/L), workload ước lượng, file đụng tới, cách kiểm thử, người review. Task chưa có review không đưa vào sprint.
3. **Sprint đang chạy hạn chế thay đổi.** Yêu cầu chỉnh nghiệp vụ phát sinh giữa sprint ghi vào `docs/ba/meetings/` (nhật ký quyết định) và đưa vào sprint sau; ngoại lệ chỉ khi chặn nghiệm thu.
4. **BA UAT cuối mỗi sprint.** Kiểm theo AC trong [13-user-stories.md](13-user-stories.md) và bảng use case; ghi kết quả vào biên bản sprint. Thay đổi AI phải kèm số liệu `eval_ppe_decision.py` và `sweep_threshold.py`.
5. **Định nghĩa hoàn thành (DoD):** code + test + tài liệu (wiki / README / BA) trong cùng commit; `npm run lint`, `npx tsc --noEmit`, `npm run test:agent` xanh; kiểm tra desktop và mobile khi có giao diện; không hồi quy chức năng đã có.
6. **Nhánh và phát hành:** nhánh `feat/`, `fix/`, `docs/` từ `main`; PR có CI xanh; phát hành bằng tag `vX.Y.Z` + `CHANGELOG.md` (workflow tự tạo Release, Docker image lên GHCR).
7. **Môi trường:** dev (SQLite, `npm run dev`) → kiểm thử → build artifact / image → production (PostgreSQL). Không sửa trực tiếp trên production.

## Bộ tài liệu dự án phải duy trì

| Tài liệu | Vị trí | Cập nhật khi |
|---|---|---|
| Biên bản họp / nhật ký quyết định | [`docs/ba/meetings/`](meetings/README.md) | Mỗi buổi họp, mỗi quyết định nghiệp vụ |
| SRS — đặc tả yêu cầu phần mềm | [`docs/ba/SRS.md`](SRS.md) | Đổi chức năng, giao diện, dữ liệu, NFR |
| URD — yêu cầu người dùng | [`docs/ba/URD.md`](URD.md) | Đổi nhu cầu / vai trò người dùng |
| BRD — yêu cầu nghiệp vụ (tuỳ chọn) | [`docs/ba/BRD.md`](BRD.md) | Đổi mục tiêu, phạm vi, tiêu chí thành công |
| HDSD — hướng dẫn sử dụng | [`docs/ba/HDSD.md`](HDSD.md) | Đổi màn hình hoặc thao tác |
| 15 sản phẩm BA | `docs/ba/01..15` | Cùng commit với thay đổi nghiệp vụ liên quan |
| Tài liệu kỹ thuật | [`wiki/`](../../wiki/README.md), `README.md`, `DESIGN.md` | Đổi kiến trúc, cài đặt, API, model, giao diện |

## Tồn đọng nghiệp vụ đưa vào sprint sau

- Giới hạn vai trò được xoá vi phạm và cảnh báo (hiện mọi vai trò đăng nhập đều xoá được).
- Panel hỏi đáp chưa hiện lý do khi hết trần token ngày.
- `GET /api/agent/events?sessionId` chưa kiểm chủ sở hữu phiên.
- Caption Telegram mặc định chưa escape HTML.
- Sidebar chưa responsive dưới 768px.
- Trang `/reports`, `/profile`; tạo người dùng; sửa / xoá công trường; đọc `AuditLog`.
