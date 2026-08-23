# 🚀 Train lại model PPE trên Google Colab

## Mục tiêu — bám đúng chỉ số nghiệm thu

Không phải "tăng mAP". Mục tiêu là kéo **BÁO OAN** (người ĐANG đeo mà hệ thống bảo
thiếu) của găng và giày về **≤ 1%**, đo bằng `ai-engine/eval_ppe_decision.py`.

Mốc hiện tại (`ppe_multiclass.pt`, đo trên 283 ảnh detech valid+test có nhãn đầy đủ):

| | GĂNG | GIÀY |
|---|---|---|
| BÁO OAN | 26/230 = **11.3%** | 17/186 = **9.1%** |
| BỎ LỌT | 1 = 0.4% | 3 = 1.6% |

Báo oan = model **bỏ sót** món đồ có thật ⇒ thứ cần tăng là **recall của
`gloves`/`boots`** ⇒ thứ cần là **nhiều nhãn gloves/boots thật**.

## Dataset — và một cái bẫy phải tránh

| Nguồn | Ảnh | boots | gloves | person/ảnh |
|---|---|---|---|---|
| `aseiro-qlopd/ppe-detection-l0kc1` | 42.989 | 16.538 | 7.413 | **0.96** |
| `les-workspace-puz7q/detech-ppe-7qydu-vnlwm` (gốc dự án) | 1.413 | 1.593 | 1.442 | 1.37 |

**KHÔNG dùng `data_train/merged/`** (bản ghép cũ) và **KHÔNG dùng `data_train/ppes/`**:
ppes có 6.473 ảnh CCTV người/áo/giày hiện rõ mồn một nhưng **chỉ gán nhãn glove/goggles**.
Ảnh thiếu nhãn = hard negative: train vào là dạy model *"chỗ này không có người, không
có giày, không có áo"* → Person/vest/boots **tệ đi**. Đây là lý do bản merged bị loại.

Chỉ số cần soi khi chọn dataset PPE bất kỳ: **số nhãn `person` chia số ảnh**. Gần 1 là
lành; 0.5 trở xuống là gần nửa số ảnh thiếu người → dính đúng cái bẫy trên.

Split `valid`/`test` của detech (142 + 141 ảnh) **tuyệt đối không đưa vào train** — đó là
tập chấm điểm. Version 1 trên Roboflow chia đúng 1130/142/141 y hệt bản local, nên tải
đúng version đó thì split không lệch.

## Chuẩn bị
1. https://colab.research.google.com → **New notebook**
2. **Runtime → Change runtime type → T4 GPU**
3. Kéo thả `training/build_dataset.py` vào khung Files bên trái của Colab.
4. Bỏ API key Roboflow vào **Secrets** (biểu tượng 🔑 bên trái), tên `ROBOFLOW_API_KEY`,
   bật *Notebook access*. **Đừng dán key thẳng vào cell** — notebook hay bị chia sẻ đi.

## Cell 1 — Cài đặt
```python
!pip install -q ultralytics roboflow
from google.colab import userdata
import os
os.environ['ROBOFLOW_API_KEY'] = userdata.get('ROBOFLOW_API_KEY')
```

## Cell 2 — Tải 2 dataset (~15 phút, dataset lớn 43k ảnh)
```python
from roboflow import Roboflow
rf = Roboflow(api_key=os.environ['ROBOFLOW_API_KEY'])

big = rf.workspace("aseiro-qlopd").project("ppe-detection-l0kc1").version(1) \
        .download("yolov8", location="/content/PPE-Detection-1")
det = rf.workspace("les-workspace-puz7q").project("detech-ppe-7qydu-vnlwm").version(1) \
        .download("yolov8", location="/content/Detech-PPE-1")
```

