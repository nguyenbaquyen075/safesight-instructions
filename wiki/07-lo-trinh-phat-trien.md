# 07 — Lộ trình phát triển

Tổng hợp từ `SPEC.md` mục 10–11, sắp theo ưu tiên.

## 🎯 Ưu tiên 1 — Nối Database thật

1. Chốt provider DB (SQLite dev ↔ PostgreSQL prod — xem [ghi chú lệch cấu hình](04-mo-hinh-du-lieu.md#-lưu-ý-lệch-cấu-hình-db)).
2. Setup DB + chạy Prisma migrations.
3. Thay **mock data → truy vấn Prisma thật** ở toàn bộ 13 API route.
4. Hoàn thiện xác thực **NextAuth v5** (chọn provider: Credentials / Google / GitHub?).

## 🎯 Ưu tiên 2 — Hoàn thiện trang còn thiếu

5. Trang `/reports` — xuất CSV/PDF.
6. Trang `/profile` — hồ sơ người dùng.

## 🎯 Ưu tiên 3 — Nâng cao

7. Review nhánh `feature/frontend-v2` (~51K dòng — có thể là bản hoàn chỉnh hơn) → merge hay bỏ.
8. Backend YOLO inference riêng (FastAPI + GPU).
9. Cảnh báo realtime qua WebSocket/SSE (nối kênh SMS/Email/Webhook đã khai báo).
10. RBAC guards + giao diện xem AuditLog.
11. Rà soát responsive cho mobile.

## 🌿 Trạng thái nhánh Git (theo SPEC)

| Branch | Status |
|---|---|
| `main` | ✅ Nhánh chính |
| `develop` | ⚠️ Cần kiểm tra — chưa merge vào main |
| `feat/yolo-integration` | ✅ Đã merge |
| `feature/frontend-v2` | 🔴 Chưa merge — cần review |
| `feature/all-frontend` | ✅ = main |

> ℹ️ Bảng trên là ảnh chụp tại thời điểm viết `SPEC.md` (2026-04-27). Kiểm tra lại bằng `git branch -a` trước khi hành động.

## ❓ Câu hỏi mở (cần chốt)

- [ ] `DATABASE_URL` production thực tế?
- [ ] YOLO inference server đặt ở đâu (local / VPS / GPU server)?
- [ ] `feature/frontend-v2` — merge hay discard?
- [ ] `develop` — có merge vào `main` không?
- [ ] NextAuth dùng provider nào?
- [ ] Ưu tiên tiếp theo: làm BE API thật hay các trang còn thiếu trước?

---
🏠 Về [Trang chủ wiki](README.md)
