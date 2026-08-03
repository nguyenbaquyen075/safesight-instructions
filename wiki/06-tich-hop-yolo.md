# 06 — Tích hợp YOLO

## Pipeline nhận diện PPE

```
Video/Camera
   │
   ▼
yolo_inference.py ── load ppe_v8s_custom.pt ── detect từng frame
   │  (HTTP POST /detections)
   ▼
yolo_bridge.js (port 4000) ── broadcast Socket.IO
   │  (WebSocket)
   ▼
useYolo.ts ── cập nhật state realtime ── UI cảnh báo
```

## Các file liên quan

| File | Vai trò |
|---|---|
| `yolo_inference.py` | Chạy YOLOv8, phát hiện PPE, gửi detection sang Bridge |
| `ppe_tracker.py` | Logic theo dõi & xác định vi phạm (`PPEViolationTracker`) |
| `yolo_bridge.js` | Bridge Node.js: nhận HTTP → broadcast Socket.IO |
| `src/hooks/useYolo.ts` | Hook WebSocket phía frontend |
| `ppe_v8s_custom.pt` | Model YOLOv8 đã train cho PPE (custom) |
| `yolov8n.pt` | Weights YOLOv8 nano (gốc, tham chiếu) |
| `mock_yolo.js` | Giả lập detection để test frontend khi không chạy Python |
| `public/videos/` | Video đầu vào mẫu |
| `public/snapshots/` | Ảnh chụp vi phạm (tự sinh) |

## Các lớp phát hiện

| Lớp | Ý nghĩa | Kết luận |
|---|---|---|
| `helmet` | Có mũ bảo hộ | ✅ SAFE |
| `vest` | Có áo phản quang | ✅ SAFE |
| `no_helmet` | Không mũ bảo hộ | ❌ VIOLATION |
| `no_vest` | Không áo phản quang | ❌ VIOLATION |

Ảnh minh hoạ vi phạm mẫu: `no_helmet.png`, `no_vest.png` (thư mục gốc repo).

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
