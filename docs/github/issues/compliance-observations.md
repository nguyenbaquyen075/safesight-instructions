# Tỉ lệ tuân thủ tính từ số người quan sát được

## Vấn đề
KPI "Tỷ lệ tuân thủ" và biểu đồ xu hướng 30 ngày hiện được **suy ra từ số vi phạm**:
`rateFromCount = max(0, 100 − số_vi_phạm × 5)` (`src/hooks/use-dashboard.ts`). Con số này
không có mẫu số nên vô nghĩa về nghiệp vụ: 5 vi phạm ở công trường 200 người và 5 vi phạm
ở tổ 3 người đều ra 75%. Ngày không ai làm việc thì hệ thống báo 100% tuân thủ. Cán bộ an
toàn không dùng được con số đó để so sánh giữa các công trường hay giữa các ngày.
Số "Camera trực tuyến" trên cùng bảng điều khiển cũng vẫn đếm từ `src/data/mock-cameras.ts`
(US-20).

## Đề xuất
- AI engine đếm luôn **số người nó thực sự nhìn thấy**: mỗi khung cộng `số_người × dt`
  (`dt` = thời gian thật từ khung trước, chặn ≤ 1s), số người lấy **sau khi lọc vùng làm
  việc** (`tracker.last_person_count`) nên người ngoài vùng không làm phồng mẫu số.
- Hết mỗi phút đồng hồ, engine gom mọi luồng thành một lô và `POST /api/observations`
  (header `X-AI-Engine-Secret`, timeout 2s) — 1 request/phút cho toàn hệ thống, không được
  chặn vòng lặp nhận diện.
- Model `ObservationStat { cameraId, siteId, minute, persons, personSeconds }` với
  `@@unique([cameraId, minute])`, ghi bằng upsert nên gửi trùng không nhân đôi mẫu số.
- `GET /api/stats/compliance?siteId&from&to` trả theo ngày
  `{ day, personMinutes, violations, complianceRate }`, `complianceRate = 1 − vi_phạm /
  max(phút-người, 1)` giới hạn 0–1, `null` khi ngày đó chưa có quan sát nào.
- Bảng điều khiển dùng số thật; ngày chưa có quan sát mới rơi về ước lượng cũ và thẻ KPI
  phải ghi rõ **"ước tính"** thay vì bịa ra 100%. Số camera online đếm từ camera thật.

## Tiêu chí nghiệm thu
- [ ] `complianceByDay()` là hàm thuần, có test: ngày có dữ liệu, ngày không có quan sát
      (`null`), vi phạm nhiều hơn phút-người (kẹp về 0), mọi ngày trong khoảng đều xuất hiện.
- [ ] Payload `/api/observations` xác thực bằng zod (tối đa 200 dòng, `minute` ISO,
      `persons` nguyên ≥ 0), có test.
- [ ] POST chỉ nhận từ AI engine (secret, fail closed như `/api/violations`); `siteId` suy
      từ Camera; camera đã xoá thì bỏ qua dòng đó chứ không hỏng cả lô.
- [ ] `GET /api/stats/compliance` cần session và lọc theo phạm vi site (`allowedSiteIds`),
      xin `?siteId=` ngoài phạm vi trả 403.
- [ ] Engine: không đổi logic nhận diện; POST 1 lần/phút, lỗi mạng chỉ cảnh báo một lần cho
      mỗi HTTP status; `python3 -m py_compile` và `python3 -m unittest ai-engine/test_zones.py`
      vẫn xanh.
- [ ] Thẻ KPI hiện nhãn "ước tính" đúng lúc; số camera online lấy từ `useCameras()`
      (US-20 ✅), không còn `mockCameras` trong `use-dashboard.ts`.
- [ ] Tài liệu cùng commit: `wiki/04`, `wiki/05`, `wiki/06`, `docs/ba/04` (F-DASH-01),
      `docs/ba/13` (US-20), `docs/ba/14` (NFR mới), `CHANGELOG.md`.
