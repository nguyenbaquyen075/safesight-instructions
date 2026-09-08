# 10 — Lịch sử phát triển

Dòng thời gian các mốc của dự án, gắn với phiên bản (tag `vX.Y.Z`) và [`CHANGELOG.md`](../CHANGELOG.md). Chi tiết từng commit: `git log`; lộ trình phía trước: [07 — Lộ trình phát triển](07-lo-trinh-phat-trien.md).

| Ngày | Phiên bản | Mốc |
|---|---|---|
| 2026-08-03 | v0.1.0 | Khởi tạo: Next.js dashboard, Prisma, AI engine YOLOv8, YOLO Bridge Socket.IO; `GET /api/violations` đọc DB thật, `POST` yêu cầu shared secret |
| 2026-08-05 | v0.2.0 | Cảnh báo giọng nói: mic trên camera đang vi phạm → trang loa công trường; bộ lọc chỉ camera vi phạm |
| 2026-08-10 → 08-11 | v0.3.0 | Thông báo Telegram (token mã hoá AES-256-GCM, quy tắc cảnh báo theo công trường, ngưỡng/cooldown); nhãn tiếng Việt; báo lại vi phạm kéo dài mỗi 60s, đếm số lần tái diễn |
| 2026-08-13 → 08-20 | v0.4.0 | Quản lý camera thật, mọi trang đọc DB; phân quyền trang theo vai trò; client Roboflow đối chiếu ảnh tĩnh và trang `/roboflow`; tài liệu dataset gộp và retrain trên Colab |
| 2026-08-23 → 08-28 | v0.5.0 | Nghiệm thu theo tỉ lệ báo oan/bỏ sót thay mAP; khung thiếu găng/giày theo keypoint cổ tay/cổ chân; model chuyên giày và găng train từ dữ liệu dự án; gán video mẫu qua giao diện; đồng bộ vị trí video; 2.0 → 3.7 fps |
| 2026-09-07 | v0.6.0 | Chuẩn hoá tài liệu/cấu hình/lint, thống nhất npm; **agent giám sát tự động** (`agent/`: trực vận hành 60s, cán bộ an toàn với Claude Tool Runner, hỏi đáp, trang `/agent`); `CHANGELOG`, tag semver, workflow Release; README chuyên nghiệp, logo, sơ đồ kiến trúc SVG; Docker (dashboard + bridge) lên GHCR; CI; landing page GitHub Pages; bộ tài liệu BA `docs/ba/` thay `SPEC.md`, sơ đồ Excalidraw |
| 2026-09-08 | v0.7.0 | Hai đợt review (health, change, security, code-review, ponytail) và 14 nhánh fix: lane nghiên cứu chạy trên endpoint tương thích OpenAI; SQLite WAL + busy_timeout hết `P1008`; API đọc yêu cầu đăng nhập và scope theo công trường; Docker bind mount dùng chung DB/ảnh; bridge yêu cầu secret; kiểm danh tính pid trước SIGTERM; panel hỏi đáp không treo khi hết trần token; badge Sidebar từ DB; nâng dependency (audit 27 → 4) |
| 2026-09-08 | v0.8.0 | **Subagent theo camera**: `CameraAgent` (bật/tắt, trí nhớ, trần token riêng, digest 30 phút), tool `remember_camera`, lane nghiên cứu song song 3 phiên mỗi camera một phiên, API và thẻ subagent trên `/agent`; skill chuyển sang chuẩn `SKILL.md`, skill `remembering-camera-context` |
| 2026-09-08 | v0.9.0 | **Lộ trình 9 tính năng** (issue #3–#19, PR #4–#21 qua nhánh `integration/v0.9`, mỗi tính năng viết bằng subagent theo spec/plan): vùng nhận diện Zone/ROI theo camera; kênh cảnh báo Zalo OA và Webhook (HMAC); tạo người dùng, đổi mật khẩu, nhật ký thao tác; giao diện di động + PWA; trang `/reports` (CSV/in) và báo cáo tuần của agent; tỉ lệ tuân thủ từ số người quan sát được; clip bằng chứng 8s; bản đồ nhiệt thời gian và vị trí; PostgreSQL và nhiều worker agent; đợt fix sau review toàn nhánh (SSRF webhook, phân quyền SUPER_ADMIN, tên clip trùng, bộ nhớ khung đệm) |

## Cách cập nhật

Mỗi lần cắt phiên bản (`chore(release): vX.Y.Z`): thêm một dòng vào bảng trên cùng commit, tóm tắt từ mục tương ứng trong `CHANGELOG.md`.

---
🏠 Về [Trang chủ wiki](README.md)
