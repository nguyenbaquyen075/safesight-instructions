# 06 — Tích hợp YOLO

## Pipeline nhận diện PPE

```
Video/Camera (file demo, webcam, hoặc RTSP)
   │
   ▼
yolo_inference.py ── load ppe_multiclass.pt ── ppe_tracker.py phân tích từng frame
   │  (HTTP POST /detections)
   ▼
yolo_bridge.js (port 4001) ── broadcast Socket.IO theo room từng camera
   │  (WebSocket)
   ▼
useYolo.ts ── cập nhật state realtime ── UI cảnh báo (CameraCard vẽ khung)
```

## Các file liên quan

| File | Vai trò |
|---|---|
| `yolo_inference.py` | Chạy vòng lặp đọc từng luồng, gọi tracker, gửi detection + ghi Violation vào DB, gửi số người quan sát được mỗi phút |
| `ppe_tracker.py` | Logic phân tích 1 frame + xác định vi phạm (`PPEViolationTracker`) |
| `zones.py` | Hình học vùng nhận diện thuần Python (point-in-polygon, điểm chân) — không import torch/cv2 nên test được bằng `python3 -m unittest ai-engine/test_zones.py` |
| `yolo_bridge.js` | Bridge Node.js: nhận HTTP → broadcast Socket.IO |
| `src/hooks/useYolo.ts` | Hook WebSocket phía frontend |
| `ppe_multiclass.pt` | Model YOLOv8 ĐANG DÙNG — 11 lớp: Person + helmet/vest/gloves/boots/goggles + no_helmet/no_boots/no_gloves/no_goggle (KHÔNG có `no_vest`, xem ghi chú bên dưới) |
| `mock_yolo.js` | Giả lập detection để test frontend khi không chạy Python (không được gọi trong `npm run dev` mặc định) |
| `roboflow_workflow.py` | Gọi Roboflow Workflow trên **ảnh tĩnh** để đối chiếu với model local (xem mục bên dưới) |
| `env_local.py` | Đọc `.env.local` dùng chung cho các script Python trong `ai-engine/` |
| `src/app/api/roboflow/route.ts` | Route gọi Roboflow phía server — giữ API key khỏi lộ ra trình duyệt, bắt buộc đăng nhập |
| `src/app/(dashboard)/roboflow/page.tsx` | Trang `/roboflow`: kéo thả ảnh → xem khung detection của model cloud |
| `public/videos/` | Video đầu vào mẫu |
| `public/snapshots/` | Ảnh chụp vi phạm (tự sinh, tự xoá khi tắt dự án) + ảnh xem trước `preview_<cameraId>.jpg` |

## Vùng nhận diện (Zone/ROI) theo camera

Người ở NGOÀI vùng làm việc (khách đi ngang, nhà dân cạnh công trường) không cần bị
soi PPE. Mỗi camera khai được tối đa 10 vùng đa giác; ai có **điểm chân** (giữa cạnh
dưới khung người) nằm ngoài **mọi** vùng thì bị loại TRƯỚC khi xét PPE — không sinh
vi phạm và không tính là người quan sát. Camera không khai vùng nào = xét cả khung.

```
Zone (isActive, type=MONITORING, polygonData = [{x,y}] tỉ lệ 0–1)
   │  yolo_inference.load_zones() — đọc DB chỉ-đọc lúc khởi động và mỗi 60s
   ▼
ppe_tracker.process_frame(frame, zones=[...])
   │  zones.filter_persons_in_zones() — ray casting, bỏ người ngoài vùng
   ▼
phần còn lại của pipeline giữ nguyên (PPE, vi phạm, snapshot)
```

- Vẽ vùng ở **Cài đặt > Giám sát > sửa camera > "Vùng nhận diện"** (`ZoneEditor.tsx`),
  lưu qua `PUT /api/cameras/[id]/zones`. Sửa xong AI áp dụng trong tối đa 60 giây,
  không cần khởi động lại engine.
- Nền của trình vẽ là `public/snapshots/preview_<cameraId>.jpg` — engine ghi lại mỗi
  **30 giây** cho từng camera (JPEG rộng 640px, dùng lại đúng khung vừa đọc, nén/ghi ở
  thread phụ nên không làm chậm vòng lặp). Chưa chạy engine thì chưa có ảnh và trình
  vẽ hiện trạng thái rỗng.
