# 01 — Sơ đồ BPMN

Ba quy trình nghiệp vụ chính. Lane đặt theo nhóm tham gia; hệ thống (AI Engine, Agent, Telegram) có lane riêng vì tự hành động.

## QT-01 Giám sát và xử lý vi phạm PPE

**Đầu vào:** luồng video camera công trường (webcam / RTSP / video mẫu), danh sách camera `ONLINE`, quy tắc cảnh báo của công trường.
**Đầu ra:** bản ghi Vi phạm kèm ảnh bằng chứng, cảnh báo đã gửi, phán quyết của agent, trạng thái xử lý cuối cùng.

```mermaid
flowchart TB
  subgraph L1[AI Engine]
    A1([Nhận khung hình từ camera]) --> A2[Nhận diện người và PPE]
    A2 --> A3{Thiếu PPE bắt buộc?}
    A3 -- Không --> A1
    A3 -- Có --> A4[Theo dõi liên tục theo track ID]
    A4 --> A5{Thiếu liên tục ≥ 3s và conf ≥ 0.6?}
    A5 -- Không --> A1
    A5 -- Có --> A6[Chụp ảnh bằng chứng]
    A6 --> A7[Ghi vi phạm qua API]
    A7 --> A8[Báo lại mỗi 60s nếu còn vi phạm]
  end
  subgraph L2[Dashboard / API]
    B1[Lưu vi phạm và tăng số lần tái diễn] --> B2[Đối chiếu quy tắc cảnh báo]
    B2 --> B3{Đủ ngưỡng và hết cooldown?}
    B3 -- Có --> B4[Gửi cảnh báo Telegram]
    B3 -- Không --> B5[Chỉ ghi nhận]
    B1 --> B6[Tạo việc review cho agent]
  end
  subgraph L3[Agent cán bộ an toàn]
    C1[Đọc ảnh và lịch sử camera] --> C2[Chấm bằng chứng theo band]
    C2 --> C3{VERIFIED báo oan?}
    C3 -- Có --> C4[Đổi trạng thái sang báo oan]
    C3 -- Không --> C5{VERIFIED thật đủ ngưỡng?}
    C5 -- Có --> C6[Leo thang Telegram]
    C5 -- Không --> C7[Ghi phán quyết, chờ người xử lý]
  end
  subgraph L4[Cán bộ an toàn / Quản lý công trường]
    D1[Xem vi phạm và ảnh bằng chứng] --> D2{Vi phạm thật?}
    D2 -- Có --> D3[Nhắc nhở qua loa công trường]
    D3 --> D4[Đánh dấu đã xử lý]
    D2 -- Không --> D5[Đánh dấu báo oan]
    D4 --> D6([Kết thúc])
    D5 --> D6
  end
  subgraph L5[Công nhân]
    E1[Nhận nhắc nhở qua loa] --> E2[Mang đủ PPE]
  end
  A7 --> B1
  B4 --> D1
  B6 --> C1
  C7 --> D1
  C6 --> D1
  D3 --> E1
```

**Nghiệp vụ cần lưu ý**
- Một người thiếu nhiều món chỉ sinh **một** vi phạm theo món nghiêm trọng nhất: mũ (critical) > áo (high) > găng, giày (medium).
- Vi phạm chỉ chốt khi thấy liên tục ≥ 3s để giảm báo oan; còn kéo dài thì báo lại mỗi 60s kèm ảnh mới và tăng `occurrenceCount`.
- Telegram coi lần đầu là nhắc nhở, leo thang từ lần thứ hai; ngưỡng và cooldown do quy tắc cảnh báo của công trường quyết định.
- Agent chỉ tự đổi trạng thái khi bằng chứng đạt band VERIFIED; band PROBABLE / POSSIBLE để lại cho người quyết định.

## QT-02 Cấu hình cảnh báo cho công trường

**Đầu vào:** bot token Telegram, chat_id người nhận, chính sách cảnh báo của công trường.
**Đầu ra:** bot đã kiểm tra kết nối, quy tắc cảnh báo đang kích hoạt.

```mermaid
flowchart TB
  subgraph L1[Quản trị tổ chức]
    A1([Mở Cài đặt → Thông báo]) --> A2[Dán bot token]
    A2 --> A3[Kiểm tra kết nối]
    A3 --> A4{Token hợp lệ?}
    A4 -- Không --> A2
    A4 -- Có --> A5[Bật cảnh báo Telegram]
    A5 --> A6[Tạo quy tắc cảnh báo]
    A6 --> A7[Chọn công trường, loại vi phạm, ngưỡng, cooldown, chat_id]
    A7 --> A8[Kích hoạt quy tắc]
  end
  subgraph L2[Hệ thống]
    B1[Mã hoá token AES-256-GCM và lưu] --> B2[Gọi Telegram getMe]
    B3[Kiểm tra: kênh Telegram phải có ≥ 1 chat_id] --> B4[Lưu quy tắc theo công trường]
  end
  subgraph L3[Telegram]
    C1[Trả thông tin bot]
  end
  A2 --> B1
  A3 --> B2 --> C1 --> A4
  A8 --> B3
  B4 --> A9([Quy tắc có hiệu lực])
```

## QT-03 Agent trực vận hành (tự động, mỗi 60s)

**Đầu vào:** trạng thái camera, heartbeat AI engine, `/health` của bridge, dung lượng thư mục snapshot, file model.
**Đầu ra:** phát hiện sự cố đã ghi audit, hành động khắc phục trong giới hạn tần suất, leo thang khi vượt giới hạn.

```mermaid
flowchart TB
  subgraph L1[Agent trực vận hành]
    A1([Đến kỳ quét 60s]) --> A2{Kill switch bật?}
    A2 -- Tắt --> A3[Chỉ ghi nhận sức khoẻ, không hành động]
    A2 -- Bật --> A4[Thu thập tín hiệu]
    A4 --> A5{Có phát hiện?}
    A5 -- Không --> A9([Lên lịch quét tiếp])
    A5 -- Có --> A6{Trong giới hạn tần suất?}
    A6 -- Có --> A7[Tự khắc phục: đổi trạng thái camera, khởi động lại engine, dọn snapshot]
    A6 -- Không --> A8[Tạo việc leo thang cho lane nghiên cứu]
    A7 --> A9
    A8 --> A9
  end
  subgraph L2[Quản lý công trường]
    B1[Xem dòng thời gian trên trang Agent] --> B2[Can thiệp thủ công nếu cần]
  end
  A7 --> B1
  A8 --> B1
```

Phát hiện hiện có: `camera.stalled`, `camera.recovered`, `engine.stalled`, `bridge.down`, `disk.pressure`, `model.missing`.
