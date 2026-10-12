# Khung nhận diện trên /cameras lệch khỏi hình video dọc
branch: fix/cameras-overlay-aspect

## Vấn đề
Với video dọc 9:16 trong ô 357×456, video bị `object-cover` phóng to và cắt ~180px trên dưới, nhưng lớp khung nhận diện vẫn tính phần trăm theo cả ô. Khung ở phần dưới hình (bàn chân) hiện cao hơn giày thật khoảng 45px, khung ở phần trên thấp hơn người. Chú thích trong `DemoVideoWithBoxes` nói video và lớp khung nằm cùng một khối đúng tỉ lệ, nhưng `ratio` chỉ được lưu mà không dùng.

## Đề xuất
- Khối chứa video và lớp khung có đúng tỉ lệ video và phủ kín ô, để khung bị cắt y hệt video.

## Tiêu chí nghiệm thu
- [ ] Video dọc và ngang: khối video đúng tỉ lệ, phủ kín ô, căn giữa.
- [ ] Khung mũ/áo/găng/giày nằm đúng vật trên hình ở cả hai loại video.
