## Tóm tắt
- Tỉ lệ tuân thủ có **mẫu số thật**: AI engine đếm "người × giây" quan sát được mỗi phút cho từng camera, dashboard tính `1 − vi phạm / phút-người` thay cho công thức ước lượng cũ (mỗi vi phạm trừ 5 điểm).
- Ngày chưa có dữ liệu quan sát không còn hiện 100% giả: API trả `null`, thẻ KPI rơi về ước lượng cũ và gắn nhãn **"ước tính"**.
- KPI "Camera trực tuyến" đếm từ camera thật (`useCameras()`) thay cho `mockCameras` — đóng US-20.

## Issue
Closes #<n>

## Thay đổi chính
- `ai-engine/ppe_tracker.py`: thêm `self.last_person_count` — số người của khung vừa xử lý, gán **ngay sau bước lọc vùng làm việc** nên người ngoài vùng không được tính. Để ở thuộc tính thay vì đổi kiểu trả về của `process_frame` → không nơi gọi nào phải sửa. Logic nhận diện không đổi một dòng nào.
- `ai-engine/yolo_inference.py`: mỗi luồng cộng dồn `obs_seconds += số_người × dt` (`dt` chặn ≤ 1s để một lần khựng dài không thổi phồng mẫu số) và `obs_persons = max(...)`; hết một phút đồng hồ UTC thì gom **mọi luồng** thành một mảng và `post_observations()` (timeout 2s, chỉ cảnh báo một lần cho mỗi HTTP status như POST sang bridge). 1 request/phút cho toàn hệ thống.
- `prisma/schema.prisma`: model `ObservationStat` (`@@unique([cameraId, minute])`, `@@index([siteId, minute])`). Cố ý không khai quan hệ Prisma tới Camera/Site — bảng chỉ được đọc theo `siteId` + `minute`.
- `src/lib/compliance-shape.ts` (mới): zod payload (≤ 200 dòng, `minute` ISO, `persons` nguyên ≥ 0) + hàm **thuần** `complianceByDay(stats, violations, from, to)` — gom theo ngày UTC (cùng quy ước `dayKey` của `use-dashboard.ts`), `rate = clamp(1 − vi_phạm / max(phút-người, 1), 0, 1)`, `null` khi ngày đó chưa có quan sát.
- `src/app/api/observations/route.ts` (mới): POST chỉ cho AI engine (`X-AI-Engine-Secret`, fail closed giống `/api/violations`); `siteId` suy từ Camera; camera vừa bị xoá thì **bỏ qua dòng đó** thay vì trả lỗi cho cả lô (engine không có cách xử lý lỗi nào ngoài log); upsert theo `(cameraId, minute)`; trả 201 `{ upserted }`.
- `src/app/api/stats/compliance/route.ts` (mới): GET cần session, lọc theo `allowedSiteIds()` (xin `?siteId=` ngoài phạm vi → 403), mặc định 30 ngày, trần 366 ngày.
- `src/hooks/use-dashboard.ts`: hook `useComplianceStats()`; `useDashboardKPIs`/`useComplianceTrend` dùng số thật, chỉ rơi về `rateFromCount` cho ngày chưa có quan sát (kèm cờ `complianceEstimated`); số/tổng camera đếm từ `useCameras()`, bỏ import `mockCameras`.
- `src/app/(dashboard)/page.tsx`: `KPICard` nhận prop `note` → nhãn "ước tính" cạnh tiêu đề thẻ Tỷ lệ tuân thủ.

## Kiểm thử
- [x] `npm run test:agent` — 139/139 pass (12 test mới: `agent/test/compliance.test.ts` 6, `agent/test/observations-shape.test.ts` 6)
- [x] `npx tsc --noEmit` · `npx eslint .` — sạch
- [x] Python: `python3 -m py_compile ai-engine/yolo_inference.py ai-engine/ppe_tracker.py`; `python3 -m unittest ai-engine/test_zones.py` — 12/12 pass
- [ ] Kiểm tra hình ảnh desktop/mobile — **hoãn**: máy vận hành không được chạy app/Chrome trong đợt này (ràng buộc kế hoạch v0.9). Thay đổi giao diện chỉ là một nhãn nhỏ cạnh tiêu đề thẻ KPI, tiêu đề đã bọc `flex-wrap`.

## Tài liệu
- `wiki/04-mo-hinh-du-lieu.md`: model `ObservationStat` (sơ đồ + bảng).
- `wiki/05-giao-dien-va-api.md`: route `/api/observations`, `/api/stats/compliance`, hook `useComplianceStats`, cập nhật mục dữ liệu mock.
- `wiki/06-tich-hop-yolo.md`: mục "Đếm người quan sát được (mẫu số của tỉ lệ tuân thủ)".
- `docs/ba/04-function-list.md`: F-DASH-01 → v0.9. `docs/ba/13-user-stories.md`: US-20 ✅. `docs/ba/14-nfr.md`: NFR-25 (nhịp gửi số liệu quan sát).
- `CHANGELOG.md`: Unreleased → Thêm / Thay đổi.

## Rủi ro và việc còn lại
- Chưa chạy engine thật: phần đếm người mới chỉ được kiểm bằng `py_compile` + đọc lại diff; số liệu quan sát thật chưa được đối chiếu với đếm tay.
- Mẫu số phụ thuộc chất lượng nhận diện: model bỏ sót người thì `personMinutes` thấp → tỉ lệ tuân thủ bị kéo xuống. Đây là đánh đổi cố ý (thà thấp còn hơn 100% giả).
- Gom ngày theo **UTC**, giống `dayKey` sẵn có trong `use-dashboard.ts`. Với múi giờ VN (UTC+7), ranh giới "ngày" lệch 7 tiếng so với ca làm việc; muốn đúng theo giờ địa phương phải đổi cả hai chỗ trong một task riêng.
- `ObservationStat` chưa có cơ chế dọn: mỗi camera 1.440 dòng/ngày (~0,5 triệu dòng/năm/camera). Cần job dọn/gộp theo ngày nếu chạy dài hạn.
- Camera bị xoá không kéo theo `ObservationStat` (không khai quan hệ), các dòng cũ nằm lại nhưng vẫn đúng cho thống kê lịch sử của site.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
