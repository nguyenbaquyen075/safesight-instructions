# 12 — Use scenario

Văn tường thuật bằng ngôn ngữ của người dùng, không dùng thuật ngữ hệ thống. Mỗi scenario nêu mục tiêu, quy trình và kết quả.

## SC-01 Ca sáng của chị Lan, cán bộ an toàn

Chị Lan phụ trách an toàn tại công trường Bình Tân. Mục tiêu của chị mỗi ca là không bỏ sót ai làm việc mà thiếu mũ hoặc áo phản quang, và không phải chạy vòng quanh công trường để kiểm tra.

Bảy giờ sáng, chị mở máy tính trong phòng trực, đăng nhập và nhìn màn hình tổng quan: tỉ lệ tuân thủ hôm qua, số vi phạm, camera nào đang hoạt động. Chị chuyển sang trang camera, bật "chỉ hiện camera đang vi phạm" để màn hình chỉ còn những chỗ cần để mắt.

Bảy giờ hai mươi, ô camera "Cổng chính" viền đỏ. Trên video có khung đỏ ngay trên đầu một công nhân: thiếu mũ. Chị giữ nút micro trên ô camera và nói: "Anh áo xanh ở cổng chính, đội mũ lên giúp chị." Loa ở cổng phát lại câu đó. Công nhân nhìn lên, lấy mũ trong xe đội vào. Ô camera chuyển về bình thường.

Chị mở danh sách vi phạm, bấm vào dòng vừa rồi. Ảnh bằng chứng có khung đúng trên đầu người đó, kèm ghi chú của trợ lý tự động: "Đã xác minh: không thấy mũ trong 4 giây liên tiếp, ánh sáng tốt". Chị bấm "Đã xử lý". Cả quy trình mất chưa tới một phút, chị không rời khỏi phòng trực.

**Kết quả:** vi phạm được nhắc nhở ngay tại chỗ, có ảnh làm bằng chứng cho báo cáo tuần, và chị Lan không cần đi tuần.

## SC-02 Anh Hùng, quản lý công trường, nhận tin nhắn lúc đang họp

Anh Hùng quản lý hai công trường, thường xuyên ở ngoài. Mục tiêu của anh là biết ngay khi có vi phạm lặp lại mà không cần mở máy tính.

Đang họp với chủ đầu tư, điện thoại anh rung: tin nhắn Telegram từ "SafeSight Bot" kèm ảnh, nội dung "Nhắc nhở: thiếu áo phản quang tại camera Bãi vật tư, công trường Bình Tân". Anh liếc qua, thấy chỉ là một người, để đó. Năm phút sau, tin thứ hai: "Leo thang: người này vẫn thiếu áo phản quang, lần thứ 3". Anh nhắn cho tổ trưởng ở bãi vật tư xử lý.

Tối về, anh mở trang phân tích, xem bãi vật tư tuần này có bao nhiêu vi phạm, so với tuần trước. Anh quyết định họp tổ vật tư vào sáng mai.

**Kết quả:** vi phạm lặp lại được xử lý trong vòng vài phút dù quản lý không có mặt; dữ liệu tuần làm căn cứ để nhắc nhở đội.

## SC-03 Anh Tuấn, kỹ thuật viên, lắp thêm camera và cấu hình cảnh báo

Anh Tuấn phụ trách kỹ thuật cho công ty. Mục tiêu: đưa một camera IP mới ở cổng phụ vào hệ thống và bảo đảm khi có vi phạm thì nhóm quản lý nhận được tin nhắn.

Anh vào Cài đặt, tab Giám sát, bấm thêm camera, đặt tên "Cổng phụ", chọn công trường, chọn nguồn RTSP và dán địa chỉ camera. Lưu xong, vài giây sau ô camera mới xuất hiện trên trang camera và có hình.

Sang tab Thông báo, anh dán mã bot Telegram mà công ty đã tạo, bấm kiểm tra kết nối, thấy tên bot hiện ra, bật công tắc. Anh tạo quy tắc "Cảnh báo thiếu mũ, áo" cho công trường Bình Tân, dán số nhóm Telegram của ban quản lý, để ngưỡng 1 và thời gian chờ 5 phút để không bị dội tin.

Anh thử bằng cách bước ra trước camera mà không đội mũ: ba giây sau, nhóm Telegram nhận được ảnh của anh.

**Kết quả:** camera mới đi vào giám sát trong vài phút, cảnh báo đến đúng nhóm người, không dội tin.

## SC-04 Đêm không người trực: trợ lý tự động phát hiện camera đứng hình

Ban đêm phòng trực không có người. Mục tiêu của hệ thống: sáng hôm sau không phát hiện ra rằng camera đã "chết" từ nửa đêm.

Một giờ sáng, camera "Bãi vật tư" mất kết nối. Trợ lý tự động, kiểm tra mỗi phút, nhận thấy camera không gửi hình mới, đánh dấu camera là "suy giảm", sau đó là "ngoại tuyến", và ghi vào dòng thời gian. Camera tự khôi phục lúc hai giờ, trợ lý ghi "đã hồi phục" và đặt lại trạng thái.

Ba giờ sáng, tiến trình nhận diện bị treo. Trợ lý thấy nhịp tim của nó ngừng, khởi động lại tiến trình một lần, ghi lại. Nếu treo tiếp trong giờ tới, trợ lý sẽ không khởi động lại nữa mà gửi tin nhắn báo sự cố cho ban quản lý.

Sáng hôm sau, chị Lan mở trang Agent, đọc dòng thời gian trong hai phút, biết đêm qua có gì và không có gì cần làm thêm.

**Kết quả:** sự cố ban đêm được xử lý hoặc báo cáo tự động, người trực buổi sáng có bức tranh đầy đủ.

## SC-05 Quản trị tắt trợ lý khi nghi ngờ nó phán đoán sai

Anh Tuấn nhận phản ánh rằng vài vi phạm bị đánh dấu "báo oan" tự động trong khi thực tế là thật. Anh vào trang Agent, xem dòng thời gian, thấy các phán quyết đó kèm mức "Đã xác minh" và lý do. Chưa chắc chắn, anh gạt công tắc tắt trợ lý: từ lúc đó hệ thống chỉ ghi nhận, không tự đổi trạng thái. Anh hỏi trong ô hỏi đáp: "Hôm nay có bao nhiêu vi phạm bị đánh dấu báo oan và ở camera nào?" và nhận câu trả lời kèm danh sách để kiểm tra lại.

**Kết quả:** con người luôn giữ được quyền dừng tự động hoá bằng một thao tác, mà không mất dữ liệu.
