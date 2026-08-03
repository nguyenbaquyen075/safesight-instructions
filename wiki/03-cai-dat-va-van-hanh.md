# 03 — Cài đặt & vận hành

## Yêu cầu hệ thống

**Node.js**
- Node.js >= 18 (khuyến nghị 20)
- npm hoặc yarn

**Python** (chỉ cần khi chạy AI)
- Python >= 3.9
- Thư viện: `ultralytics`, `opencv-python`, `requests`

## Cài đặt

```bash
# 1. Dependencies cho Next.js
npm install

# 2. Dependencies cho Python (nếu chạy YOLO)
pip install ultralytics opencv-python requests
```

## Biến môi trường

Tạo file `.env` ở thư mục gốc. Tối thiểu cần:

```env
# NextAuth
AUTH_SECRET="<chuỗi bí mật ngẫu nhiên>"

# Database — dev đang dùng SQLite (xem tài liệu Mô hình dữ liệu)
DATABASE_URL="file:./dev.db"
```

> ⚠️ **Lưu ý:** `SPEC.md` mô tả `DATABASE_URL` dạng PostgreSQL, nhưng `prisma/schema.prisma` hiện cấu hình **SQLite** cho môi trường dev. Xem [ghi chú lệch cấu hình DB](04-mo-hinh-du-lieu.md#-lưu-ý-lệch-cấu-hình-db) trước khi setup.

## Chạy hệ thống

> **Quan trọng:** mở **3 terminal riêng biệt**, chạy đúng thứ tự.

### Terminal 1 — Frontend (port 3000)
```bash
npm run dev
```
Truy cập: http://localhost:3000

### Terminal 2 — YOLO Bridge (port 4000)
```bash
node yolo_bridge.js
```

### Terminal 3 — YOLO Inference (Python)
```bash
python yolo_inference.py
```
Script sẽ:
- Load model `ppe_v8s_custom.pt`.
- Đọc video từ `public/videos/test1.mp4` (fallback sang webcam nếu không có).
- Gửi detection đến Bridge (`http://localhost:4000/detections`).

> 💡 Chỉ muốn xem giao diện? Chạy **Terminal 1** là đủ (API trả mock data, không cần YOLO).

## Các lệnh npm

| Lệnh | Tác dụng |
|---|---|
| `npm run dev` | Chạy dev server (hot reload) |
| `npm run build` | Build production |
| `npm run start` | Chạy bản đã build |
| `npm run lint` | Kiểm tra ESLint |

## Tinh chỉnh YOLO (`yolo_inference.py`)

```python
VIDEO_PATH = "public/videos/test1.mp4"   # nguồn video
MODEL_PATH = "ppe_v8s_custom.pt"          # model
# ngưỡng tin cậy: giảm để bắt nhiều hơn, tăng để chính xác hơn
tracker = PPEViolationTracker(model_path=MODEL_PATH, confidence=0.5)
```

## Quy trình cộng tác qua Git

Do máy phát triển của trợ lý AI không chạy nổi toàn bộ hệ thống (YOLO/GPU), quy trình là:
1. Trợ lý **clone → sửa code → `git push`** lên GitLab.
2. Người phụ trách **`git pull`** về máy local (Windows + WSL2) để **chạy & kiểm thử thật**.

---
👉 Tiếp theo: [Mô hình dữ liệu](04-mo-hinh-du-lieu.md)
