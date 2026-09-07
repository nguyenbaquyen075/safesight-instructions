# 08 — Sitemap

Ứng dụng web: menu tối đa cấp 2. Cấp 1 là menu trái (Sidebar), cấp 2 là tab hoặc modal trong trang. Quyền xem theo [05-permission-matrix.md](05-permission-matrix.md).

```mermaid
flowchart LR
  L[Đăng nhập /login] --> D[Bảng điều khiển /]
  D --> S[Công trường /sites]
  S --> S1[Chi tiết công trường · tab Agent]
  S --> S2[Thêm công trường]
  D --> C[Camera /cameras]
  C --> C1[Sự kiện trực tiếp · tab Agent]
  D --> SP[Loa công trường /site-speaker]
  D --> AL[Thông báo /alerts]
  D --> V[Vi phạm /violations]
  V --> V1[Chi tiết vi phạm · Bằng chứng / Agent]
  D --> AN[Phân tích /analytics]
  D --> AG[Agent /agent]
  D --> RF[Kiểm thử Roboflow /roboflow]
  D --> U[Người dùng /users]
  U --> U1[Sửa người dùng]
  D --> ST[Cài đặt /settings]
  ST --> ST1[Tài khoản & Tổ chức]
  ST --> ST2[Giám sát · camera, video mẫu]
  ST --> ST3[Giám sát AI]
  ST --> ST4[Thông báo · Telegram, quy tắc cảnh báo]
  ST --> ST5[Bảo mật]
```

| Cấp 1 (Sidebar) | Cấp 2 | Vai trò |
|---|---|---|
| Bảng điều khiển `/` | — | Tất cả |
| Công trường `/sites` | Chi tiết (tab Agent), Thêm | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER |
| Camera `/cameras` | Sự kiện trực tiếp (tab Agent) | Tất cả |
| Loa công trường `/site-speaker` | — | Tất cả |
| Thông báo `/alerts` | — | Tất cả |
| Vi phạm `/violations` | Chi tiết (Bằng chứng / Agent) | Tất cả |
| Phân tích `/analytics` | — | + SAFETY_OFFICER (không SUPERVISOR) |
| Agent `/agent` | — | SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER |
| Kiểm thử Roboflow `/roboflow` | — | SUPER_ADMIN, ORG_ADMIN |
| Người dùng `/users` | Sửa | SUPER_ADMIN, ORG_ADMIN |
| Cài đặt `/settings` | 5 tab | SUPER_ADMIN, ORG_ADMIN |

Trang chưa có (lộ trình P2): Báo cáo `/reports`, Hồ sơ `/profile`.
