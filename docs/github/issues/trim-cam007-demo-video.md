# Video demo cam-007 có đoạn cuối làm model găng báo "có găng" sai
branch: chore/trim-cam007-demo-video

## Vấn đề
Ở giây ~31,7 → 38,4 của `IMG_2744 2.MOV` (cam-007) một công nhân thứ hai đi vào khung, tay trần nhưng mặc áo rằn ri. Model găng `ppe_gang.pt` cho ô điểm 0.26–0.43 lên cổ tay áo sát bàn tay trần (vượt sàn 0.25), nên `ppe_tracker.py` coi người đó có găng và vẽ khung GĂNG xanh. Điểm găng của tay trần ở đoạn này chồng với điểm găng thật (cam-008), nên chỉ nâng ngưỡng không tách được.

## Đề xuất
- Cắt video demo cam-007 trước khi người đó vào (giây 31,4), không chuyển mã.
- Việc sửa model/logic găng là vấn đề riêng (nâng ngưỡng, kết luận theo tỉ lệ khung trong cửa sổ, hoặc train lại với ví dụ âm) — chưa làm.

## Tiêu chí nghiệm thu
- [ ] Video còn 31,4 giây, cùng codec/kích thước, 942 khung đầu giống hệt bản cũ.
- [ ] Engine và `/cameras` vẫn chạy cam-007 bình thường (video lặp lại từ đầu).