- Một luồng video phục vụ nhiều camera demo: chỉ cần MỘT camera trong nhóm chưa khai
  vùng là cả luồng xét toàn khung (`zones_for_stream`), vì detections được gửi chung.
- `type` `RESTRICTED`/`WARNING` của bảng `Zone` chưa dùng — engine chỉ đọc `MONITORING`.

## Đếm người quan sát được (mẫu số của tỉ lệ tuân thủ)

Chỉ đếm vi phạm thì không biết "nhiều" là bao nhiêu: 5 vi phạm ở công trường 200 người
khác hẳn 5 vi phạm ở tổ 3 người. Engine vì vậy đếm luôn **số người nó thực sự nhìn thấy**
và gửi về dashboard làm mẫu số.

```
process_frame() lọc vùng xong  ->  tracker.last_person_count (số người của khung này)
   │  mỗi khung: person_seconds += số_người × dt   (dt = giờ thật từ khung trước, chặn ≤ 1s)
   ▼
hết một phút đồng hồ (UTC)  ->  gom MỌI luồng thành 1 mảng
   ▼
POST /api/observations  ->  upsert ObservationStat(cameraId, minute, persons, personSeconds)
```

- `last_person_count` là số người **sau khi lọc vùng làm việc**, nên người ngoài vùng
  không làm phồng mẫu số. Để ở thuộc tính của tracker thay vì đổi kiểu trả về của
  `process_frame` → không nơi gọi nào phải sửa.
- `dt` bị chặn ở **1 giây/khung**: một lần khựng dài (nạp model, RTSP reconnect) không
  biến thành hàng chục phút-người ảo.
- POST chạy **1 lần/phút cho toàn bộ luồng**, timeout 2s, lỗi thì bỏ qua phút đó và chỉ
  in cảnh báo một lần cho mỗi HTTP status — vòng lặp nhận diện không bao giờ bị chặn lâu.
  Upsert theo `(cameraId, minute)` nên gửi trùng cũng không nhân đôi.
- Một luồng video phục vụ nhiều camera demo → mỗi camera trong nhóm nhận cùng con số
  (detections vốn tính một lần rồi gửi chung).
- Dashboard đọc lại qua `GET /api/stats/compliance`: `tỉ lệ = 1 − vi_phạm / phút_người`.
  Ngày chưa có dòng `ObservationStat` nào thì API trả `null` và giao diện hiện nhãn
  **"ước tính"** (rơi về cách tính cũ theo số vi phạm) thay vì bịa ra 100%.

## Các lớp phát hiện (model `ppe_multiclass.pt` hiện tại)

| Lớp | Ý nghĩa | Có bắt buộc (báo vi phạm)? |
|---|---|---|
| `helmet` / `no_helmet` | Mũ bảo hộ trên đầu | ✅ Bắt buộc — thiếu → VIOLATION |
| `vest` | Áo phản quang | ✅ Bắt buộc — nhưng model **không có lớp `no_vest`**, nên "thiếu áo" chỉ suy luận gián tiếp (model không thấy `vest` trong khung người → coi là thiếu). Dễ báo sai khi áo bị che/góc xấu. |
| `gloves` / `no_gloves` | Găng tay | ✅ Bắt buộc từ 24/08/2026 — lấy từ model phụ `ppe_gang.pt`, lọc `PART_MIN_CONF['gloves']=0.25`; thiếu → VIOLATION `safety_gloves` |
| `boots` / `no_boots` | Giày bảo hộ | ✅ Bắt buộc từ 24/08/2026 — lấy từ model phụ `ppe_boots.pt`, lọc `PART_MIN_CONF['boots']=0.15`; thiếu → VIOLATION `safety_footwear` |
| `goggles` / `no_goggle` | Kính bảo hộ | Có trong model và `PPE_VN`, nhưng **không** nằm trong `required_ppe` — chỉ hiển thị |

