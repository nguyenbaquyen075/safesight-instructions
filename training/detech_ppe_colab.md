# 🚀 Train model PPE (Detech PPE) trên Google Colab

Dataset: **Detech PPE** — 12 lớp gồm helmet, vest, gloves, boots, goggles, Person + biến thể `no_*`.
workspace = `ppe-detector-tcc` · project = `detech-ppe-7qydu` · version = `1`

## Chuẩn bị
1. Vào https://colab.research.google.com → **New notebook**.
2. **Runtime → Change runtime type → T4 GPU** (để train nhanh, miễn phí).
3. Lấy **API key**: Roboflow → góc phải avatar → **Settings → API Keys** (hoặc Roboflow API) → copy **Private API Key**.

## Cell 1 — Cài thư viện
```python
!pip install ultralytics roboflow -q
```

## Cell 2 — Tải dataset
```python
from roboflow import Roboflow
rf = Roboflow(api_key="DÁN_API_KEY_CỦA_ANH")   # <-- thay bằng key của anh
project = rf.workspace("ppe-detector-tcc").project("detech-ppe-7qydu")
dataset = project.version(1).download("yolov8")
print("Dataset tại:", dataset.location)
```

## Cell 3 — Train
```python
from ultralytics import YOLO
model = YOLO("yolov8s.pt")
model.train(data=f"{dataset.location}/data.yaml",
            epochs=80, imgsz=640, batch=16, patience=15)
```
⏳ Trên GPU T4 mất khoảng **30–90 phút** tuỳ số ảnh.

## Cell 4 — Kiểm tra + tải model về máy
```python
metrics = model.val()
print("mAP50-95:", metrics.box.map)

from google.colab import files
files.download("runs/detect/train/weights/best.pt")
```

## Sau khi có best.pt
1. Đưa `best.pt` vào gốc repo, đổi tên `ppe_multiclass.pt`.
2. Báo trợ lý → sẽ cập nhật `yolo_inference.py` (MODEL_PATH) + `ppe_tracker.py`
   (đọc `model.names` + coi lớp bắt đầu bằng `no_` là vi phạm).
3. `npm run dev` → dashboard ghim khung theo bộ phận + khung xanh khi đủ đồ.
