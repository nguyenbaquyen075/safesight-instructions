# 07 — Lộ trình phát triển

Cập nhật 2026-09-07 theo hiện trạng code (thay cho bảng cũ trong `SPEC.md`, nay đã gộp vào `docs/ba/`).

## ✅ Đã xong (không còn trong lộ trình)

- Nối DB thật: toàn bộ API route dùng Prisma + SQLite dev, seed camera/site.
- NextAuth v5 Credentials + phân quyền theo trang (`PAGE_ROLES`) và theo site (`assertSiteAccess`).
- Pipeline AI: model 11 lớp + model phụ găng/giày + pose, chốt vi phạm theo thời gian, snapshot, ghi DB, báo lại theo `occurrenceCount`.
- Cảnh báo Telegram theo `AlertRule` (threshold, cooldown), cấu hình qua Settings.
- Quản lý camera thật (webcam/RTSP) và gắn video mẫu qua giao diện.
- Cảnh báo bằng giọng nói: mic trên `/cameras` → `/site-speaker`.
- Trang `/roboflow` đối chiếu model cloud trên ảnh tĩnh.
- Agent giám sát tự động (`agent/`, tiến trình thứ 4): trực vận hành (sweep 5 phát hiện + tự khắc phục) + cán bộ an toàn (review vi phạm bằng bằng chứng/band, leo thang Telegram, digest, báo cáo ca) + trợ lý hỏi đáp (trang `/agent`, tab Agent trong modal vi phạm/camera/site). Xem [Agent giám sát tự động](09-agent.md).
- Subagent theo camera (v0.8.0): `CameraAgent` bật/tắt, trí nhớ, trần token riêng, digest định kỳ; lane nghiên cứu song song; skill chuẩn `SKILL.md`.
- Đợt review và fix v0.7.0: lane nghiên cứu tương thích OpenAI, SQLite WAL, API đọc có đăng nhập và scope site, Docker bind mount, bridge secret, kiểm danh tính pid, badge Sidebar từ DB, dependency vá.

## 🎯 Ưu tiên 1 — Chất lượng nhận diện

1. Kéo **báo oan** găng/giày về ≤ 1% theo `eval_ppe_decision.py` (mốc gần nhất ghi trong `yolo_inference.py`: găng 8.7%, giày 6.3%) — train lại theo [`training/detech_ppe_colab.md`](../training/detech_ppe_colab.md).
2. Lọc theo vùng (ROI/Zone) để bỏ người đi đường phía nền — model `Zone` đã có, chưa nối vào `ppe_tracker.py`.
3. Dọn bộ nhớ tracker khi chạy 24/7 (các ghi chú `ponytail:` trong `yolo_inference.py`, `ppe_tracker.py`).

## 🎯 Ưu tiên 2 — Hoàn thiện sản phẩm

4. Trang `/reports` (xuất CSV/PDF) và `/profile`.
5. KPI camera online và roster site đang lấy từ `src/data/mock-cameras.ts` → chuyển sang bảng `Camera` thật.
6. Tỉ lệ tuân thủ đang suy từ số vi phạm (`rateFromCount`) → ghi thêm tổng lượt người quan sát mỗi ngày.
7. Giao diện đọc `AuditLog`.
8. `(dashboard)/cameras/page.tsx` vẫn ghi bản demo bản ghi vi phạm AI vào `localStorage['safesight_alerts']` (song song với ghi DB thật) — dọn nốt để chỉ còn một nguồn dữ liệu (DB), giống badge Sidebar và `/alerts` đã chuyển sang `useViolations()`.

## 🎯 Ưu tiên 3 — Vận hành

9. Xác thực cho YOLO Bridge trước khi mở ra ngoài localhost.
10. Production: PostgreSQL (`@prisma/adapter-pg` đã cài), khôi phục enum/array trong schema, build artifact thay vì `npm run dev`.
11. Kênh cảnh báo khác (SMS/Email/Webhook) — enum đã có, chưa nối.
12. Mở rộng lớp AI: kính (`goggles` đã có trong model, chưa bật), dây an toàn, té ngã, khói/lửa.

## ❓ Câu hỏi mở

- [ ] `DATABASE_URL` production và nơi đặt AI engine (máy GPU tại công trường hay VPS)?
- [ ] Có đưa Roboflow vào luồng video (WebRTC) không, hay giữ model local hoàn toàn?

---
🏠 Về [Trang chủ wiki](README.md)
