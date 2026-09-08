# Cảnh báo xâm nhập vùng cấm và vùng dưới tải treo
branch: feat/restricted-zones

## Vấn đề
Bảng `Zone` có bốn loại (`MONITORING`, `RESTRICTED`, `WARNING`, `SUSPENDED_LOAD`) nhưng engine
mới dùng `MONITORING` để lọc người ngoài vùng làm việc. Người bước vào khu vực cấm hay đứng
dưới tải treo — hai tình huống tai nạn nặng nhất ở công trường — hiện không sinh cảnh báo dù
`ViolationType` đã có `zone_intrusion` và `suspended_load` với nhãn tiếng Việt sẵn.

## Đề xuất
- Trình vẽ vùng cho chọn loại vùng, tô màu theo mức nguy hiểm; API zones đọc/ghi mọi loại.
- Engine đọc thêm vùng nguy hiểm; người có điểm chân trong vùng liên tục ≥ 3 giây → vi phạm
  `zone_intrusion` (RESTRICTED/WARNING) hoặc `suspended_load` (SUSPENDED_LOAD), mức
  `critical`/`high`, kèm `zoneId`, ảnh bằng chứng; còn ở trong thì báo lại mỗi 60 giây với
  `occurrenceCount` tăng. Không đổi logic nhận diện PPE.
- Vi phạm mới đi qua toàn bộ luồng sẵn có: review của agent, cảnh báo theo `AlertRule`, clip, báo cáo.

## Tiêu chí nghiệm thu
- [ ] Hình học và bộ đếm thời gian là hàm/lớp thuần trong `ai-engine/zones.py`, test bằng
      `python3 -m unittest` không cần torch (chưa đủ 3 s không chốt; đủ thì chốt; lặp sau 60 s; rời vùng reset).
- [ ] Camera chưa khai vùng nguy hiểm: hành vi hoàn toàn như cũ.
- [ ] `PUT /api/cameras/[id]/zones` từ chối loại vùng lạ; vùng không có `type` mặc định `MONITORING`.
- [ ] Tài liệu wiki/04, wiki/06, wiki/05, BA F-AI-06, CHANGELOG cùng PR.
