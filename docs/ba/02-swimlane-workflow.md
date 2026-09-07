# 02 — Swimlane workflow theo đối tượng

Khác BPMN (theo quy trình), mỗi swimlane dưới đây mô tả **các thao tác trên một đối tượng** và trạng thái mà thao tác được phép thực hiện. Hệ thống là một tác nhân có lane riêng.

## Đối tượng: Vi phạm (Violation)

```mermaid
flowchart LR
  subgraph S[Hệ thống · AI Engine / API]
    s1[Chốt vi phạm] --> s2[(open)]
    s2 --> s3[Báo lại mỗi 60s, tăng số lần]
  end
  subgraph G[Agent cán bộ an toàn]
    g1[Review bằng chứng] --> g2{Band}
    g2 -- VERIFIED báo oan --> g3[(false_positive)]
    g2 -- VERIFIED thật --> g4[Leo thang Telegram]
    g2 -- PROBABLE / POSSIBLE --> g5[Ghi phán quyết, giữ open]
  end
  subgraph U[Cán bộ an toàn / Quản lý]
    u1[Mở chi tiết] --> u2[(under_review)]
    u2 --> u3[Đánh dấu đã xử lý] --> u4[(resolved)]
    u2 --> u5[Đánh dấu báo oan] --> u6[(false_positive)]
    u7[Xoá vi phạm]
  end
  s2 --> g1
  s2 --> u1
  s2 -- từ danh sách --> u3
```

| Thao tác | Tác nhân | Trạng thái cho phép |
|---|---|---|
| Chốt vi phạm | AI Engine | — (tạo mới `open`) |
| Báo lại / tăng số lần | AI Engine | `open` |
| Review, ghi phán quyết | Agent | `open`, `under_review` |
| Tự đổi sang báo oan | Agent | `open` (chỉ khi VERIFIED) |
| Mở chi tiết (chuyển `under_review`) | Mọi vai trò đăng nhập | `open` |
| Đánh dấu đã xử lý | Mọi vai trò đăng nhập | `open`, `under_review` |
| Đánh dấu báo oan | Mọi vai trò đăng nhập | `open`, `under_review` |
| Xoá vi phạm | Mọi vai trò đăng nhập | mọi trạng thái (không hoàn tác) |
| Hỏi agent về vi phạm | Mọi vai trò đăng nhập | mọi trạng thái |

## Đối tượng: Camera

```mermaid
flowchart LR
  subgraph A[Quản trị tổ chức]
    a1[Thêm camera thật] --> a2[(ONLINE)]
    a2 --> a3[Sửa nguồn video / vị trí]
    a2 --> a4[Đặt bảo trì] --> a5[(MAINTENANCE)]
    a5 --> a6[Bật lại] --> a2
    a7[Xoá camera]
    a8[Gán video mẫu] --> a2
  end
  subgraph S[Hệ thống · AI Engine]
    s1[Mở luồng theo nguồn] --> s2[Phát detection theo room camera]
  end
  subgraph G[Agent trực vận hành]
    g1[Phát hiện camera đứng] --> g2[(DEGRADED)]
    g2 --> g3[Đứng quá lâu] --> g4[(OFFLINE)]
    g4 --> g5[Có khung hình lại] --> g6[(ONLINE)]
    g7[Thăm dò theo yêu cầu]
  end
  a2 --> s1
  s2 --> g1
  a3 --> g7
```

## Đối tượng: Quy tắc cảnh báo (AlertRule)

```mermaid
flowchart LR
  subgraph A[Quản trị tổ chức / Quản lý công trường*]
    a1[Tạo quy tắc] --> a2[(isActive = true)]
    a2 --> a3[Sửa ngưỡng, cooldown, người nhận]
    a2 --> a4[Tắt quy tắc] --> a5[(isActive = false)]
    a5 --> a6[Bật lại] --> a2
    a7[Xoá quy tắc]
  end
  subgraph S[Hệ thống]
    s1[Kiểm tra: Telegram cần ≥ 1 chat_id] --> s2[Lưu theo công trường]
    s3[Khớp vi phạm mới với quy tắc đang bật] --> s4[Gửi / bỏ qua theo ngưỡng và cooldown]
  end
  a1 --> s1
  a2 --> s3
```

`*` Quản lý công trường chỉ thao tác trên công trường được gán (`assertSiteAccess`).

## Đối tượng: Câu hỏi cho agent (AgentTask kind=ask)

```mermaid
flowchart LR
  subgraph U[Người dùng đăng nhập]
    u1[Gửi câu hỏi] --> u2[Theo dõi trả lời trong 90s]
    u2 --> u3[Hỏi tiếp cùng phiên]
  end
  subgraph S[Hệ thống · API]
    s1[Ghi message.user] --> s2[Tạo hoặc nối AgentTask ask] --> s3[Đánh thức agent]
  end
  subgraph G[Agent lane nghiên cứu]
    g1[Nhận việc, gọi tool đọc dữ liệu] --> g2[Trả lời message.assistant] --> g3[Kết thúc phiên]
  end
  u1 --> s1
  s3 --> g1
  g2 --> u2
```
