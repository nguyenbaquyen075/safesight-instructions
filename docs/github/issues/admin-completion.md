# Quản trị người dùng và nhật ký thao tác (F8)

## Vấn đề

`/users` chỉ xem/sửa/xoá được người dùng có sẵn — không tạo được người dùng mới (`POST /api/users` chưa có). Không ai tự đổi được mật khẩu của chính mình (không có trang `/profile`, chỉ có API PATCH đổi vai trò/site cho admin). Model `AuditLog` đã có trong schema nhưng chưa route nào ghi vào đó, nên không ai biết ai đã đổi gì, khi nào.

## Đề xuất

- `POST /api/users` (org-wide, `SUPER_ADMIN`/`ORG_ADMIN`): tạo user với `name`, `email`, `password` (≥ 8 ký tự, băm bcrypt), `role`, `assignedSites`; 409 khi email trùng. Dialog "Thêm người dùng" trên `/users`.
- Trang `/profile`: xem tên/email/vai trò (chỉ đọc) + form đổi mật khẩu qua `PATCH /api/users/me/password` (`{ currentPassword, newPassword }`, xác minh bcrypt). Vào từ menu avatar ở Header.
- `src/lib/audit-log.ts`: helper `logAudit()` ghi 1 dòng `AuditLog` cho các POST/PATCH/DELETE đáng chú ý (người dùng, camera, quy tắc cảnh báo, Telegram, cài đặt agent, subagent camera). `GET /api/audit-log` (org-wide, `?limit&resource`) + tab "Nhật ký" trong `/settings`.
- Ngoài phạm vi: quên mật khẩu (đặt lại khi không nhớ mật khẩu cũ) — cần gửi email, để backlog riêng.

## Acceptance Criteria

- [ ] `POST /api/users` tạo được user mới, băm mật khẩu bằng bcrypt, trả 409 khi email đã tồn tại, trả 403 cho vai trò không phải org-wide.
- [ ] Dialog "Thêm người dùng" trên `/users` tạo user thành công và danh sách cập nhật ngay.
- [ ] `/profile` hiển thị đúng thông tin session; đổi mật khẩu thành công khi mật khẩu cũ đúng, báo lỗi rõ ràng khi sai hoặc mật khẩu mới < 8 ký tự.
- [ ] Menu avatar ở Header có link vào `/profile` (và vẫn giữ link `/settings`).
- [ ] `logAudit()` ghi đúng `userId/userName/action/resource/resourceId/details/ipAddress`, không throw khi DB lỗi; được gọi trong POST/PATCH/DELETE của users, cameras, alert-rules, Telegram, cài đặt agent, subagent camera.
- [ ] Tab "Nhật ký" trong `/settings` hiển thị bảng có trạng thái tải/rỗng/lỗi.
- [ ] `npm run test:agent`, `npx tsc --noEmit`, `npx eslint .` đều xanh.
- [ ] Tài liệu (`wiki/05`, `docs/ba/04,05,07,08,13`, `CHANGELOG.md`) cập nhật cùng commit.
