# BRD — Tài liệu yêu cầu nghiệp vụ (Business Requirements Document)

> Tuỳ chọn theo chuẩn team; giữ ngắn. Cập nhật 2026-09-07.

## 1. Bối cảnh và vấn đề

Tai nạn lao động trên công trường xây dựng phần lớn liên quan tới việc không mang đủ trang bị bảo hộ (PPE). Giám sát bằng người không bao quát được nhiều camera 24/7, phản ứng chậm, và không có bằng chứng để xử lý sau đó. Camera đã lắp sẵn ở hầu hết công trường nhưng chỉ dùng để xem lại.

## 2. Mục tiêu kinh doanh

| Mục tiêu | Chỉ số | Đích |
|---|---|---|
| Giảm số ca thiếu PPE kéo dài | Vi phạm kéo dài > 5 phút / ngày / công trường | Giảm 50% sau 1 tháng vận hành |
| Phản ứng nhanh | Thời gian từ khi thiếu PPE tới khi được nhắc nhở | ≤ 1 phút |
| Tin cậy được | Tỉ lệ báo oan theo `eval_ppe_decision.py` | ≤ 1% mỗi lớp (P1) |
| Không cần tăng người trực | Số người trực / số camera | 1 người / ≥ 6 camera |
| Có bằng chứng | Vi phạm có ảnh kèm khung | 100% |

## 3. Phạm vi

**Trong phạm vi (v0.6.0):** phát hiện mũ, áo phản quang, găng, giày; dashboard camera trực tiếp; vi phạm kèm bằng chứng; cảnh báo Telegram và loa công trường; quản lý tổ chức / công trường / camera / người dùng; agent trực vận hành và review vi phạm; đóng gói Docker.

**Ngoài phạm vi (giai đoạn sau):** dây an toàn, té ngã, khói lửa, xâm nhập vùng; SMS / Email / Webhook; app di động; báo cáo xuất file; tích hợp còi phần cứng.

## 4. Các bên liên quan

| Bên | Quan tâm |
|---|---|
| Chủ đầu tư / Ban an toàn công ty | Giảm tai nạn, có số liệu tuân thủ để báo cáo |
| Quản lý công trường | Biết ngay vi phạm lặp lại, không bị dội tin |
| Cán bộ an toàn, giám sát viên | Nhìn thấy và nhắc nhở nhanh, ít thao tác |
| Bộ phận kỹ thuật | Lắp camera, cấu hình, vận hành ổn định |
| Công nhân | Được nhắc nhở kịp thời, công bằng (có ảnh) |

## 5. Ràng buộc và giả định

- Video xử lý tại chỗ trên máy có CPU/GPU tại công trường; không đẩy luồng video lên cloud.
- Model YOLO cần file `.pt` do đội AI cung cấp, không có trong mã nguồn.
- Telegram là kênh cảnh báo duy nhất đã nối; cần bot và nhóm Telegram của công trường.
- Agent dùng Claude qua API có trả phí; có trần token ngày và công tắc tắt.

## 6. Tiêu chí thành công của MVP

1. Một công trường thật chạy liên tục 7 ngày với ≥ 4 camera, không mất dữ liệu đêm.
2. Tỉ lệ báo oan ≤ 5% trên dữ liệu thực địa của công trường đó (mục tiêu cuối ≤ 1%).
3. 100% vi phạm có ảnh bằng chứng; Telegram đến trong ≤ 5 giây.
4. Người trực xử lý một vi phạm trong ≤ 1 phút không rời phòng trực (đo bằng UAT theo SC-01).
