## Tóm tắt
- `POST /api/users` (org-wide) băm mật khẩu bằng bcrypt, 409 khi email trùng; dialog "Thêm người dùng" trên `/users`.
- Trang `/profile` (xem thông tin, đổi mật khẩu qua `PATCH /api/users/me/password`), link từ menu avatar trong Header.
- `src/lib/audit-log.ts` (`logAudit()`) ghi `AuditLog` ở POST/PATCH/DELETE của users, cameras, alert-rules, Telegram, cài đặt agent, subagent camera; `GET /api/audit-log` + tab "Nhật ký" trong `/settings`.

## Issue
Closes #<n>

## Thay đổi chính
- `src/lib/user-shape.ts`: thêm `createUserSchema` (zod, dùng chung API + test thuần).
- `src/lib/audit-log.ts` (mới): `logAudit({ session, action, resource, resourceId?, details?, request? })`, không bao giờ throw, IP lấy từ `x-forwarded-for` (mặc định `'local'`).
- `src/app/api/users/route.ts`: thêm `POST`; `orgId` của user mới lấy theo tổ chức của người tạo (fallback tổ chức đầu tiên cho tài khoản dev cứng).
- `src/app/api/users/[id]/route.ts`, `src/app/api/users/me/password/route.ts` (mới), `src/app/api/audit-log/route.ts` (mới).
- Gọi `logAudit()` thêm vào: `src/app/api/cameras/route.ts`, `src/app/api/cameras/[id]/route.ts`, `src/app/api/alert-rules/route.ts`, `src/app/api/alert-rules/[id]/route.ts`, `src/app/api/settings/telegram/route.ts`, `src/app/api/agent/settings/route.ts`, `src/app/api/agent/cameras/[id]/route.ts`.
- UI: `src/components/users/AddUserDialog.tsx` (mới), `src/app/(dashboard)/users/page.tsx` (nút "Thêm Người dùng"), `src/app/(dashboard)/profile/page.tsx` (mới), `src/components/layout/Header.tsx` (avatar → dropdown menu Hồ sơ/Cài đặt), `src/components/settings/AuditLogCard.tsx` (mới) + tab "Nhật ký" trong `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/layout.tsx` (tiêu đề Header cho `/profile`).
- Hooks: `useCreateUser`, `useChangePassword` (`src/hooks/use-users.ts`), `useAuditLog` (`src/hooks/use-audit-log.ts`, mới).
- Quyền: `/profile` không có trong `PAGE_ROLES` → mở cho mọi vai trò đã đăng nhập (không cần sửa `permissions.ts`).

## Kiểm thử
- [x] `npm run test:agent` (100/100, gồm `agent/test/audit-log.test.ts` và `agent/test/user-shape.test.ts` mới)
- [x] `npx tsc --noEmit` · `npx eslint .`
- [ ] Python: `python3 -m unittest` / `py_compile` (không đụng ai-engine)
- [ ] Kiểm tra hình ảnh desktop/mobile — hoãn: không chạy Chrome/server trong môi trường này (theo ràng buộc worktree); code theo đúng pattern responsive sẵn có (`SettingCard`/`Dialog` dùng lại nguyên trạng)

## Tài liệu
`wiki/05-giao-dien-va-api.md`, `docs/ba/04-function-list.md` (F-USER-04, F-AUTH-03, F-AUD-01, F-PROF-01 → v0.9), `docs/ba/05-permission-matrix.md`, `docs/ba/07-screen-specs.md` (SCR-17/18/19), `docs/ba/08-sitemap.md`, `docs/ba/13-user-stories.md` (US-18 ✅), `CHANGELOG.md`.

## Rủi ro và việc còn lại
- Quên mật khẩu (đặt lại khi không nhớ mật khẩu cũ) chưa làm — cần kênh email, để backlog riêng (đã ghi trong issue).
- Tài khoản dev cứng (`admin@safesight.ai`, không có dòng `User`) không đổi được mật khẩu — API trả lỗi rõ ràng thay vì crash.
- Chưa kiểm tra UI thật trên trình duyệt (desktop/mobile) do ràng buộc môi trường của worktree này; đề nghị review viên bấm thử `/users` → Thêm người dùng, `/profile`, và tab Nhật ký trước khi merge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
