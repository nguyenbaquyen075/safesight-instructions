## Tóm tắt
- Mỗi vi phạm đã chốt kèm thêm một **clip ~8 giây** (20 khung trước + 12 khung sau thời điểm chốt) chứ không chỉ một tấm ảnh — người duyệt thấy được bối cảnh trước/sau, bớt tranh cãi "ảnh chụp đúng lúc bất lợi".
- Modal chi tiết vi phạm phát clip ngay (ảnh chốt làm poster); vi phạm không có clip vẫn hiện ảnh bằng chứng như cũ.
- Clip được dọn đúng luật bằng chứng sẵn có: chỉ xoá khi vi phạm đã đóng và tệp cũ hơn 24h.

## Issue
Closes #<n>

## Thay đổi chính
- `ai-engine/clips.py` (mới): `FrameRing` (deque 20 khung gần nhất), `PendingClip` (đếm ngược khung sau, tự đóng), `start_clip()` (mở clip + ghi ngay phần đầu), `ClipWriter` (bọc `cv2.VideoWriter`, mp4v 4 fps). Chỉ `ClipWriter` mới `import cv2`, và import lúc khởi tạo — nên `python3 -m unittest ai-engine/test_clips.py` chạy được bằng python hệ thống, không cần torch/cv2.
- `ai-engine/yolo_inference.py` (**+22 −3**, không đụng logic nhận diện): `st.setdefault("ring", FrameRing()).push(frame)` ngay sau khi đọc khung; khi chốt vi phạm thì `start_clip()` ghi `clip_<cameraId>_<timestamp>.mp4` (đúng khoá tên với ảnh `violation_<cameraId>_<timestamp>.jpg`) và đẩy vào `st["pending_clips"]`; cuối mỗi vòng lặp mỗi clip đang mở nhận thêm **một** khung rồi tự đóng khi đủ — vòng lặp không bị chặn. `report_violation()` gửi kèm `clipUrl` khi có; `clear_snapshots()` xoá cả `clip_*.mp4`. Dùng `setdefault` thay vì sửa 4 chỗ tạo stream: diff nhỏ hơn và luồng dự phòng camera 0 cũng được đệm khung.
- `src/app/api/violations/route.ts`: zod `clipUrl: z.string().optional()`, ghi vào `Violation.clipUrl`. Engine gửi trường này chỉ khi ghi được clip (API không nhận `null`), nên vi phạm không có clip vẫn hợp lệ.
- `src/components/violations/ViolationDetailModal.tsx`: có clip → `<video controls muted playsInline preload="metadata" poster={snapshotUrl}>` (bỏ `autoPlay`/`loop`: clip bằng chứng để xem chủ động, lặp vô hạn gây nhiễu); không có clip → **ảnh chốt** thay cho ô trống "Thiếu clip bằng chứng" trước đây. Ô ảnh trong phiếu phạt ưu tiên ảnh tĩnh (đúng nghĩa "Ảnh bằng chứng" khi in phiếu).
- `agent/direct/cleanup.ts`: `isEvidenceFile()` (mới, thuần) gom hai loại bằng chứng `violation_*.jpg` + `clip_*.mp4`; `runCleanup` tra `Violation` theo `snapshotUrl` **hoặc** `clipUrl` nên ảnh và clip của cùng một vi phạm sống/chết cùng nhau. `pickCleanup` giữ nguyên — luật (đã tham chiếu + đã đóng + quá 24h) vốn không phụ thuộc loại tệp. `preview_*.jpg` và `.heartbeat.json` vẫn không bao giờ bị coi là bằng chứng.
- `agent/tools/read_violation.ts`: `violationFacts` trả thêm `clipUrl`; phần text nhắc "có clip 8s kèm vi phạm này, người quản lý xem trong modal chi tiết" — agent không tải video (chưa có ffmpeg), chỉ biết là có.
- Schema/DTO/kiểu (`Violation.clipUrl`, `toViolationDTO`, `src/types/models.ts`) đã có sẵn từ trước, nhánh này chỉ bổ sung **nguồn sinh dữ liệu** và test chốt hành vi.

## Kiểm thử
- [x] `npm run test:agent` — 151/151 pass (147 nền + 4 test mới: `isEvidenceFile`, `pickCleanup` cho clip, `violationFacts.clipUrl`, `toViolationDTO.clipUrl`)
- [x] `npx tsc --noEmit` · `npx eslint .` — sạch
- [x] Python: `python3 -m py_compile ai-engine/yolo_inference.py ai-engine/clips.py`; `python3 -m unittest ai-engine/test_clips.py ai-engine/test_zones.py` — 19/19 pass
- [x] Smoke thật với cv2 (venv, OpenCV 5.0): `start_clip` + 12 lần `feed` sinh mp4 **32 khung, 4 fps, 160x120** đọc lại được bằng `cv2.VideoCapture` — đúng 8 giây như thiết kế
- [ ] Kiểm tra hình ảnh desktop/mobile — **hoãn**: ràng buộc kế hoạch v0.9 (không chạy server/Chrome trên máy vận hành); clip thật chỉ có khi AI engine chạy

## Tài liệu
- `wiki/06-tich-hop-yolo.md`: mục "Clip bằng chứng cho mỗi vi phạm" (sơ đồ luồng, thông số, ghi chú bộ nhớ), bảng file thêm `clips.py`, mô tả `public/snapshots/`.
- `wiki/04-mo-hinh-du-lieu.md`: `Violation.clipUrl`. `wiki/05-giao-dien-va-api.md`: `POST /api/violations` nhận `clipUrl` tuỳ chọn.
- `docs/ba/04-function-list.md`: F-AI-03 "Chụp ảnh + clip bằng chứng" (v0.6, clip v0.9). `docs/ba/07-screen-specs.md`: SCR-06 trường 2 đổi thành "Bằng chứng" (video/ảnh).
- `CHANGELOG.md`: Unreleased → Thêm.

## Rủi ro và việc còn lại
- Chưa chạy engine thật với camera: đường ghi clip mới được kiểm bằng unit test + smoke cv2 trên khung numpy giả, chưa kiểm với video công trường thật.
- **Bộ nhớ**: 20 khung 720p ≈ 55MB cho MỖI luồng, giữ nguyên độ phân giải gốc. Nhiều luồng 1080p sẽ nặng — có ghi chú `ponytail:` trong `clips.py` chỉ đường thu nhỏ khung trước khi `push`.
- Clip ghi khung **chưa khoanh khung đỏ** (chỉ ảnh chốt mới vẽ bbox): giữ vòng lặp rẻ, đổi lại người xem phải tự nhìn ra người vi phạm trong clip.
- `clip_*.mp4` bị `clear_snapshots()` xoá sạch mỗi lần engine khởi động, giống ảnh — bằng chứng chỉ sống trong lúc dự án chạy.
- Vi phạm chốt ở ngay khung đầu tiên của một luồng vừa mở (ring rỗng) sẽ không có clip; đây là trường hợp hiếm và đã xử lý sạch (`start_clip` trả `None`, vi phạm vẫn ghi bình thường với ảnh).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
