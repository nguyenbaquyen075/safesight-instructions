# 📚 SafeSight AI — Wiki dự án

> Hệ thống AI giám sát & cảnh báo an toàn lao động (PPE) tại công trường theo thời gian thực.
> Nền tảng: **YOLOv8 (Python)** + **Next.js 16 (TypeScript)**.

Trang chủ tài liệu nội bộ của dự án `safesight-instructions`. Dùng để onboard thành viên mới, tra cứu kiến trúc, và theo dõi lộ trình.

## 🗂️ Mục lục

| # | Tài liệu | Nội dung |
|---|---|---|
| 01 | [Giới thiệu & phạm vi](01-gioi-thieu.md) | Bài toán, giá trị, phạm vi hệ thống |
| 02 | [Kiến trúc hệ thống](02-kien-truc-he-thong.md) | 3 tiến trình: AI Engine → Bridge → Dashboard, luồng ghi DB + Telegram |
| 03 | [Cài đặt & vận hành](03-cai-dat-va-van-hanh.md) | Yêu cầu, env, file model, `npm run dev` |
| 04 | [Mô hình dữ liệu](04-mo-hinh-du-lieu.md) | Domain model (Prisma), enum, ánh xạ PPE → ViolationType |
| 05 | [Giao diện & API](05-giao-dien-va-api.md) | Trang, quyền xem, API route, hooks |
| 06 | [Tích hợp YOLO](06-tich-hop-yolo.md) | Pipeline nhận diện PPE, lớp phát hiện, Roboflow đối chiếu |
| 07 | [Lộ trình phát triển](07-lo-trinh-phat-trien.md) | Đã xong, ưu tiên tiếp theo, câu hỏi mở |
| 08 | [Train lại model găng/giày](08-train-model-them-ppe.md) | Vì sao và cách train lại, nghiệm thu |

## ⚡ Tóm tắt nhanh

- **Trạng thái:** 🟡 MVP đang phát triển (v0.1.0).
- **Chạy:** `npm run dev` khởi động Next.js (3000) + YOLO Bridge (4001) + AI engine Python.
- **Giao diện:** 10 trang trong dashboard, thiếu `/reports` và `/profile`.
- **API:** 15 route, tất cả đã nối DB thật (Prisma + SQLite dev).
- **AI:** model chính `ppe_multiclass.pt` 11 lớp + model phụ găng/giày + pose; bắt buộc mũ, áo, găng, giày.
- **Cảnh báo:** Telegram theo `AlertRule`; mic → loa công trường qua Socket.IO.

## 📌 Quy ước tài liệu

- Ngôn ngữ chính: **tiếng Việt**. Thuật ngữ kỹ thuật giữ nguyên tiếng Anh.
- Mỗi khi đổi kiến trúc / thêm trang / đổi schema / đổi file model → **cập nhật wiki tương ứng** trong cùng commit.
- Nguồn tham chiếu gốc: `README.md`, `SPEC.md`, `prisma/schema.prisma`, `docs/superpowers/specs/`.

---
*Cập nhật 2026-09-07 theo khảo sát codebase. Nếu thấy sai lệch với thực tế, sửa trực tiếp file tương ứng.*
