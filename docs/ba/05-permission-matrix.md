# 05 — Ma trận phân quyền

## Bảng 1 — Danh sách actor

| STT | Actor Name | Mã vai trò | Description |
|---|---|---|---|
| 1 | Quản trị hệ thống | `SUPER_ADMIN` | Toàn quyền mọi tổ chức, cấu hình hệ thống, agent, Roboflow |
| 2 | Quản trị tổ chức | `ORG_ADMIN` | Quản trị một tổ chức: công trường, camera, người dùng, cảnh báo, agent |
| 3 | Quản lý công trường | `SITE_MANAGER` | Điều hành các công trường được gán; xem phân tích và agent |
| 4 | Cán bộ an toàn | `SAFETY_OFFICER` | Xử lý vi phạm, cảnh báo, nhắc nhở qua loa; xem phân tích |
| 5 | Giám sát viên | `SUPERVISOR` | Theo dõi camera, vi phạm, cảnh báo tại hiện trường |
| 6 | AI Engine | hệ thống | Ghi vi phạm qua API bằng `X-AI-Engine-Secret` |
| 7 | Agent giám sát | hệ thống | Đọc dữ liệu, ghi phán quyết, đổi trạng thái, leo thang; bị kill switch và giới hạn tần suất |

## Bảng 2 — Ma trận phân quyền

`O` có quyền · `X` không có quyền · `O*` có quyền với điều kiện (ghi chú dưới bảng)

| Function | Quản trị hệ thống | Quản trị tổ chức | Quản lý công trường | Cán bộ an toàn | Giám sát viên | AI Engine | Agent |
|---|---|---|---|---|---|---|---|
| Đăng nhập / đăng xuất | O | O | O | O | O | X | X |
| Xem bảng điều khiển (KPI) | O | O | O | O | O | X | X |
| Xem danh sách / chi tiết công trường | O | O | O* | X | X | X | O |
| Thêm công trường | O | O | O* | X | X | X | X |
| Xem camera trực tiếp | O | O | O | O | O | X | O |
| Thêm / sửa / xoá camera | O | O | X | X | X | X | O** |
| Gán video mẫu cho camera | O | O | X | X | X | X | X |
| Vẽ / sửa vùng nhận diện của camera | O | O | X | X | X | X | X |
| Nhắc nhở qua loa công trường (mic) | O | O | O | O | O | X | X |
| Nhận và phát audio tại loa | O | O | O | O | O | X | X |
| Tiếp nhận vi phạm từ AI | X | X | X | X | X | O | X |
| Xem danh sách / chi tiết vi phạm | O | O | O | O | O | X | O |
| Cập nhật trạng thái vi phạm | O | O | O | O | O | X | O*** |
| Xoá vi phạm | O | O | O | O | O | X | X |
| Xem cảnh báo, xác nhận cảnh báo | O | O | O | O | O | X | X |
| Gửi cảnh báo Telegram | X | X | X | X | X | O**** | O**** |
| Cấu hình bot Telegram | O | O | X | X | X | X | X |
| Tạo / sửa / xoá / bật tắt quy tắc cảnh báo | O | O | O* | X | X | X | X |
| Xem phân tích | O | O | O | O | X | X | X |
| Xem báo cáo vi phạm, xuất CSV / in PDF | O | O | O | X | X | X | X |
| Xem trang Agent, hỏi đáp toàn hệ thống | O | O | O | X | X | X | X |
| Hỏi agent trong modal vi phạm / camera / công trường | O | O | O | O | O | X | X |
| Bật / tắt agent, chọn model, trần token, giờ báo cáo ca / tuần | O | O | X | X | X | X | X |
| Bật / tắt và cài đặt subagent camera (nhịp tổng hợp, trần token, xoá trí nhớ) | O | O | X | X | X | X | X |
| Tổng hợp ngay theo camera | O | O | O* | X | X | X | X |
| Xem thẻ subagent camera và trí nhớ camera | O | O | O***** | O***** | O***** | X | X |
| Quét sức khoẻ, tự khắc phục, leo thang | X | X | X | X | X | X | O** |
| Kiểm thử Roboflow (tốn credit) | O | O | X | X | X | X | X |
| Xem / sửa / xoá / tạo người dùng | O | O****** | X | X | X | X | X |
| Xem Cài đặt (tài khoản, giám sát, thông báo, nhật ký) | O | O | X | X | X | X | X |
| Xem / sửa hồ sơ cá nhân, đổi mật khẩu | O | O | O | O | O | X | X |

**Ghi chú điều kiện**

- `O*` Quản lý công trường: chỉ trên công trường có trong `assignedSites` (API kiểm bằng `assertSiteAccess`); trang `/sites` mở cho vai trò này nhưng thao tác theo site được gán.
- Ghi quy tắc cảnh báo (`POST /api/alert-rules`, `PATCH`/`DELETE /api/alert-rules/[id]`) kiểm cả vai trò (`ALERT_RULE_WRITE_ROLES` = quản trị hệ thống / tổ chức / quản lý công trường) lẫn phạm vi site; cán bộ an toàn và giám sát viên chỉ đọc.
- Vùng nhận diện: `GET /api/cameras/[id]/zones` mở cho mọi vai trò có quyền xem công trường đó (trình sửa vùng cần đọc), `PUT` chỉ quản trị hệ thống / tổ chức và ghi `AuditLog` `camera.zones.update`.
- `O**` Agent: chỉ đổi trạng thái camera (`ONLINE` / `DEGRADED` / `OFFLINE`) và khởi động lại engine, dọn snapshot trong giới hạn tần suất `LIMITS`; không tạo/xoá camera. Kill switch tắt thì chỉ ghi nhận.
- `O***` Agent: chỉ tự chuyển sang `false_positive` khi band VERIFIED báo oan; các band khác chỉ ghi phán quyết.
- `O****` Gửi Telegram: hệ thống gửi theo quy tắc khi API nhận vi phạm; agent leo thang khi VERIFIED thật và hết cooldown.
- `O******` Quản trị tổ chức chỉ cấp được các vai trò từ quản lý công trường trở xuống; **chỉ quản trị hệ thống mới cấp được vai trò `SUPER_ADMIN`** (`assignableRoles` trong `src/lib/auth/permissions.ts`, áp cho `POST /api/users`, `PATCH /api/users/[id]` và danh sách vai trò trong dialog). Không ai được tự đổi vai trò hoặc tự xoá tài khoản của chính mình.
- `O*****` Xem subagent camera: `GET /api/agent/cameras` chỉ trả camera thuộc `allowedSiteIds` của người dùng. Quản trị hệ thống / tổ chức / quản lý công trường xem lưới thẻ trên `/agent`; cán bộ an toàn và giám sát viên không vào được `/agent` nên chỉ xem qua tab Agent trong modal camera.

**Điểm cần lưu ý cho giai đoạn sau:** API vi phạm/camera/công trường đã yêu cầu đăng nhập và lọc theo `assignedSites`, nhưng ngoài quy tắc cảnh báo và vùng nhận diện thì chưa phân biệt vai trò trong cùng phạm vi site; nếu nghiệp vụ cần hạn chế "Xoá vi phạm" cho quản trị, đưa vào sprint sau (xem [15-implementation-rules.md](15-implementation-rules.md)).