**Găng/giày bắt buộc với cái giá đo được:** `required_ppe=('helmet','vest','gloves','boots')` được truyền từ `yolo_inference.py` (mặc định trong `PPEViolationTracker.__init__` vẫn là mũ + áo). Báo oan đo bằng `eval_ppe_decision.py`: mũ 4.7%, áo 3.1%, găng 8.7%, giày 6.3%. Để kéo găng/giày về ≤ 1% cần train lại (xem [08](08-train-model-them-ppe.md)). Cơ chế chống báo oan: cửa sổ bằng chứng `EVIDENCE_WINDOW=2.5s`, thời gian quan sát `THOI_GIAN_QUAN_SAT=3s` trước khi kết luận thiếu găng/giày, giữ khung `HOLD_SECONDS=2.5s`, và **thấy đồ thắng lớp phủ định**.

**Kiến trúc nhiều model trong một tracker:** người/mũ/áo từ model chính; găng/giày từ model phụ chuyên lớp (`parts_models`), chạy mỗi `PPE_MOI_N_KHUNG=3` khung; `yolov8n-pose.pt` chạy mọi khung để đặt khung tại cổ tay/cổ chân và vùng đầu. Thiếu model phụ hay pose thì lùi về model chính, không dừng hệ thống.

Ảnh minh hoạ vi phạm mẫu: `no_helmet.png`, `no_vest.png` (thư mục gốc repo).

## Đối chiếu bằng Roboflow Workflow (ảnh tĩnh)

`roboflow_workflow.py` gọi workflow **"Detech PPE vdetech-ppe-7qydu-vnlwm-1-yolo26n-t2 Logic"**
trên Roboflow Serverless — hữu ích khi cần so sánh model cloud với `ppe_multiclass.pt` local
trên cùng một khung hình.

Định nghĩa workflow (lấy từ Roboflow API, là **nguồn sự thật**):

| Mục | Giá trị |
|---|---|
| Endpoint | `POST https://serverless.roboflow.com/les-workspace-puz7q/workflows/detech-ppe-vdetech-ppe-7qydu-vnlwm-1-yolo26n-t2-logic` |
| Input | `image` (InferenceImage) — **không có parameter nào khác** |
| Output | `predictions` → `{"image": {width, height}, "predictions": [...]}` |
| Model bên trong | `les-workspace-puz7q/detech-ppe-7qydu-vnlwm-1-yolo26n-t2` |

**Workflow thứ hai** — `PPEs vppes-kaxsi-ea9pf-1-yolo11n-t1 Logic` (key `ppes-kaxsi`) có spec
**giống hệt**, chỉ khác model bên trong (`ppes-kaxsi-ea9pf-1-yolo11n-t1`, train từ dataset
ppes-kaxsi đã gộp vào `data_train/merged`). Vì vậy dùng chung `roboflow_workflow.py` qua tham
số `workflow=` thay vì tách file thứ hai. Hai model **khác từ vựng lớp**: `gloves` (số nhiều)
so với `glove` (số ít).

> [!NOTE]
> Tên workflow có chữ "Logic" nhưng spec **không có block logic nào** — nó chỉ bọc model và
> trả prediction thô. Việc xét đủ/thiếu PPE vẫn nằm ở `ppe_tracker.py`.

```python
from roboflow_workflow import detect_ppe

detect_ppe(frame)      # frame OpenCV, đường dẫn file, bytes, hoặc URL https
# -> [{"class": "Person", "confidence": 0.87, "bbox": {"left": "...%", ...}}, ...]
```

`bbox` được quy về phần trăm giống `_bbox_pct()` nên dùng lại được ngay với dashboard và
`_draw_violation_box()`. Hàm có timeout 30s và thử lại 2 lần (backoff) khi lỗi mạng/429/5xx;
lỗi 4xx (sai `ROBOFLOW_API_KEY`, ảnh hỏng) fail ngay.

Smoke test (gọi mạng thật, tốn 1 credit): `.venv/bin/python ai-engine/test_roboflow_workflow.py`

### Demo đo độ ổn định — `demo_roboflow_stream.py`

Lấy mẫu frame từ nguồn video (file / webcam / RTSP), gửi lên Roboflow theo nhịp rồi báo cáo
tỉ lệ thành công + độ trễ. **Mỗi frame = 1 credit.**

```bash
.venv/bin/python ai-engine/demo_roboflow_stream.py --frames 20
```

