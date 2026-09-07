# 08 — Bắt găng tay / giày chuẩn hơn (train lại model)

> ✅ **Cập nhật thực tế:** Model đang chạy `ppe_multiclass.pt` **ĐÃ CÓ SẴN** 11 lớp — gồm cả
> `gloves`/`no_gloves`/`boots`/`no_boots` (train từ dataset Roboflow `detech-ppe-7qydu`, xem
> `training/detech_ppe_colab.md`). **KHÔNG cần train model mới từ đầu** — vấn đề còn lại là
> model **detect gloves/boots kém chính xác** (recall thấp: test camera thật cho thấy model
> hiếm khi nhận dương tính dù người có mang găng/giày). Bài toán ở đây là **train LẠI cho tốt
> hơn**, không phải "thêm lớp mới".

## Trạng thái hiện tại (đã làm)
- `ppe_tracker.py`: đã có khung riêng cho gloves/boots (Tầng 1), lọc theo `PART_MIN_CONF=0.35`
  để bớt khung nhiễu tin cậy thấp. Khung "GIÀY" bịa vị trí (khi model không thấy gì) đã bị xoá —
  giờ chỉ hiện khung THẬT, không có thì thôi.
- `required_ppe` **ĐÃ bật** `gloves`/`boots` từ 24/08/2026 (truyền từ `yolo_inference.py`),
  kèm model phụ `ppe_gang.pt`/`ppe_boots.pt` và các cơ chế chống báo oan trong `ppe_tracker.py`.
  Mốc đo gần nhất: găng oan 8.7%, giày 6.3% — mục tiêu ≤ 1%.
- `yolo_inference.py`: `PPE_VIOLATION_MAP` đã map sẵn `gloves`→`safety_gloves`,
  `boots`→`safety_footwear` — DB (`ViolationType` enum) đã sẵn sàng nhận 2 loại này.

## Bức tranh tổng thể (để bật enforcement)

```
Train lại model (nhiều epoch/imgsz hơn cho vật nhỏ) → So mAP gloves/boots với model cũ
  → Thay .pt vào repo → Chạy thử, xem log present=[...] có ổn định không
  → Giữ 'gloves','boots' trong required_ppe → Theo dõi tỉ lệ báo vi phạm có hợp lý không
```

## Cách train lại (nhanh nhất — dùng ĐÚNG dataset đã có)
Xem chi tiết đầy đủ ở **[`training/detech_ppe_colab.md`](../training/detech_ppe_colab.md)** —
hướng dẫn Colab từng bước (cần Roboflow API key), đã tinh chỉnh riêng cho vật nhỏ:
`yolov8m` (thay `yolov8s`) + `imgsz 960` (thay 640) — độ phân giải cao hơn giữ đủ chi tiết
bàn tay/bàn chân thay vì bị downsample mất.

Nếu muốn train **local** (máy không GPU, vd Mac M1) thay vì Colab: chậm hơn nhiều
(có thể mất cả ngày thay vì 60-120 phút trên GPU T4) — chỉ nên dùng để test nhanh với
cấu hình nhẹ hơn (`yolov8s`, `imgsz 640`, ít epoch hơn) trước khi đầu tư train nặng.

## Muốn thêm HẲN lớp mới (kính, khẩu trang, dây an toàn...)
Phần dưới đây vẫn áp dụng nếu cần lớp **chưa có trong model hiện tại** (model hiện đã có
sẵn `goggles`/`no_goggle` — chỉ chưa được bật trong `required_ppe`, xem 06).

## Bước 1 — Xác định danh sách lớp (class)
Model hiện tại đã có 11 lớp — chỉ cần mở rộng nếu muốn thêm lớp THỰC SỰ mới (vd khẩu trang,
dây an toàn) chưa từng có trong dataset `detech-ppe-7qydu`.

## Bước 2 — Thu thập dữ liệu ảnh
- **Nguồn tốt nhất:** trích khung hình từ **chính camera công trường thật** của dự án (đa dạng góc, ánh sáng, khoảng cách).
- Bổ sung: dataset PPE công khai (Roboflow Universe có nhiều bộ "construction PPE", một số đã có nhãn gloves).
- Số lượng: tối thiểu **vài trăm → vài nghìn ảnh/lớp** để model đủ tốt. Găng tay khó (vật nhỏ) → cần nhiều ảnh cận cảnh.

## Bước 3 — Gán nhãn (annotation)
- Công cụ: **Roboflow** (dễ, có sẵn), **CVAT**, hoặc **LabelImg**.
- Vẽ bounding box + gán đúng lớp cho từng vật.
- Xuất định dạng **YOLO** (mỗi ảnh 1 file `.txt`).

## Bước 4 — Train (dùng Ultralytics YOLOv8)
Trong `.venv` đã có `ultralytics`. Ví dụ:
```bash
yolo detect train \
  model=yolov8s.pt \
  data=path/to/data.yaml \
  epochs=100 imgsz=640 batch=16
```
- Nên train trên **máy có GPU** (Mac M1 chạy được nhưng chậm). Có thể dùng **Google Colab (GPU free)**.
- Kết quả model tốt nhất: `runs/detect/train/weights/best.pt`.

## Bước 5 — Thay model vào hệ thống
1. Copy `best.pt` → đổi tên, đặt vào thư mục gốc repo.
2. Sửa `yolo_inference.py`: `MODEL_PATH = "ten_model_moi.pt"`.
3. Cập nhật `ppe_tracker.py`: ánh xạ lớp mới → nhãn hiển thị + cờ `isViolation` (vd `no_gloves` = vi phạm).
4. (Tuỳ chọn) Bổ sung `ViolationType` tương ứng trong `prisma/schema.prisma` + giao diện.

## Bước 6 — Đánh giá & tinh chỉnh
- Xem `mAP`, precision/recall sau train.
- Chạy thử trên video thật, chỉnh `confidence`, thu thập thêm ảnh cho lớp bắt kém, train lại.

## Giảm báo nhầm (không cần train lại — làm ngay được)
- **Nâng `confidence`** trong `yolo_inference.py` (đã nâng 0.5→0.6).
- **Dùng video sát thực tế** (đã đổi sang `viphamlaodong.mp4`).
- **Lọc theo vùng (ROI/Zone):** chỉ xét vi phạm trong khu vực làm việc, bỏ người đi đường phía nền — cần thêm logic vùng trong `ppe_tracker.py` (việc code, làm được sau).

---
🏠 Về [Trang chủ wiki](README.md) · Liên quan: [Tích hợp YOLO](06-tich-hop-yolo.md)
