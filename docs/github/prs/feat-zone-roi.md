## Tóm tắt
- Mỗi camera khai được vùng làm việc (đa giác): người có **điểm chân** ngoài mọi vùng không bị xét PPE nữa — bớt vi phạm oan của khách đi ngang / nhà dân cạnh công trường.
- Cán bộ an toàn tự vẽ vùng ngay trong Cài đặt > Giám sát trên ảnh xem trước của camera, không phải sửa file cấu hình.
- AI engine tự đọc lại vùng mỗi 60 giây: vẽ xong không cần khởi động lại hệ thống.

## Issue
Closes #<n>

## Thay đổi chính
- `ai-engine/zones.py` (mới): hình học thuần Python — `parse_polygon`, `point_in_polygon` (ray casting), `foot_point`, `filter_persons_in_zones`. Không import torch/cv2/numpy nên test chạy bằng `python3 -m unittest` trên python hệ thống.
- `ai-engine/ppe_tracker.py`: `process_frame(frame, zones=None)` — lọc `persons` NGAY sau khi tách người/vật, trước mọi logic PPE. Không đụng gì khác trong pipeline nhận diện.
- `ai-engine/yolo_inference.py`: `load_zones()` đọc `Zone` (isActive, `type='MONITORING'`) qua kết nối SQLite chỉ-đọc sẵn có, làm mới mỗi 60s; `zones_for_stream()` (một luồng video phục vụ nhiều camera demo → chỉ cần một camera chưa khai vùng là xét cả khung); `write_preview()` ghi `public/snapshots/preview_<cameraId>.jpg` (JPEG rộng 640px) mỗi 30s/camera, dùng lại khung đã đọc, nén + ghi đĩa ở thread phụ, ghi file tạm rồi `os.replace` để trình duyệt không đọc phải ảnh viết dở.
- `src/lib/zone-shape.ts` (mới): zod (3–20 điểm, toạ độ 0–1, tối đa 10 vùng), `parseZonePolygon`/`serializeZonePolygon` (làm tròn 4 chữ số), `toZoneDTO`, hằng `MONITORING_ZONE_TYPE` (DB lưu chữ HOA, khác `ZoneType` chữ thường của frontend).
- `src/app/api/cameras/[id]/zones/route.ts` (mới): `GET`/`PUT`, quyền `assertSiteAccess` theo site của camera; PUT thay toàn bộ danh sách trong một `$transaction` (`zones: []` = xoá hết → AI xét lại cả khung).
- `src/hooks/use-cameras.ts`: `useCameraZones`, `useSaveCameraZones`.
- `src/components/settings/ZoneEditor.tsx` (mới) + mục "Vùng nhận diện" trong `CameraEditDialog`. Lớp vẽ dùng **SVG** thay cho `<canvas>`: đa giác và từng điểm là phần tử thật nên kéo/xoá điểm dùng thẳng sự kiện chuột, không phải tự vẽ lại và tự dò trúng điểm — ít mã hơn hẳn mà vẫn đúng yêu cầu.

## Kiểm thử
- [x] `npm run test:agent` — 101/101 pass (9 test mới `agent/test/zones-shape.test.ts`)
- [x] `npx tsc --noEmit` · `npx eslint .` — sạch
- [x] Python: `python3 -m py_compile ai-engine/yolo_inference.py ai-engine/ppe_tracker.py ai-engine/zones.py`; `python3 -m unittest ai-engine/test_zones.py` — 12/12 pass
- [ ] Kiểm tra hình ảnh desktop/mobile — **hoãn**: máy vận hành không được chạy app/Chrome trong đợt này (ràng buộc kế hoạch v0.9); trình vẽ vùng cần AI engine chạy mới có ảnh nền.

## Tài liệu
- `wiki/06-tich-hop-yolo.md`: mục "Vùng nhận diện (Zone/ROI) theo camera" (sơ đồ lọc, ảnh xem trước 30s), bảng file thêm `zones.py`.
- `wiki/05-giao-dien-va-api.md`: route `/api/cameras/[id]/zones`, hook mới.
- `docs/ba/04-function-list.md`: F-AI-05 P1 → v0.9. `docs/ba/07-screen-specs.md`: SCR-13 thêm trường "Vùng nhận diện" + các trạng thái.
- `CHANGELOG.md`: Unreleased → Thêm.

## Rủi ro và việc còn lại
- Chưa chạy thật với camera: lọc vùng và ảnh xem trước mới chỉ được kiểm bằng unit test và py_compile.
- `Zone.type` `RESTRICTED`/`WARNING` vẫn chưa có ý nghĩa với engine; giao diện chỉ tạo vùng `MONITORING`.
- Vùng vẽ xong có hiệu lực sau tối đa 60 giây (đúng thiết kế, không có cơ chế đẩy tức thì).
- Ảnh `preview_*.jpg` KHÔNG bị `clear_snapshots()` xoá khi tắt engine — cố ý, để còn nền mà vẽ vùng lúc engine không chạy; đổi lại ảnh có thể cũ.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
