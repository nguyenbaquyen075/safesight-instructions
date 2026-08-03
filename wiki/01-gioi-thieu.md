# 01 — Giới thiệu & phạm vi

## Bài toán

An toàn lao động tại công trường vẫn là thách thức lớn:

- Môi trường nhiều rủi ro: vật rơi, máy móc, khu vực nguy hiểm.
- Công nhân có thể **quên mũ bảo hộ, áo phản quang (PPE)**.
- Giám sát thủ công bằng người không bao quát được nhiều camera 24/7, phản ứng chậm khi có vi phạm.

## Giải pháp — SafeSight AI

Biến **camera công trường sẵn có** thành hệ thống giám sát thông minh:

- **Tự động phát hiện** vi phạm PPE theo thời gian thực bằng AI (Computer Vision / YOLOv8).
- **Cảnh báo tức thì** đến người phụ trách qua dashboard (và các kênh mở rộng: SMS, email, còi hú…).
- **Thống kê & báo cáo** tỉ lệ tuân thủ, xu hướng vi phạm theo thời gian, theo công trường.

> **Thông điệp chính:** SafeSight AI biến camera công trường thành hệ thống giám sát thông minh, tự động phát hiện vi phạm an toàn lao động theo thời gian thực bằng AI.

## Phạm vi hệ thống (MVP)

| Trong phạm vi | Ngoài phạm vi (giai đoạn sau) |
|---|---|
| Phát hiện mũ bảo hộ / áo phản quang | Phát hiện dây an toàn, té ngã, khói/lửa (đã định nghĩa enum, chưa train) |
| Dashboard realtime + thống kê | App di động native |
| Quản lý camera, công trường, người dùng | Tích hợp phần cứng còi/loa công trường |
| Cảnh báo trong ứng dụng (in-app) | Kênh SMS/Email/Webhook (đã khai báo, chưa nối) |

## Đối tượng sử dụng (vai trò)

Hệ thống phân quyền theo 5 vai trò (xem [Mô hình dữ liệu](04-mo-hinh-du-lieu.md)):

- `SUPER_ADMIN` — quản trị toàn hệ thống.
- `ORG_ADMIN` — quản trị tổ chức/doanh nghiệp.
- `SITE_MANAGER` — quản lý công trường.
- `SAFETY_OFFICER` — cán bộ an toàn.
- `SUPERVISOR` — giám sát viên.

## Bối cảnh dự án

- Sản phẩm khởi nguồn từ **cuộc thi startup sinh viên** (xem `wiki/safesight-slide-spec.md` cho bản thuyết trình 18 slide).
- Nhóm phát triển: AHV Works / PPP Safety.
- Định hướng: cân bằng giữa **tác động xã hội**, **khả thi kỹ thuật**, và **mô hình kinh doanh**.

---
👉 Tiếp theo: [Kiến trúc hệ thống](02-kien-truc-he-thong.md)
