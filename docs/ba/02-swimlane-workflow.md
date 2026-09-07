# 02 — Swimlane workflow theo đối tượng

Khác BPMN (theo quy trình), mỗi swimlane dưới đây mô tả **các thao tác trên một đối tượng** và trạng thái mà thao tác được phép thực hiện. Hệ thống là một tác nhân có lane riêng.

## Đối tượng: Vi phạm (Violation)

![02-swimlane-violation](diagrams/02-swimlane-violation.png)

<sub>Sơ đồ vẽ bằng Excalidraw.</sub>

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

![02-swimlane-camera](diagrams/02-swimlane-camera.png)

<sub>Sơ đồ vẽ bằng Excalidraw.</sub>

## Đối tượng: Quy tắc cảnh báo (AlertRule)

![02-swimlane-alertrule](diagrams/02-swimlane-alertrule.png)

<sub>Sơ đồ vẽ bằng Excalidraw.</sub>

`*` Quản lý công trường chỉ thao tác trên công trường được gán (`assertSiteAccess`).

## Đối tượng: Câu hỏi cho agent (AgentTask kind=ask)

![02-swimlane-ask](diagrams/02-swimlane-ask.png)

<sub>Sơ đồ vẽ bằng Excalidraw.</sub>
