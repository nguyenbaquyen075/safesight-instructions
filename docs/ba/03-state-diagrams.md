# 03 — Biểu đồ trạng thái

Quy tắc: basic flow chạy dọc giữa, nhánh phụ tách sang bên; cạnh ghi **hành động** gây chuyển trạng thái. Giá trị lưu DB là chữ HOA, API trả chữ thường (`src/types/enums.ts`).

## Vi phạm (Violation) — 4 trạng thái

```mermaid
stateDiagram-v2
    [*] --> open : AI Engine chốt vi phạm
    open --> under_review : Người dùng mở chi tiết
    under_review --> resolved : Đánh dấu đã xử lý
    resolved --> [*]
    open --> resolved : Đánh dấu đã xử lý từ danh sách
    open --> false_positive : Agent VERIFIED báo oan
    open --> false_positive : Người dùng đánh dấu báo oan
    under_review --> false_positive : Người dùng đánh dấu báo oan
    false_positive --> [*]
```

## Cảnh báo (Alert) — 5 trạng thái

```mermaid
stateDiagram-v2
    [*] --> new : Hệ thống sinh cảnh báo từ vi phạm
    new --> acknowledged : Người dùng xác nhận
    acknowledged --> resolved : Vi phạm được xử lý
    resolved --> [*]
    new --> escalated : Vi phạm tái diễn / agent leo thang
    escalated --> resolved : Vi phạm được xử lý
    new --> suppressed : Trong cooldown hoặc quy tắc tắt
    suppressed --> [*]
```

Hiện tại UI chỉ có nút xác nhận (`new → acknowledged`); `escalated` sinh từ Telegram leo thang; `suppressed` dành cho kênh chưa nối.

## Camera — 4 trạng thái

```mermaid
stateDiagram-v2
    [*] --> ONLINE : Quản trị thêm camera
    ONLINE --> DEGRADED : Agent phát hiện camera đứng
    DEGRADED --> OFFLINE : Đứng quá ngưỡng thời gian
    OFFLINE --> ONLINE : Có khung hình trở lại (camera.recovered)
    ONLINE --> MAINTENANCE : Quản trị đặt bảo trì
    MAINTENANCE --> ONLINE : Quản trị bật lại
    DEGRADED --> ONLINE : Có khung hình trở lại
```

AI Engine bỏ qua mọi camera khác `ONLINE`.

## Công trường (Site) — 3 trạng thái

```mermaid
stateDiagram-v2
    [*] --> SETUP : Quản trị tạo công trường
    SETUP --> ACTIVE : Kích hoạt khi đã có camera
    ACTIVE --> INACTIVE : Kết thúc dự án
    INACTIVE --> [*]
    INACTIVE --> ACTIVE : Mở lại
```

Giao diện hiện tại chỉ hiển thị SETUP / ACTIVE; INACTIVE có trong enum, chưa có thao tác trên UI.

## Việc của agent (AgentTask) — trạng thái suy từ trường dữ liệu

`AgentTask` không có cột `status`; trạng thái suy từ `dueAt`, `leasedUntil`, `attempts`, `finishedAt`, `outcome`.

```mermaid
stateDiagram-v2
    [*] --> DaLenLich : scheduleTask / ensureTask
    DaLenLich --> DangChay : claimDue (lease 10 phút)
    DangChay --> HoanTat : completeTask (outcome)
    HoanTat --> [*]
    DangChay --> DaLenLich : releaseTask khi lỗi, attempts + 1
    DaLenLich --> HetLuot : retireExhausted khi attempts ≥ 3
    HetLuot --> [*]
    DangChay --> DaLenLich : Hết lease mà chưa xong (claim lại)
```

## Đối tượng dưới 3 trạng thái (không vẽ)

| Đối tượng | Trạng thái | Lý do bỏ qua |
|---|---|---|
| Quy tắc cảnh báo (AlertRule) | `isActive` true / false | 2 trạng thái |
| Cấu hình Telegram | `isEnabled` true / false | 2 trạng thái |
| Cài đặt agent | `isEnabled` true / false (kill switch) | 2 trạng thái |
| Người dùng | `isActive` true / false | 2 trạng thái |
