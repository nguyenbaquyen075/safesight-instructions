# 08 — Lộ trình train model thêm loại PPE (găng tay, giày, kính…)

> ⚠️ **Thực tế cần biết:** Model hiện tại `ppe_v8s_custom.pt` chỉ có **4 lớp**: `helmet`, `vest`, `no_helmet`, `no_vest`. Muốn nhận diện **găng tay / giày bảo hộ / kính / khẩu trang** thì **BẮT BUỘC train một model mới** — không sửa code là có được. Đây là công việc dữ liệu + huấn luyện, mất **ngày → tuần** tuỳ dữ liệu, không phải vài phút.

## Bức tranh tổng thể

```
Thu thập ảnh → Gán nhãn (label) → Train YOLOv8 → Xuất .pt mới → Thay model → Cập nhật logic vi phạm
```

## Bước 1 — Xác định danh sách lớp (class)
Ví dụ mở rộng lên 8 lớp:
`helmet, no_helmet, vest, no_vest, gloves, no_gloves, boots, no_boots`
→ Chốt danh sách trước, vì nó quyết định cách gán nhãn.

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
