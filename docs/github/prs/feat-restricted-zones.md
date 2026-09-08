## Tóm tắt
- Người bước vào **vùng cấm** (`RESTRICTED`/`WARNING`) hoặc đứng **dưới tải treo** (`SUSPENDED_LOAD`) liên tục ≥ 3 giây → vi phạm `zone_intrusion` / `suspended_load` (mức `critical`/`high`), kèm `zoneId` và ảnh bằng chứng; còn ở trong thì báo lại mỗi 60 giây với `occurrenceCount` tăng.
- Trình vẽ vùng (Cài đặt > Giám sát > sửa camera) cho chọn loại vùng, tô màu theo mức nguy hiểm, có chú giải; API zones đọc/ghi mọi loại.
- Vi phạm mới đi qua toàn bộ luồng sẵn có (review của agent, `AlertRule`, báo cáo, loa).

## Issue
Closes #<n>

## Thay đổi chính
- `ai-engine/zones.py`: `DangerZone`, `intrusions()`, `IntrusionTracker(confirm_seconds=3, repeat_seconds=60, now=…)` với grace theo `seen_at` (mất track một khung không reset bộ đếm), `zones_for_stream()`/`danger_zones_for()` chuyển vào đây để test được không cần cv2. Vùng nguy hiểm được **hợp vào tập giữ người** của luồng, nên người đứng trong vùng cấm không bị lọc mất trước khi xét xâm nhập (hệ quả: họ cũng được xét PPE và tính vào `ObservationStat`).
- `ai-engine/yolo_inference.py`: `load_zones()` trả `{cam: {monitoring, danger}}`; `report_violation` nhận override `violationType`/`severity`/`zoneId`; snapshot xâm nhập có hậu tố `-zone`, nhãn ASCII `VUNG CAM`/`TAI TREO` trên ảnh (Hershey không vẽ được dấu), tiếng Việt giữ trong `bboxData[].label`. `ppe_tracker.py` không đổi (0 dòng).
- `src/lib/zone-shape.ts`, route `GET/PUT /api/cameras/[id]/zones`, `ZoneEditor.tsx`: `type` trong DTO/zod (mặc định `MONITORING`, từ chối loại lạ), PUT thay toàn bộ vùng mọi loại, ô chọn loại + màu `--primary`/`--warning`/`--danger` + chú giải, `aria-label`.

## Kiểm thử
- [x] `agent/test/*.test.ts` 183/183 (zones-shape 8 → 12)
- [x] `npx tsc --noEmit` · `npx eslint .`
- [x] Python: `python3 -m unittest ai-engine/test_zones.py` 30/30 (không cần torch) · `py_compile`
- [ ] Kiểm tra hình ảnh desktop/mobile — hoãn tới sau khi gộp (không chạy app trên máy vận hành)

## Tài liệu
wiki/04 (loại vùng), wiki/06 (pipeline + giới hạn track id tái dùng), wiki/05 (payload zones), docs/ba/04 F-AI-07, CHANGELOG.

## Rủi ro và việc còn lại
- Chưa chạy engine trên video thật với vùng cấm; `PUT` giờ xoá cả vùng tạo ngoài trình vẽ (theo spec).
- Track id BoT-SORT tái dùng trong cùng vùng có thể chốt sớm — đã ghi trong wiki/06.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
