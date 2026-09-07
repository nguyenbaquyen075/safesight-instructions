# 🧤 Train model PPE nhiều lớp (đầu / áo / tay / chân)

> Mục tiêu: model mới **ghim khung riêng cho từng bộ phận** — đầu (mũ), thân (áo), tay (găng), chân (giày) — thay cho model 4 lớp hiện tại chỉ có mũ + áo.

> ⚠️ **Tài liệu lịch sử.** Model đang chạy là `ppe_multiclass.pt` (11 lớp, đã có găng/giày). Quy trình train lại hiện hành là [`detech_ppe_colab.md`](detech_ppe_colab.md) + `build_dataset.py`. Các bước dưới đây chỉ còn đúng khi cần **thêm lớp hoàn toàn mới**.

## Vì sao cần bước này (bối cảnh cũ)
Model cũ (`ppe_v8s_custom.pt`) chỉ biết 4 lớp (helmet/vest/no_helmet/no_vest) nên phải train model mới có găng/giày — việc này đã xong.

## Các bước

### 1. Lấy dataset đã gán nhãn (nhanh nhất)
- Vào **Roboflow Universe** → tìm "Construction PPE" / "PPE detection gloves boots".
- Chọn bộ có các lớp cần: mũ, áo, **găng tay**, **giày**… (có cả biến thể `no_*` càng tốt).
- **Export** định dạng **YOLOv8** → tải về, giải nén vào thư mục `training/dataset/`.
- Mở file `data.yaml` của dataset, đối chiếu **thứ tự lớp** với `training/data.yaml` ở đây (sửa cho khớp).

### 2. Train (khuyên dùng Google Colab — GPU miễn phí)
```bash
pip install ultralytics
python training/train_ppe.py
```
- Máy Mac M1 chạy được (mps) nhưng chậm; Colab nhanh hơn nhiều.
- Xong: model tốt nhất ở `runs/detect/ppe_multiclass/weights/best.pt`.

### 3. Gắn model mới vào hệ thống
1. Copy `best.pt` → gốc repo, đổi tên (vd `ppe_multiclass.pt`).
2. `yolo_inference.py`: đổi `MODEL_PATH = "ppe_multiclass.pt"`.
3. `ppe_tracker.py` đọc tên lớp thẳng từ model (`self.model.names`) nên không phải sửa danh sách lớp; chỉ thêm tên hiển thị vào `PPE_VN` và (nếu bắt buộc) đưa lớp mới vào `required_ppe` + `PPE_VIOLATION_MAP` trong `yolo_inference.py`.
4. (Tuỳ chọn) Thêm `ViolationType` cho găng tay/giày trong `prisma/schema.prisma` + giao diện.

### 4. Chạy lại
`npm run dev` → dashboard sẽ ghim khung riêng cho đầu/áo/tay/chân.

## Ghi chú
- Muốn **bắt cả vật ở xa lẫn ở gần**: giảm/nới `min_height_ratio` trong `yolo_inference.py` (đang để 0.05 sau bản này).
- Chất lượng model phụ thuộc **số lượng + độ đa dạng ảnh**. Găng tay/giày là vật nhỏ → cần nhiều ảnh cận cảnh để bắt tốt.
- Liên quan: [../wiki/08-train-model-them-ppe.md](../wiki/08-train-model-them-ppe.md)
