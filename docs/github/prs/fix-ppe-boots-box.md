## Tóm tắt
- Khung **GIÀY ôm đúng chiếc giày** thay vì nằm trên ống chân, và **không còn hai ô chồng nhau trên một chân**.
- Chỉ đổi toạ độ vẽ; quyết định đủ/thiếu giày và mọi kết quả khác không đổi.

## Issue
Closes #<n>

## Thay đổi chính
- `ai-engine/ppe_tracker.py`:
  - `CHAN_MAU` (dịch dọc/ngang cẳng chân, rộng, cao — đơn vị chiều dài cẳng chân, trung vị 259 bàn chân của 3 video mẫu) và `CHAN_XUONG` (dịch xuống thêm, chọn bằng mắt trên ảnh thật vì ô giày của model hay bao cả mắt cá).
  - `_chan()`: khung neo vào cổ chân hiện tại; ô giày tươi của model phụ gần cổ chân dạy độ lệch/cỡ riêng, nhớ `HOLD_SECONDS` giây cho các khung model không chạy (`_chan_lech`, dọn mỗi 300 khung).
  - `_khung_giay()`: hai khung IoU > 0.3 thì giữ một, khung chân kia lấy từ ô giày chưa gán của model phụ (nếu có).
  - Khung cũ quanh cổ chân vẫn là đường lùi khi thiếu điểm khớp gối/cổ chân.
- `wiki/06-tich-hop-yolo.md`, `CHANGELOG.md`.

## Kiểm thử
- [x] Bộ theo dõi thật, `main` vs nhánh, cùng 180 khung của 3 video mẫu trên `main`: IoU trung vị với ô giày của model **0.30 → 0.52** (≥0.5: 6% → 53%); hai ô chồng nhau **6 → 0**; quyết định người/mũ/áo/găng chênh 2 khung và khung mũ/áo/găng chênh 1 khung — đúng bằng nhiễu nền khi so `main` với chính nó (2 / 1).
- [x] `py_compile ai-engine/ppe_tracker.py` · `ai-engine/test_video_source.py`.
- [x] Ảnh vẽ khung thật của engine lên video: khung xanh ôm giày thay vì ống chân.
- [ ] `ai-engine/eval_ppe_decision.py` không chạy được: script gọi `parts_model_path` trong khi bộ theo dõi hiện dùng `parts_models` (lỗi có sẵn, không sửa trong PR này) — nên không có số đo trên 283 ảnh có nhãn.
- [ ] Kiểm tra trên camera thật / góc quay khác — hoãn.

## Tài liệu
CHANGELOG (Unreleased → Sửa), wiki/06.

## Rủi ro và việc còn lại
- Độ khớp đo so với ô giày của chính model giày, không phải nhãn vẽ tay; hệ số `CHAN_MAU`/`CHAN_XUONG` có thể cần chỉnh trên camera thật.
- Pose model đôi khi nhầm chân trái/phải: độ lệch học được của bên này có thể gán sang bên kia trong giây lát.
- Khoảng 1/5 người-khung chỉ có một ô giày (chân kia model giày cũng không thấy) — tốt hơn vẽ trùng nhưng chưa đủ hai ô.
- Cần chạy engine trên máy có camera/video thật và nhìn màn hình để xác nhận cuối.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
