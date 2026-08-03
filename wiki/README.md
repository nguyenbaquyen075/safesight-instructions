# 📚 SafeSight AI — Wiki dự án

> Hệ thống AI giám sát & cảnh báo an toàn lao động (PPE) tại công trường theo thời gian thực.
> Nền tảng: **YOLOv8 (Python)** + **Next.js 15 (TypeScript)**.

Đây là trang chủ tài liệu nội bộ của dự án `safesight-web`. Dùng để onboard thành viên mới, tra cứu kiến trúc, và theo dõi lộ trình.

## 🗂️ Mục lục

| # | Tài liệu | Nội dung |
|---|---|---|
| 01 | [Giới thiệu & phạm vi](01-gioi-thieu.md) | Bài toán, giá trị, phạm vi hệ thống |
| 02 | [Kiến trúc hệ thống](02-kien-truc-he-thong.md) | 3 tầng: YOLO → Bridge → Dashboard |
| 03 | [Cài đặt & vận hành](03-cai-dat-va-van-hanh.md) | Yêu cầu, cài đặt, chạy 3 tiến trình |
| 04 | [Mô hình dữ liệu](04-mo-hinh-du-lieu.md) | Domain model (Prisma), enum, quan hệ |
| 05 | [Giao diện & API](05-giao-dien-va-api.md) | Danh mục trang, API route, React Query hooks |
| 06 | [Tích hợp YOLO](06-tich-hop-yolo.md) | Pipeline nhận diện PPE, lớp phát hiện |
| 07 | [Lộ trình phát triển](07-lo-trinh-phat-trien.md) | Ưu tiên, việc còn thiếu, câu hỏi mở |

## ⚡ Tóm tắt nhanh

- **Trạng thái:** 🟡 MVP đang phát triển (v0.1.0).
- **Độ phủ giao diện:** 9/11 trang xong (thiếu `/reports`, `/profile`).
- **API:** 13 route — **hiện trả về mock data**, chưa nối DB thật.
- **DB (dev):** SQLite (xem [ghi chú lệch cấu hình](04-mo-hinh-du-lieu.md#-lưu-ý-lệch-cấu-hình-db)).
- **Lớp phát hiện PPE:** `helmet` / `vest` (an toàn) · `no_helmet` / `no_vest` (vi phạm).

## 📌 Quy ước tài liệu

- Ngôn ngữ chính: **tiếng Việt**. Thuật ngữ kỹ thuật giữ nguyên tiếng Anh.
- Mỗi khi đổi kiến trúc / thêm trang / đổi schema → **cập nhật wiki tương ứng** trong cùng commit.
- Nguồn tham chiếu gốc: `README.md`, `SPEC.md`, `prisma/schema.prisma` ở thư mục gốc repo.

---
*Cập nhật lần đầu bởi trợ lý AI dựa trên khảo sát codebase. Nếu thấy sai lệch với thực tế, sửa trực tiếp file tương ứng.*
