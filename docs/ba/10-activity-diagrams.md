# 10 — Sơ đồ luồng chức năng (activity)

Chọn từ biểu đồ use case những nghiệp vụ có luồng xử lý. Mỗi sơ đồ có điểm bắt đầu (hoạt động kích hoạt) và điểm kết thúc (xử lý thành công).

## ACT-01 Chốt vi phạm PPE (UC-06)

```mermaid
flowchart TD
  S([Khung hình mới]) --> A[Nhận diện người + PPE bằng model chính]
  A --> B[Model phụ găng / giày, pose keypoints]
  B --> C{Người thiếu món bắt buộc?}
  C -- Không --> R[Xoá bộ nhớ vi phạm của người đó] --> E([Kết thúc])
  C -- Có --> D[Ghi nhớ theo track ID, thời điểm bắt đầu thiếu]
  D --> F{conf ≥ 0.6 và thiếu ≥ 3s?}
  F -- Chưa --> E
  F -- Rồi --> G{Đã chốt cho người này?}
  G -- Chưa --> H[Chọn món nặng nhất: mũ > áo > găng, giày]
  H --> I[Chụp ảnh, vẽ khung tại đầu / cổ tay / cổ chân]
  I --> J[POST /api/violations kèm X-AI-Engine-Secret]
  J --> K{API 201?}
  K -- Có --> L[Ghi thời điểm báo, occurrence = 1] --> E
  K -- Không --> M[Log lỗi, thử lại ở khung sau] --> E
  G -- Rồi --> N{Đã 60s từ lần báo trước?}
  N -- Chưa --> E
  N -- Rồi --> O[Chụp ảnh mới, occurrence + 1] --> J
```

## ACT-02 Xử lý vi phạm (UC-03)

```mermaid
flowchart TD
  S([Cán bộ an toàn mở danh sách vi phạm]) --> A[Chọn vi phạm]
  A --> B[Hệ thống chuyển open → under_review, mở modal]
  B --> C[Xem ảnh bằng chứng, band và quan sát của agent]
  C --> D{Vi phạm thật?}
  D -- Không --> F[Đổi trạng thái sang false_positive] --> E([Kết thúc])
  D -- Có --> G{Người còn trong khung?}
  G -- Có --> H[Giữ mic, nhắc nhở qua loa công trường]
  H --> I[Đổi trạng thái sang resolved] --> E
  G -- Không --> I
```

## ACT-03 Review vi phạm bằng agent (UC-07)

```mermaid
flowchart TD
  S([API ghi vi phạm mới]) --> A[Tạo AgentTask violation.review, đánh thức agent]
  A --> B{Kill switch bật và có ANTHROPIC_API_KEY?}
  B -- Không --> Z[Ghi sự kiện bỏ qua] --> E([Kết thúc])
  B -- Có --> C[Claim task, mở phiên Tool Runner]
  C --> D[read_violation: ảnh + bbox]
  D --> F[read_camera_history, read_site_context]
  F --> G[Chấm quan sát → điểm → band]
  G --> H{Band}
  H -- VERIFIED báo oan --> I[record_verdict + đổi false_positive]
  H -- VERIFIED thật --> J[record_verdict] --> K{Đủ ngưỡng, hết cooldown?}
  K -- Có --> L[escalate qua Telegram]
  K -- Không --> M[Ghi chú chờ người xử lý]
  H -- PROBABLE / POSSIBLE --> N[record_verdict, để người quyết định]
  I --> P[Ghi AgentEvent, completeTask]
  L --> P
  M --> P
  N --> P
  P --> E
  C -.->|Lỗi API / hết token| Q[releaseTask, attempts + 1, hoàn ngân sách] --> E
```

## ACT-04 Gửi cảnh báo Telegram theo quy tắc (UC-08)

```mermaid
flowchart TD
  S([Vi phạm mới được lưu]) --> A[Lấy quy tắc đang bật của công trường]
  A --> B{Có quy tắc khớp loại vi phạm?}
  B -- Không --> E([Kết thúc])
  B -- Có --> C{Số vi phạm trong cửa sổ ≥ ngưỡng?}
  C -- Chưa --> E
  C -- Đủ --> D{Lần gửi thành công gần nhất cách ≥ cooldown?}
  D -- Chưa --> F[Ghi Alert suppressed] --> E
  D -- Rồi --> G{occurrenceCount = 1?}
  G -- Có --> H[Gửi tin nhắc nhở kèm ảnh]
  G -- Không --> I[Gửi tin leo thang kèm ảnh]
  H --> J{Gửi thành công?}
  I --> J
  J -- Có --> K[Ghi Alert new, errorMessage = null] --> E
  J -- Không --> L[Ghi Alert kèm errorMessage] --> E
```

## ACT-05 Nhắc nhở qua loa công trường (UC-04)

```mermaid
flowchart TD
  S([Ô camera đang vi phạm]) --> A[Giữ nút mic]
  A --> B[Trình duyệt ghi âm MediaRecorder]
  B --> C{Thả nút hoặc 30s?}
  C --> D[Gửi audio qua Socket.IO tới room camera]
  D --> E{Trang loa của camera đang mở?}
  E -- Không --> F[Báo lỗi phát trên nút mic] --> Z([Kết thúc])
  E -- Có --> G[Loa phát audio]
  G --> H{Phát thành công?}
  H -- Có --> I[Đánh dấu đã phát] --> Z
  H -- Không --> F
```
