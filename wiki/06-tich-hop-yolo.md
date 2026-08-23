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
| `yolo_inference.py` | Chạy vòng lặp đọc từng luồng, gọi tracker, gửi detection + ghi Violation vào DB |
| `ppe_tracker.py` | Logic phân tích 1 frame + xác định vi phạm (`PPEViolationTracker`) |
| `yolo_bridge.js` | Bridge Node.js: nhận HTTP → broadcast Socket.IO |
| `src/hooks/useYolo.ts` | Hook WebSocket phía frontend |
| `ppe_multiclass.pt` | Model YOLOv8 ĐANG DÙNG — 11 lớp: Person + helmet/vest/gloves/boots/goggles + no_helmet/no_boots/no_gloves/no_goggle (KHÔNG có `no_vest`, xem ghi chú bên dưới) |
| `mock_yolo.js` | Giả lập detection để test frontend khi không chạy Python (không được gọi trong `npm run dev` mặc định) |
| `roboflow_workflow.py` | Gọi Roboflow Workflow trên **ảnh tĩnh** để đối chiếu với model local (xem mục bên dưới) |
| `env_local.py` | Đọc `.env.local` dùng chung cho các script Python trong `ai-engine/` |
| `src/app/api/roboflow/route.ts` | Route gọi Roboflow phía server — giữ API key khỏi lộ ra trình duyệt, bắt buộc đăng nhập |
| `src/app/(dashboard)/roboflow/page.tsx` | Trang `/roboflow`: kéo thả ảnh → xem khung detection của model cloud |
| `public/videos/` | Video đầu vào mẫu |
| `public/snapshots/` | Ảnh chụp vi phạm (tự sinh, tự xoá khi tắt dự án) |

## Các lớp phát hiện (model `ppe_multiclass.pt` hiện tại)

| Lớp | Ý nghĩa | Có bắt buộc (báo vi phạm)? |
|---|---|---|
| `helmet` / `no_helmet` | Mũ bảo hộ trên đầu | ✅ Bắt buộc — thiếu → VIOLATION |
| `vest` | Áo phản quang | ✅ Bắt buộc — nhưng model **không có lớp `no_vest`**, nên "thiếu áo" chỉ suy luận gián tiếp (model không thấy `vest` trong khung người → coi là thiếu). Dễ báo sai khi áo bị che/góc xấu. |
| `gloves` / `no_gloves` | Găng tay | ⚠️ CÓ phát hiện (khung riêng, đủ tin cậy ≥ `PART_MIN_CONF`=0.35), nhưng **CHƯA bắt buộc** trong `required_ppe` — chỉ hiển thị, không tính vi phạm/ghi DB |
| `boots` / `no_boots` | Giày bảo hộ | ⚠️ Như gloves — có khung hiển thị, chưa bắt buộc |
| `goggles` / `no_goggle` | Kính bảo hộ | Có lớp trong model nhưng **chưa được xử lý** trong `ppe_tracker.py` (không có `PPE_VN['goggles']`... thực ra có, nhưng không nằm trong `required_ppe` mặc định) |

**Vì sao gloves/boots chưa bắt buộc:** test thực tế bằng camera cho thấy model **recall thấp** với 2 lớp này (hiếm khi nhận dương tính dù người có mang) — bật `required_ppe` bao gồm chúng khiến gần như mọi người bị báo vi phạm liên tục dù đang mang đủ đồ. Cần train lại model tốt hơn (xem `training/detech_ppe_colab.md`) trước khi bật.

`PPE_VIOLATION_MAP` trong `yolo_inference.py` đã map sẵn `gloves`→`safety_gloves`, `boots`→`safety_footwear` (enum DB đã có) — chỉ cần đổi `required_ppe` trong `ppe_tracker.py:__init__` khi model đủ tốt.

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
