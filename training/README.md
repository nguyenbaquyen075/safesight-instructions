# 🧤 Train model PPE nhiều lớp (đầu / áo / tay / chân)

> Mục tiêu: model mới **ghim khung riêng cho từng bộ phận** — đầu (mũ), thân (áo), tay (găng), chân (giày) — thay cho model 4 lớp hiện tại chỉ có mũ + áo.

## Vì sao cần bước này
Model đang chạy (`ppe_v8s_custom.pt`) **chỉ biết 4 lớp** (helmet/vest/no_helmet/no_vest). Không thể vẽ khung "găng tay" hay "chân" nếu model chưa được huấn luyện các lớp đó. → Phải train model mới.

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
3. `ppe_tracker.py`: cập nhật `self.class_names` cho khớp lớp mới, ví dụ:
   ```python
   self.class_names = ['person','helmet','no_helmet','vest','no_vest',
                       'gloves','no_gloves','boots','no_boots']
   ```
   và mở rộng dòng `is_violation = cls_name in ['no_helmet','no_vest','no_gloves','no_boots']`.
4. (Tuỳ chọn) Thêm `ViolationType` cho găng tay/giày trong `prisma/schema.prisma` + giao diện.

### 4. Chạy lại
`npm run dev` → dashboard sẽ ghim khung riêng cho đầu/áo/tay/chân.

## Ghi chú
- Muốn **bắt cả vật ở xa lẫn ở gần**: giảm/nới `min_height_ratio` trong `yolo_inference.py` (đang để 0.05 sau bản này).
- Chất lượng model phụ thuộc **số lượng + độ đa dạng ảnh**. Găng tay/giày là vật nhỏ → cần nhiều ảnh cận cảnh để bắt tốt.
- Liên quan: [../wiki/08-train-model-them-ppe.md](../wiki/08-train-model-them-ppe.md)
