# 07 — Lộ trình phát triển

Cập nhật 2026-09-07 theo hiện trạng code (thay cho bảng cũ trong `SPEC.md`).

## ✅ Đã xong (không còn trong lộ trình)

- Nối DB thật: toàn bộ API route dùng Prisma + SQLite dev, seed camera/site.
- NextAuth v5 Credentials + phân quyền theo trang (`PAGE_ROLES`) và theo site (`assertSiteAccess`).
- Pipeline AI: model 11 lớp + model phụ găng/giày + pose, chốt vi phạm theo thời gian, snapshot, ghi DB, báo lại theo `occurrenceCount`.
- Cảnh báo Telegram theo `AlertRule` (threshold, cooldown), cấu hình qua Settings.
- Quản lý camera thật (webcam/RTSP) và gắn video mẫu qua giao diện.
- Cảnh báo bằng giọng nói: mic trên `/cameras` → `/site-speaker`.
- Trang `/roboflow` đối chiếu model cloud trên ảnh tĩnh.

## 🎯 Ưu tiên 1 — Chất lượng nhận diện

1. Kéo **báo oan** găng/giày về ≤ 1% theo `eval_ppe_decision.py` (mốc gần nhất ghi trong `yolo_inference.py`: găng 8.7%, giày 6.3%) — train lại theo [`training/detech_ppe_colab.md`](../training/detech_ppe_colab.md).
2. Lọc theo vùng (ROI/Zone) để bỏ người đi đường phía nền — model `Zone` đã có, chưa nối vào `ppe_tracker.py`.
3. Dọn bộ nhớ tracker khi chạy 24/7 (các ghi chú `ponytail:` trong `yolo_inference.py`, `ppe_tracker.py`).

## 🎯 Ưu tiên 2 — Hoàn thiện sản phẩm

4. Trang `/reports` (xuất CSV/PDF) và `/profile`.
5. KPI camera online và roster site đang lấy từ `src/data/mock-cameras.ts` → chuyển sang bảng `Camera` thật.
6. Tỉ lệ tuân thủ đang suy từ số vi phạm (`rateFromCount`) → ghi thêm tổng lượt người quan sát mỗi ngày.
7. Giao diện đọc `AuditLog`.

## 🎯 Ưu tiên 3 — Vận hành

8. Xác thực cho YOLO Bridge trước khi mở ra ngoài localhost.
9. Production: PostgreSQL (`@prisma/adapter-pg` đã cài), khôi phục enum/array trong schema, build artifact thay vì `npm run dev`.
10. Kênh cảnh báo khác (SMS/Email/Webhook) — enum đã có, chưa nối.
11. Mở rộng lớp AI: kính (`goggles` đã có trong model, chưa bật), dây an toàn, té ngã, khói/lửa.

## ❓ Câu hỏi mở

- [ ] `DATABASE_URL` production và nơi đặt AI engine (máy GPU tại công trường hay VPS)?
- [ ] Nhánh `feature/frontend-v2` nêu trong `SPEC.md` cũ — còn tồn tại không, merge hay bỏ? Kiểm tra bằng `git branch -a`.
- [ ] Có đưa Roboflow vào luồng video (WebRTC) không, hay giữ model local hoàn toàn?

---
🏠 Về [Trang chủ wiki](README.md)