Ảnh khoanh khung lưu sẵn vào `public/snapshots/roboflow/`, tên kèm số detection
(`rf_002_2det.jpg`) — **xem tình trạng bằng ảnh, không cần render video**.

**Kết quả đo thực tế** (`samples1.mp4`, 1 luồng, đã bật resize 640):

| Chỉ số | Lần đo 20 frame | Lần đo 8 frame |
|---|---|---|
| Tỉ lệ thành công | **20/20 (100%)** | **8/8 (100%)** |
| Trung vị độ trễ | 2678 ms | 632 ms |
| min · max | 1209 · 7583 ms | 523 · 1812 ms |
| Frame không detect được gì | 10/20 | 4/8 |

Hai điều rút ra:

1. **API ổn định (100% cả 2 lần) nhưng độ trễ dao động mạnh** — trung vị giữa hai lần đo
   chênh hơn 4 lần (632ms ↔ 2678ms) trên cùng một bản code, tuỳ tải serverless và cold start
   (lần gọi đầu luôn chậm nhất trong mỗi lần chạy). Kể cả ở mức tốt nhất ~0.6s/frame thì
   cũng chỉ ~1.6 FPS, và không có gì bảo đảm giữ được mức đó.
   ⇒ Vòng lặp camera trực tiếp **vẫn phải dùng model local** `ppe_multiclass.pt`.
   Gọi Roboflow từng frame vừa không kịp, vừa đốt credit (1 frame = 1 credit).
2. **Chất lượng model cloud còn yếu trên video này:** 50% frame không bắt được gì, và có
   false positive rõ (một chiếc taxi bị nhận là `Person` với conf 0.46) trong khi công nhân
   mặc áo phản quang ngay giữa khung thì bỏ sót. Cần đối chiếu kỹ với model local trước khi
   cân nhắc dùng thay thế.

> [!IMPORTANT]
> Ảnh gửi lên được thu nhỏ cạnh dài về `MAX_IMAGE_SIDE = 640` trước khi encode. Model phía
> Roboflow vốn chạy ở 640 nên gửi ảnh 1920 chỉ tốn băng thông: đo thực tế payload
> **287KB → 61KB**, độ trễ trung vị **8447ms → 1618ms** (nhanh ~5 lần), bbox không đổi vì
> trả theo phần trăm.

> [!NOTE]
> Khi model không detect được gì, Roboflow trả `image: {"width": null, "height": null}` —
> đó là frame trắng **hợp lệ**, không phải lỗi. `_parse_detections()` trả list rỗng cho
> trường hợp này; nếu coi là lỗi thì mọi frame vắng người đều bị tính nhầm thành gọi hụt.

**Muốn chạy PPE trên video qua Roboflow thật sự** thì phải đi đường **WebRTC**, khác hẳn
client REST này — hỏi operator trước khi làm.

## Nghiệm thu khi thay model / đổi ngưỡng

```bash
.venv/bin/python ai-engine/eval_ppe_decision.py [gloves|boots|helmet|vest]   # báo oan / bỏ lọt trên 283 ảnh detech valid+test
.venv/bin/python ai-engine/sweep_threshold.py <model.pt> <lớp> [model_phụ.pt]  # đường cong ngưỡng, so model bằng cả đường cong
```

## Test không cần Python

Khi chỉ phát triển giao diện, có thể dùng `mock_yolo.js` để phát detection giả qua Bridge → khỏi cần cài `ultralytics`/GPU.

## Huấn luyện & dữ liệu

- `training/` — mã/nguồn huấn luyện model.
- `preview_dataset.py` — xem trước dataset.
- `runs/` — kết quả các lần train (output của Ultralytics).
- Tài liệu kỹ thuật thêm: `ppe_detection_system.md` (thư mục gốc).

## Hướng nâng cấp (xem [Lộ trình](07-lo-trinh-phat-trien.md))

- Thay Bridge bằng **backend FastAPI** để chuẩn hoá và mở rộng.
- Mở rộng số lớp phát hiện: dây an toàn, té ngã, khói/lửa, xâm nhập vùng cấm.
- Lưu snapshot vi phạm kèm metadata vào DB thật.

---
👉 Tiếp theo: [Lộ trình phát triển](07-lo-trinh-phat-trien.md)
