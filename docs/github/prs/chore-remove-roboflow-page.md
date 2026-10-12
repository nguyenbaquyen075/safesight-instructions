## Tóm tắt
- Gỡ trang **"Kiểm thử Roboflow"** (`/roboflow`) khỏi dashboard: bỏ mục thanh bên, trang và quyền xem trang.
- Giữ `ai-engine/roboflow_workflow.py` và route `POST /api/roboflow` (chỉ admin) nhưng hiện không có giao diện nào gọi tới.

## Issue
Closes #<n>

## Thay đổi chính
- Xoá `src/app/(dashboard)/roboflow/page.tsx`; bỏ mục trong `Sidebar.tsx` (và import `ScanSearch`) và dòng `'/roboflow'` trong `PAGE_ROLES`.
- README (mục "Trang kiểm thử trên dashboard (đã gỡ)"), `wiki/02,03,05,06,07`, `CHANGELOG.md` cập nhật cùng commit.
- Không đụng route API, script Python hay biến `ROBOFLOW_API_KEY`.

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint` (các file đã sửa).
- [x] Chrome headless trên dev server nền `main`: menu còn đủ 11 mục không có "Kiểm thử Roboflow"; `/roboflow` trả 404.
- [ ] `docs/ba/07-screen-specs.md` (mục SCR-11 Roboflow) chưa cập nhật.

## Tài liệu
README, wiki 02/03/05/06/07, CHANGELOG (Unreleased → Thay đổi).

## Rủi ro và việc còn lại
- Route `POST /api/roboflow` còn nhưng không có giao diện; có thể gỡ nốt trong một thay đổi riêng nếu không dùng nữa.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
