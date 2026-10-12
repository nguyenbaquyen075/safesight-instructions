# Gỡ trang "Kiểm thử Roboflow" khỏi dashboard
branch: chore/remove-roboflow-page

## Vấn đề
Trang `/roboflow` (mục "Kiểm thử Roboflow" ở thanh bên) chỉ dùng để đối chiếu thủ công model cloud trên ảnh tĩnh, mỗi lần chạy tốn 1 credit Roboflow và không còn cần trên dashboard.

## Đề xuất
- Bỏ mục ở thanh bên, bỏ trang và quyền xem trang (`PAGE_ROLES`).
- Giữ script `ai-engine/roboflow_workflow.py` và route `POST /api/roboflow` (chỉ admin); cập nhật README, wiki và CHANGELOG.

## Tiêu chí nghiệm thu
- [ ] Thanh bên không còn "Kiểm thử Roboflow"; `/roboflow` trả 404.
- [ ] Các mục menu khác vẫn đủ; `tsc` và lint sạch.
