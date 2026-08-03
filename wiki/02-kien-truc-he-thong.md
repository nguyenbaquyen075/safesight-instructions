# 02 — Kiến trúc hệ thống

## Tổng quan 3 tầng

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  YOLO Model  │─────▶│  YOLO Bridge │─────▶│   Next.js    │
│  (Python)    │ HTTP │  (Node.js)   │  WS  │  Dashboard   │
│              │      │  Port: 4000  │      │  Port: 3000  │
└──────────────┘      └──────────────┘      └──────────────┘
   nhận diện PPE        trung chuyển           hiển thị &
   từ video/camera      + broadcast            cảnh báo
```

## Vai trò từng thành phần

### 1. YOLO Inference — `yolo_inference.py`
- Chạy model **YOLOv8** (`ppe_v8s_custom.pt`) trên luồng video hoặc camera.
- Phát hiện các lớp PPE, xác định vi phạm.
- Gửi kết quả detection qua **HTTP POST** đến Bridge (`http://localhost:4000/detections`).
- Logic theo dõi vi phạm tách riêng ở `ppe_tracker.py`.

### 2. YOLO Bridge — `yolo_bridge.js`
- Server Node.js trung gian (port **4000**).
- Nhận detection từ Python, **broadcast qua Socket.IO** đến các client frontend đang kết nối.
- Tách Python (AI) khỏi frontend → hai bên chạy/scale độc lập.

### 3. Next.js Dashboard — `src/`
- Giao diện quản trị (port **3000**, App Router).
- Nhận realtime qua WebSocket bằng hook `useYolo` (`src/hooks/useYolo.ts`).
- Hiển thị camera feed, dòng thời gian cảnh báo, KPI, biểu đồ tuân thủ.

## Luồng dữ liệu realtime

```
Camera/Video ──▶ yolo_inference.py ──(HTTP)──▶ yolo_bridge.js ──(Socket.IO)──▶ useYolo ──▶ UI cảnh báo
```

## Ghi chú kiến trúc

- **Vì sao tách Bridge?** Python (AI, có thể chạy trên máy có GPU) và frontend web độc lập nhau; Bridge là điểm nối chuẩn hoá, dễ thay thế nguồn AI về sau (vd đổi sang FastAPI).
- **Điểm chạy nặng** (YOLO inference, training) nên đặt ở **máy có cấu hình mạnh / GPU**; frontend nhẹ, chạy ở đâu cũng được.
- Các script Python phụ trợ: `preview_dataset.py` (xem dataset), `training/` (huấn luyện model).

## Cổng mạng (mặc định)

| Thành phần | Cổng | Giao thức vào |
|---|---|---|
| Next.js Dashboard | 3000 | HTTP / WebSocket |
| YOLO Bridge | 4000 | HTTP (nhận detection) + Socket.IO |
| YOLO Inference | — | không mở cổng, chỉ gửi đi |

---
👉 Tiếp theo: [Cài đặt & vận hành](03-cai-dat-va-van-hanh.md)
