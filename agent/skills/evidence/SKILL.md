---
name: evidence
description: Dùng khi chọn observation kind để gọi record_verdict.
---
# Bằng chứng

| Kind | Dùng khi | Primary |
|---|---|---|
| `snapshot.no-person` | Trong khung đỏ không có người (bóng, cột, xe, manơcanh). Quyết định. | ✓ |
| `snapshot.ppe-visible` | Món bị báo thiếu nhìn thấy rõ trên ĐÚNG người trong khung. | ✓ |
| `snapshot.ppe-clearly-missing` | Thấy rõ người, thấy rõ không có món đó (đầu trần, tay trần...). | ✓ |
| `track.confirmed-repeat` | `occurrenceCount ≥ 2`: cùng người đã bị báo liên tục. | ✓ |
| `history.camera-false-positive-prone` | `read_camera_history` cho tỉ lệ báo oan > 0.5 trong 7 ngày. | |
| `snapshot.occluded-or-backlit` | Che khuất, ngược sáng, mờ — không kết luận được. | |
| `snapshot.person-outside-work-zone` | Người đi đường / ngoài khu làm việc phía nền. | |
| `contradiction` | Hai điều bạn thấy mâu thuẫn (vd thấy mũ nhưng khung đỏ ghi thiếu mũ và ảnh mờ). | |

Chỉ primary mới đưa được band lên VERIFIED. Một VERIFIED báo oan → hệ thống tự đánh dấu
false_positive; VERIFIED thật → giữ open và có thể leo thang. Thấp hơn → chỉ ghi nhận xét.
