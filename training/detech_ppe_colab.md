# 🚀 Train model PPE (Detech PPE + ppes-kaxsi đã ghép) trên Google Colab

Dataset **ĐÃ GHÉP SẴN** ở `data_train/merged/` (script `data_train/merge_datasets.py`):
- Base: **Detech PPE** (dataset gốc đang dùng cho `ppe_multiclass.pt`) — 1413 ảnh.
- Ghép thêm: **ppes-kaxsi** (dataset công khai, 24,924 ảnh gốc) — chỉ lấy ảnh có
  `glove`/`no_glove`/`shoes`/`no_shoes`/`goggles`/`no_goggles`/`helmet`/`no_helmet`,
  remap tên lớp khớp hệ thống hiện tại, bỏ ảnh chỉ có `mask`/`suit` (không dùng).
- **Tổng: 13,059 ảnh**, giữ nguyên **11 lớp** y hệt model đang chạy
  (`Person, boots, gloves, goggles, helmet, no_boots, no_gloves, no_goggle, no_helmet, none, vest`)
  → **không cần sửa `ppe_tracker.py`** sau khi train xong.
- Nhãn tăng mạnh đúng chỗ yếu: **gloves 12,785** nhãn (12,785 = 6105 có + 6680 không),
  **boots 3,069** nhãn — so với vài trăm của dataset gốc.

File zip đã đóng gói: `data_train/merged_ppe_dataset.zip` (~800MB).

## Chuẩn bị
1. Vào https://colab.research.google.com → **New notebook**.
2. **Runtime → Change runtime type → T4 GPU** (để train nhanh, miễn phí).
3. Upload `merged_ppe_dataset.zip` lên **Google Drive** của anh (thư mục gốc My Drive cho
   dễ) — 800MB nên dùng Drive thay vì upload thẳng vào Colab (dễ rớt kết nối giữa chừng).

## Cell 1 — Cài thư viện + mount Drive
```python
!pip install ultralytics -q

from google.colab import drive
drive.mount('/content/drive')
```
Colab sẽ hỏi quyền truy cập Drive — bấm cho phép (đây là Drive của chính anh, an toàn).

## Cell 2 — Copy zip về local rồi giải nén
```python
import shutil
# Copy 1 file lớn về ổ đĩa LOCAL của Colab trước — giải nén thẳng từ Drive hay bị lỗi
# "Transport endpoint is not connected" vì Drive là ổ mạng ảo (FUSE), không chịu được
# việc đọc liên tục 26,000+ file nhỏ khi giải nén 800MB.
shutil.copy('/content/drive/MyDrive/merged_ppe_dataset.zip', '/content/merged_ppe_dataset.zip')
shutil.unpack_archive('/content/merged_ppe_dataset.zip', '/content/dataset')
print("Dataset tại: /content/dataset/merged")
```
Nếu anh để zip ở thư mục khác trong Drive (không phải gốc My Drive), sửa lại đường dẫn nguồn cho khớp.

Nếu vẫn gặp lỗi `Transport endpoint is not connected` ngay ở bước `shutil.copy` (hiếm, do Drive
mount bị rớt) — chạy lại `drive.mount('/content/drive', force_remount=True)` ở Cell 1 rồi thử
lại Cell 2.

## Cell 3 — Train
```python
from ultralytics import YOLO
model = YOLO("yolov8m.pt")   # m thay vì s — thêm sức chứa cho vật nhỏ (găng/giày)
model.train(data="/content/dataset/merged/data.yaml",
            epochs=100, imgsz=960, batch=8, patience=20)
```
⏳ Trên GPU T4 mất khoảng **60–120 phút** (13k ảnh + imgsz/model lớn hơn bản cũ).

### Vì sao đổi tham số so với model hiện tại
`ppe_multiclass.pt` hiện tại train yolov8s/imgsz 640, recall găng/giày rất thấp (test camera
thật: model gần như không nhận ra người đang đeo găng/giày dù có mang). Găng/giày là vật NHỎ
trong khung hình — 2 điều chỉnh dưới đây trực tiếp nhắm vào đó, CỘNG thêm dataset ghép có
nhiều ảnh gloves/boots hơn hẳn:
- **imgsz 640 → 960**: ảnh vào model độ phân giải cao hơn → vật nhỏ (bàn tay, bàn chân) còn
  đủ pixel để model nhận ra, thay vì bị downsample mất chi tiết.
- **yolov8s → yolov8m**: model lớn hơn, đủ sức học đặc trưng nhỏ/tinh tế hơn.
- `batch` giảm 16→8 vì imgsz/model đều tăng, tránh tràn VRAM T4 (16GB).

## Cell 4 — Kiểm tra + tải model về máy
```python
metrics = model.val()
print("mAP50-95 tổng:", metrics.box.map)

# Kiểm tra RIÊNG từng lớp — đặc biệt gloves/boots/no_gloves/no_boots, để biết
# chắc có cải thiện thật trước khi đưa vào production (đừng chỉ tin số tổng).
for i, name in model.names.items():
    print(f"{name:12} mAP50-95: {metrics.box.maps[i]:.3f}")

from google.colab import files
files.download("runs/detect/train/weights/best.pt")
```
So `mAP50-95` của các lớp `gloves`/`no_gloves`/`boots`/`no_boots` với model cũ
(chạy Cell 4 này trên `ppe_multiclass.pt` hiện tại để có baseline so sánh) —
chỉ thay model trong hệ thống nếu các lớp này tăng rõ rệt.

## Sau khi có best.pt
1. Đưa `best.pt` vào gốc repo, đổi tên `ppe_multiclass.pt` (ghi đè file cũ —
   nhớ backup file cũ trước nếu muốn so sánh/rollback).
2. `yolo_inference.py`/`ppe_tracker.py` đọc `model.names` động, KHÔNG cần sửa
   code — dataset ghép giữ nguyên đúng 11 tên lớp cũ.
3. `npm run dev` → xem log `[PERSON] present=... missing=...` — nếu gloves/boots
   giờ được nhận ra đều đặn (present) khi công nhân có mang, mới nên bật bắt
   buộc: đổi `required_ppe = ('helmet', 'vest')` → thêm `'gloves', 'boots'`
   trong `ppe_tracker.py:__init__`. Bật sớm khi model chưa cải thiện thật sẽ
   lặp lại lỗi báo vi phạm oan hàng loạt đã gặp trước đó.

## Nếu muốn ghép lại từ đầu (thêm dataset khác, đổi cách remap...)
Chạy lại `data_train/merge_datasets.py` (cần `detech_ppe/` và `ppes/` đã giải nén sẵn trong
`data_train/` — xem đầu file script để đổi bảng remap lớp nếu dùng dataset khác).
