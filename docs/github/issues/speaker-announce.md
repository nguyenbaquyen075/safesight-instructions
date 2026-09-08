# Loa công trường tự động phát nhắc nhở khi agent chốt vi phạm
branch: feat/speaker-announce

## Vấn đề
Trang `/site-speaker` chỉ phát được giọng nói khi cán bộ bấm mic. Khi agent đã xác nhận một
vi phạm thật (`VERIFIED`), vẫn phải có người ngồi trước màn hình mới nhắc được công nhân —
đúng lúc cần nhắc nhất thì thường không ai rảnh.

## Đề xuất
- Bridge nhận `POST /announce { cameraId, text }` (xác thực bằng `X-AI-Engine-Secret`) và phát
  `voice-announce` tới room của camera; trang loa đọc bằng `speechSynthesis` tiếng Việt, ghi lại
  10 thông báo gần nhất, có nút "Thử loa".
- Agent có tool `announce` (chỉ sau khi `record_verdict` VERIFIED thật, tối đa 2 lần/phiên,
  60 s/camera); câu mẫu sinh từ loại vi phạm và vị trí camera ("Khu vực cẩu tháp 1, vui lòng đội mũ bảo hộ").
- Nút "Phát loa" trong modal vi phạm cho người dùng phát tay, có ghi `AuditLog`.

## Tiêu chí nghiệm thu
- [ ] `announcementFor(violation, camera)` là hàm thuần có test cho từng loại vi phạm và giới hạn 200 ký tự.
- [ ] Tool `announce` bị chặn khi chưa VERIFIED, khi hết hạn mức phiên, khi camera đang cooldown; có event `action`.
- [ ] Không có loa nào đang nghe → kết quả nói rõ "không có loa", không coi là lỗi.
- [ ] Tài liệu wiki/05, wiki/09, env trong README/wiki/03, BA F-VOICE-02, CHANGELOG cùng PR.
