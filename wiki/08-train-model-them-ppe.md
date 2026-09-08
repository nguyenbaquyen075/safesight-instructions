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

## Xuất phản hồi agent làm dataset

Từ v0.11, mỗi phán quyết của agent đều được người xác nhận đúng/sai ngay trong tab **Agent**
của modal vi phạm (lưu ở `Violation.reviewFeedback`). Đây là **nhãn thật do người công trường
gán trên chính ảnh của mình** — nguồn dữ liệu tốt nhất để train lại, không phải đi tìm dataset công khai.

**Cách lấy:** trang `/reports` → chọn công trường + khoảng ngày → nút **"Xuất phản hồi agent (CSV)"**
(gọi `GET /api/reports/agent-feedback?siteId&from&to`, file UTF-8 có BOM, mở thẳng bằng Excel).

Các cột trong file:

| Cột | Ý nghĩa |
|---|---|
| `violationId` | Id vi phạm — khoá để đối chiếu ngược với DB |
| `cameraId` | Camera phát hiện — lọc theo camera hay bị oan |
| `type` | Loại vi phạm (`hard_hat`, `safety_gloves`, ...) = lớp cần tăng nhãn |
| `detectedAt` | Thời điểm phát hiện (ISO) — dùng để chia train/val theo thời gian |
| `snapshotUrl` | Đường dẫn ảnh chốt trong `public/` — **ảnh để gán nhãn lại** |
| `clipUrl` | Clip bằng chứng ~8s nếu engine có ghi (rỗng nếu không) |
| `agentVerdict` | Phán quyết agent: `violation` / `false_positive` / `undecided` |
| `band` | Mức chắc chắn của agent: `VERIFIED` / `PROBABLE` / `POSSIBLE` |
| `humanCorrect` | `true` = agent đúng, `false` = người bảo agent SAI |
| `note` | Ghi chú của người ("người có mũ, bị cột che") — lý do sai |

File chỉ chứa tối đa **20.000 dòng mới nhất**. Chạm trần thì tên file có đuôi `-partial` và
phản hồi trả kèm header `X-Truncated: true` — nghĩa là các phản hồi CŨ NHẤT trong khoảng đã
chọn bị cắt; xuất lại theo từng khoảng ngày hẹp hơn nếu cần đủ.

**Nạp vào `training/`:**
1. Lọc các dòng `humanCorrect = false`: đó là những ảnh model/agent đang đọc sai — nhóm theo `type`
   để biết lớp nào yếu (thường vẫn là `safety_gloves` / `safety_footwear`).
2. Copy các ảnh theo `snapshotUrl` (nằm trong `public/snapshots/`) sang thư mục ảnh thô của dataset.
3. Gán nhãn lại bằng Roboflow/CVAT theo đúng bộ lớp ở [Bước 1](#bước-1--xác-định-danh-sách-lớp-class),
   xuất định dạng YOLO.
4. Trộn vào dataset hiện có bằng `training/build_dataset.py` rồi train theo
   [Bước 4](#bước-4--train-dùng-ultralytics-yolov8).
5. Nghiệm thu bằng `ai-engine/eval_ppe_decision.py` như mọi lần train lại.

Thẻ **"Độ chính xác của agent"** ở trang `/agent` (7/30 ngày, `GET /api/stats/agent-accuracy`)
cho biết nên xuất khoảng nào: camera hoặc loại vi phạm có tỉ lệ sai cao chính là chỗ thiếu dữ liệu.

## Giảm báo nhầm (không cần train lại — làm ngay được)
- **Nâng `confidence`** trong `yolo_inference.py` (đã nâng 0.5→0.6).
- **Dùng video sát thực tế** (đã đổi sang `viphamlaodong.mp4`).
- **Lọc theo vùng (ROI/Zone):** chỉ xét vi phạm trong khu vực làm việc, bỏ người đi đường phía nền — cần thêm logic vùng trong `ppe_tracker.py` (việc code, làm được sau).

---
🏠 Về [Trang chủ wiki](README.md) · Liên quan: [Tích hợp YOLO](06-tich-hop-yolo.md)
