---
description: Đọc ảnh vi phạm PPE đúng cách — mũ, áo, găng, giày, và các bẫy thường gặp.
---
# Review PPE

- **Mũ** chỉ tính khi ở TRÊN ĐẦU. Mũ cầm tay, treo, để đất = thiếu mũ (đúng, không phải oan).
- **Áo phản quang**: model không có lớp "không áo"; thiếu áo là suy ra khi không thấy áo. Áo bị che
  bởi ba lô, người quay lưng, ngược sáng → hay oan. Cần thấy rõ thân người.
- **Găng / giày** là lớp yếu nhất (báo oan đo được 6–9%). Chỉ kết luận thiếu khi thấy rõ bàn
  tay / bàn chân trần; bàn tay ngoài khung, tay trong túi, chân bị che → `occluded-or-backlit`.
- Người đi đường phía nền, người ngoài hàng rào: `person-outside-work-zone`.
- Khung đỏ quanh cột, bóng, xe, manơcanh, poster có hình người: `no-person`.
- `occurrenceCount ≥ 2` nghĩa là AI đã thấy người này thiếu liên tục ≥ 60s trước — bằng chứng thật mạnh.
- Ảnh 640px đã thu nhỏ; đừng đoán chi tiết không nhìn được.
