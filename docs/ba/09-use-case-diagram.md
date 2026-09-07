# 09 — Sơ đồ use case

Actor tô màu; use case đặt tên **động từ + danh từ**; mỗi biểu đồ ≤ 10 use case cùng cấp. Danh mục quản trị chỉ CRUD gộp vào một biểu đồ.

## UCD-01 Giám sát và xử lý vi phạm

```mermaid
flowchart LR
  classDef actor fill:#2563EB,color:#fff,stroke:#1D4ED8
  classDef sys fill:#16A34A,color:#fff,stroke:#15803D
  SO[Cán bộ an toàn]:::actor
  SV[Giám sát viên]:::actor
  SM[Quản lý công trường]:::actor
  AI[AI Engine]:::sys
  AG[Agent]:::sys
  TG[Telegram]:::sys
  UC1([UC-01 Xem camera trực tiếp])
  UC2([UC-02 Xem vi phạm và bằng chứng])
  UC3([UC-03 Xử lý vi phạm])
  UC4([UC-04 Nhắc nhở qua loa công trường])
  UC5([UC-05 Xác nhận cảnh báo])
  UC6([UC-06 Chốt vi phạm PPE])
  UC7([UC-07 Review vi phạm bằng bằng chứng])
  UC8([UC-08 Gửi cảnh báo Telegram])
  UC9([UC-09 Hỏi agent về vi phạm])
  SO --> UC1 & UC2 & UC3 & UC4 & UC5 & UC9
  SV --> UC1 & UC2 & UC4 & UC5
  SM --> UC2 & UC3 & UC9
  AI --> UC6
  UC6 -. include .-> UC8
  AG --> UC7
  UC7 -. extend: VERIFIED thật .-> UC8
  UC7 -. extend: VERIFIED báo oan .-> UC3
  UC8 --> TG
  UC3 -. include .-> UC2
```

## UCD-02 Cấu hình cảnh báo và giám sát

```mermaid
flowchart LR
  classDef actor fill:#2563EB,color:#fff,stroke:#1D4ED8
  OA[Quản trị tổ chức]:::actor
  SM[Quản lý công trường]:::actor
  UC10([UC-10 Cấu hình bot Telegram])
  UC11([UC-11 Kiểm tra kết nối bot])
  UC12([UC-12 Quản lý quy tắc cảnh báo])
  UC13([UC-13 Thêm camera thật])
  UC14([UC-14 Gán video mẫu cho camera])
  UC15([UC-15 Đối chiếu model bằng Roboflow])
  OA --> UC10 & UC12 & UC13 & UC14 & UC15
  SM --> UC12
  UC10 -. include .-> UC11
```

## UCD-03 Vận hành agent

```mermaid
flowchart LR
  classDef actor fill:#2563EB,color:#fff,stroke:#1D4ED8
  classDef sys fill:#16A34A,color:#fff,stroke:#15803D
  OA[Quản trị tổ chức]:::actor
  SM[Quản lý công trường]:::actor
  AG[Agent]:::sys
  UC16([UC-16 Quét sức khoẻ hệ thống])
  UC17([UC-17 Tự khắc phục sự cố])
  UC18([UC-18 Leo thang sự cố])
  UC19([UC-19 Lập báo cáo ca])
  UC20([UC-20 Bật / tắt và cấu hình agent])
  UC21([UC-21 Xem dòng thời gian agent])
  UC22([UC-22 Hỏi agent toàn hệ thống])
  AG --> UC16 & UC19
  UC16 -. extend: trong giới hạn .-> UC17
  UC16 -. extend: vượt giới hạn .-> UC18
  OA --> UC20 & UC21 & UC22
  SM --> UC21 & UC22
```

## UCD-04 Danh mục quản trị (CRUD)

```mermaid
flowchart LR
  classDef actor fill:#2563EB,color:#fff,stroke:#1D4ED8
  SA[Quản trị hệ thống]:::actor
  OA[Quản trị tổ chức]:::actor
  ALL[Mọi vai trò]:::actor
  UC23([UC-23 Đăng nhập])
  UC24([UC-24 Quản lý công trường])
  UC25([UC-25 Quản lý camera])
  UC26([UC-26 Quản lý người dùng])
  UC27([UC-27 Xem bảng điều khiển và phân tích])
  ALL --> UC23 & UC27
  SA --> UC24 & UC25 & UC26
  OA --> UC24 & UC25 & UC26
```
