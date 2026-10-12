## Tóm tắt
- "Thông báo gần đây": ảnh bằng chứng của vi phạm (112×96), khung cao 440px, hiện 8 thông báo.
- "Trạng thái công trường": mỗi công trường có ảnh minh hoạ ở đầu thẻ (ảnh bằng chứng mới nhất; không có/đã xoá thì ảnh công trường chung).

## Issue
Closes #<n>

## Thay đổi chính
- `src/components/dashboard/FallbackImage.tsx` (mới): `<img>` có ảnh dự phòng khi lỗi tải, thử lại khi đổi `src` (ảnh bằng chứng bị engine xoá khi tắt).
- `AlertTimeline.tsx`: thumbnail dùng `snapshotUrl` thay cho video cố định; ô to hơn, panel `h-[440px]`.
- `SiteStatusGrid.tsx`: prop `images` (siteId → ảnh), ảnh `h-32` ở đầu mỗi thẻ; panel `h-[440px]`.
- `src/app/(dashboard)/page.tsx`: tính `siteImages` từ danh sách vi phạm (mới → cũ), hiện 8 thông báo, `min-h-[440px]`.
- `public/images/site-placeholder.jpg`: ảnh chung, lấy từ `landing-page/assets/site-preview.jpg`.

## Kiểm thử
- [x] `npx tsc --noEmit` · `npx eslint` (các file đã sửa).
- [x] Chrome headless trên nền `main` (DB mẫu có vi phạm kèm ảnh dọc): 8/8 ảnh thông báo và 3/3 ảnh công trường tải được, công trường có vi phạm hiện ảnh bằng chứng, công trường chưa có hiện ảnh chung, hai khung cao 538px, không tràn ngang.
- [x] Trên bản `main-moi` với dữ liệu thật khi engine tắt (ảnh đã bị xoá): tất cả rơi về ảnh dự phòng, không ô trống.
- [ ] Điện thoại: ảnh trong danh sách thông báo tải khi cuộn tới (tải lười); chế độ sáng — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Sửa).

## Rủi ro và việc còn lại
- Nhánh này và `chore/demo-two-videos` cùng sửa thumbnail trong `AlertTimeline.tsx`; nếu gộp cả hai, giữ khối thumbnail của nhánh này.
- Ảnh dự phòng là ảnh chung cho mọi công trường (chưa có ảnh riêng theo công trường).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