## Cell 3 — Kiểm nhãn TRƯỚC khi train
Đừng bỏ qua cell này. Dataset công khai hay thiếu nhãn ngầm, train xong 4 tiếng mới
phát hiện thì quá muộn.
```python
import glob, os, collections, yaml
for d in ("/content/PPE-Detection-1", "/content/Detech-PPE-1"):
    names = yaml.safe_load(open(f"{d}/data.yaml"))["names"]
    c, n = collections.Counter(), 0
    for f in glob.glob(f"{d}/train/labels/*.txt"):
        n += 1
        for line in open(f):
            if line.strip(): c[names[int(line.split()[0])]] += 1
    per = c.get('person', c.get('Person', 0)) / max(n, 1)
    print(f"{os.path.basename(d)}: {n} ảnh | person/ảnh = {per:.2f}"
          f" {'✅' if per > 0.8 else '⚠️ THIẾU NHÃN NGƯỜI — dừng lại xem kỹ'}")
    print("  ", dict(c.most_common(8)))
```

## Cell 4 — Dựng dataset train
```python
!python /content/build_dataset.py \
    --big /content/PPE-Detection-1 \
    --detech /content/Detech-PPE-1 \
    --out /content/ppe_train_v2 \
    --cap 8000
```
`--cap 8000` là trần số ảnh lấy từ dataset lớn. Ảnh **có găng được giữ hết trước** (găng
hiếm hơn giày: 7.413 vs 16.538 nhãn), phần còn lại mới lấy ảnh chỉ có giày. Tổng
~9.100 ảnh → vừa một phiên Colab free. Máy khoẻ hơn thì nâng cap.

Script chỉ lấy ảnh **có găng hoặc giày** — ảnh chỉ có mũ/áo không giúp gì cho mục tiêu
mà vẫn tốn thời gian train.

## Cell 5 — Train (fine-tune, ~2.5–3.5 tiếng)
```python
from ultralytics import YOLO
# Fine-tune TỪ model đang chạy, không train lại từ đầu: mũ (mAP 0.811) và áo (0.710)
# đang tốt, giữ lấy. Từ đầu thì phải học lại cả hai, tốn thêm hàng chục epoch.
model = YOLO("/content/ppe_multiclass.pt")   # upload file này vào Colab trước
model.train(
    data="/content/ppe_train_v2/data.yaml",
    epochs=40, imgsz=640, batch=16,
    patience=10,          # 10 epoch không khá lên thì dừng, khỏi phí phiên
    project="/content/runs", name="ppe_v2",
)
```
Colab free hay ngắt phiên ~4 tiếng. Nếu đứt: chạy lại cell trên với
`model = YOLO("/content/runs/ppe_v2/weights/last.pt")` và thêm `resume=True`.

## Cell 6 — Tải weights về
```python
from google.colab import files
files.download("/content/runs/ppe_v2/weights/best.pt")
```

## Nghiệm thu — chạy trên máy anh, KHÔNG tin số của Colab
mAP mà Colab in ra là đo trên tập valid của dataset lớn, không phải chỉ số mục tiêu.
Chép `best.pt` vào gốc repo rồi chấm bằng chỉ số thật:

```bash
cp ~/Downloads/best.pt ppe_multiclass_v2.pt
.venv/bin/python - <<'EOF'
import sys; sys.path.insert(0, 'ai-engine')
from eval_ppe_decision import evaluate
for ppe in ('gloves', 'boots'):
    evaluate(ppe, model_path='ppe_multiclass_v2.pt')
EOF
```

**Chỉ khi báo oan ≤ 1%** mới được thêm `'gloves'`/`'boots'` vào `required_ppe`
trong `ai-engine/yolo_inference.py`. Chưa đạt thì để nguyên — model vẫn vẽ khung
găng/giày cho anh nhìn, chỉ là chưa dùng để kết luận vi phạm.

Nhớ chấm cả `helmet` và `vest` trước/sau để chắc chắn train lại **không làm hỏng**
hai lớp đang tốt:
```bash
.venv/bin/python ai-engine/eval_ppe_decision.py helmet vest
```
