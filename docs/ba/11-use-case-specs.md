# 11 — Đặc tả use case

Mỗi use case gồm Summary và Business information. Mã use case theo [09-use-case-diagram.md](09-use-case-diagram.md). Các use case CRUD danh mục (UC-23..27) chỉ có bảng Summary rút gọn ở cuối.

## UC-06 Chốt vi phạm PPE

| Trường | Nội dung |
|---|---|
| Use case name | Chốt vi phạm PPE |
| Use case ID | UC-06 |
| Description | AI Engine theo dõi từng người trong khung hình, khi một người thiếu món PPE bắt buộc liên tục đủ lâu thì chụp ảnh bằng chứng và ghi vi phạm vào hệ thống |
| Actor | AI Engine (hệ thống) |
| Priority | Cao nhất — toàn bộ nghiệp vụ bắt đầu từ đây |
| Trigger | Khung hình mới từ camera `ONLINE` |
| Pre-condition | Camera có nguồn hợp lệ; file `ppe_multiclass.pt` tồn tại; `AI_ENGINE_SECRET` khớp giữa engine và API; camera đã seed trong DB |
| Post-condition | Bản ghi `Violation` trạng thái `open` kèm `snapshotUrl`, `bboxData`, `confidence`, `occurrenceCount`; việc review cho agent được tạo; quy tắc cảnh báo được đối chiếu |

**Business rule**
- BR-06-1: Món bắt buộc: mũ, áo phản quang, găng, giày. Kính có trong model nhưng chưa bắt buộc.
- BR-06-2: Chỉ chốt khi độ tin cậy ≥ 0.6 và thiếu liên tục ≥ 3 giây trên cùng track ID.
- BR-06-3: Một người thiếu nhiều món chỉ ghi một vi phạm theo món nặng nhất: mũ (critical) > áo (high) > găng, giày (medium).
- BR-06-4: Còn vi phạm liên tục thì báo lại mỗi 60 giây kèm ảnh mới, `occurrenceCount` tăng; người rời khung thì đếm lại từ đầu.
- BR-06-5: Điểm khớp cổ tay / cổ chân không đủ tin cậy (< 0.5) hoặc ngoài khung thì không vẽ khung, không kết luận "thiếu".
- BR-06-6: Thiếu model phụ thì dùng model chính, hệ thống không dừng.

**Non-functional requirement:** ≥ 3 fps trên CPU máy trạm với 1 camera; nghiệm thu bằng `eval_ppe_decision.py`: báo oan ≤ 1%, bỏ sót ≤ 2% (mục tiêu P1).

## UC-07 Review vi phạm bằng bằng chứng

| Trường | Nội dung |
|---|---|
| Use case name | Review vi phạm bằng bằng chứng |
| Use case ID | UC-07 |
| Description | Agent đọc ảnh, lịch sử camera và bối cảnh công trường, chấm điểm bằng chứng, ghi phán quyết kèm band; tự đổi trạng thái hoặc leo thang khi bằng chứng đạt VERIFIED |
| Actor | Agent (hệ thống, lane nghiên cứu) |
| Priority | Cao |
| Trigger | `POST /api/violations` tạo `AgentTask kind=violation.review` và đánh thức agent |
| Pre-condition | Kill switch bật; có `ANTHROPIC_API_KEY`; chưa vượt trần token ngày; task chưa quá 3 lần thử |
| Post-condition | `Violation.agentReview` = `{ verdict, band, observations[], note, sessionId, reviewedAt }`; `AgentEvent` ghi mọi tool call; trạng thái vi phạm đổi sang `false_positive` nếu VERIFIED báo oan; Telegram leo thang nếu VERIFIED thật |

**Business rule**
- BR-07-1: Band theo điểm bằng chứng: VERIFIED / PROBABLE / POSSIBLE; điểm hoà → chưa quyết, không hành động.
- BR-07-2: Chỉ VERIFIED mới được tự đổi trạng thái; PROBABLE / POSSIBLE để người quyết định.
- BR-07-3: Leo thang tôn trọng cooldown của quy tắc cảnh báo; không gửi trùng trong một phiên.
- BR-07-4: Mỗi phiên tối đa `budget` tool call (mặc định 6); vượt → kết thúc, ghi lý do.
- BR-07-5: Lỗi API Claude → trả task về hàng đợi, tăng `attempts`, hoàn lượt token đã trừ.

**Non-functional requirement:** trần token / ngày cấu hình được; mọi hành động có trong dòng thời gian trong ≤ 2 giây.

## UC-03 Xử lý vi phạm

| Trường | Nội dung |
|---|---|
| Use case name | Xử lý vi phạm |
| Use case ID | UC-03 |
| Description | Người dùng xem bằng chứng, quyết định vi phạm thật hay báo oan, nhắc nhở và cập nhật trạng thái |
| Actor | Cán bộ an toàn, Quản lý công trường (và mọi vai trò đăng nhập) |
| Priority | Cao |
| Trigger | Người dùng chọn vi phạm trong danh sách hoặc từ ô camera |
| Pre-condition | Đã đăng nhập; vi phạm ở trạng thái `open` hoặc `under_review` |
| Post-condition | Trạng thái vi phạm là `resolved` hoặc `false_positive`; toast xác nhận |

**Business rule**
- BR-03-1: Mở chi tiết tự chuyển `open → under_review`.
- BR-03-2: Nút "Đã xử lý" trên danh sách chỉ hiện với `open`.
- BR-03-3: Xoá vi phạm cần xác nhận và không hoàn tác.
- BR-03-4: Phán quyết của agent chỉ là tham khảo; người dùng luôn được ghi đè.

## UC-29 Giao và theo dõi khắc phục

| Trường | Nội dung |
|---|---|
| Use case name | Giao và theo dõi khắc phục |
| Use case ID | UC-29 |
| Description | Người dùng giao việc khắc phục cho một người sau khi xem bằng chứng vi phạm, đặt hạn xử lý, rồi theo dõi tới lúc việc được xác nhận đã khắc phục; việc quá hạn được agent leo thang cho trực vận hành |
| Actor | Cán bộ an toàn, Quản lý công trường (agent leo thang việc quá hạn) |
| Priority | Cao |
| Trigger | Người dùng bấm "Giao xử lý" trong modal chi tiết vi phạm |
| Pre-condition | Đã đăng nhập; vi phạm thuộc công trường người dùng được xem (`assertSiteAccess`) |
| Post-condition | Bản ghi `CorrectiveAction` trạng thái `OPEN` kèm người xử lý, mô tả và hạn; vi phạm đang `OPEN` chuyển `UNDER_REVIEW`; `AuditLog` ghi `violation.action.create` |

**Business rule**
- BR-29-1: Bắt buộc tên người xử lý (2–80 ký tự) và mô tả việc (5–500 ký tự); `assigneeId` chỉ điền khi người đó có tài khoản, tổ đội / thầu phụ vẫn giao được bằng tên.
- BR-29-2: Hạn xử lý phải ở tương lai; không chọn thì mặc định 24 giờ kể từ lúc giao.
- BR-29-3: Bấm "Đã khắc phục" đặt trạng thái `DONE`, ghi `completedAt` và ghi chú bằng chứng (không bắt buộc).
- BR-29-4: Khi vi phạm không còn việc `OPEN` nào và đã có ít nhất một việc `DONE` thì vi phạm tự chuyển `RESOLVED`.
- BR-29-5: Việc `OPEN` quá hạn được agent gộp thành một phát hiện `capa.overdue`, xếp một task `ops.escalate` (nêu tên tối đa 5 việc) rồi đánh dấu `escalatedAt` — mỗi việc chỉ leo thang một lần, vòng quét sau không báo lại.
- BR-29-6: Danh sách việc còn mở ở `/reports` chỉ hiện công trường người dùng được xem.

**Non-functional requirement:** việc quá hạn phải được leo thang trong vòng một chu kỳ quét sức khoẻ (60 giây) kể từ khi qua hạn.

## UC-04 Nhắc nhở qua loa công trường

| Trường | Nội dung |
|---|---|
| Use case name | Nhắc nhở qua loa công trường |
| Use case ID | UC-04 |
| Description | Người trực giữ nút mic trên ô camera đang vi phạm hoặc trong modal vi phạm, âm thanh được phát tại trang loa của camera đó |
| Actor | Cán bộ an toàn, Giám sát viên |
| Priority | Trung bình |
| Trigger | Giữ nút mic |
| Pre-condition | Trình duyệt cho phép micro; trang `/site-speaker` của camera đang mở và đã "Mở loa" |
| Post-condition | Audio phát tại loa; trạng thái "đã phát" chỉ đặt khi phát thành công |

**Business rule**
- BR-04-1: Tự dừng ghi âm sau 30 giây, không mất bản ghi.
- BR-04-2: Vi phạm nhấp nháy (mất rồi có lại) không được cắt ngang bản ghi.
- BR-04-3: Lỗi phát phải hiện cho người gửi.

## UC-08 Gửi cảnh báo Telegram

| Trường | Nội dung |
|---|---|
| Use case name | Gửi cảnh báo Telegram |
| Use case ID | UC-08 |
| Description | Hệ thống đối chiếu vi phạm mới với quy tắc cảnh báo của công trường và gửi tin nhắn kèm ảnh tới các chat_id |
| Actor | Hệ thống (API), Agent (leo thang) |
| Priority | Cao |
| Trigger | Vi phạm mới được lưu, hoặc agent quyết định leo thang |
| Pre-condition | Bot Telegram đã cấu hình và bật; có quy tắc đang kích hoạt cho công trường |
| Post-condition | Bản ghi `Alert` với `channel=telegram`, `errorMessage` null khi thành công |

**Business rule**
- BR-08-1: Chỉ gửi khi số vi phạm khớp ≥ `threshold` và cách lần gửi thành công gần nhất ≥ `cooldownSec`.
- BR-08-2: Lần đầu (occurrence 1) là nhắc nhở, từ lần 2 là leo thang.
- BR-08-3: Kênh Telegram bắt buộc ≥ 1 chat_id; chat_id chỉ gồm số, dấu `-` đầu cho group.
- BR-08-4: Tên camera / công trường trong tin nhắn phải escape HTML.

## UC-10 Cấu hình bot Telegram (include UC-11 Kiểm tra kết nối bot)

| Trường | Nội dung |
|---|---|
| Use case name | Cấu hình bot Telegram |
| Use case ID | UC-10 |
| Description | Quản trị dán bot token, kiểm tra kết nối, bật cảnh báo |
| Actor | Quản trị tổ chức, Quản trị hệ thống |
| Priority | Cao (điều kiện của UC-08) |
| Trigger | Mở Cài đặt → Thông báo |
| Pre-condition | Có `TELEGRAM_ENCRYPT_KEY` trên server |
| Post-condition | `TelegramSettings` lưu token mã hoá AES-256-GCM, `isEnabled` theo switch |

**Business rule:** token không bao giờ trả lại client (chỉ `hasToken`); kiểm tra bằng `getMe` trước khi tin dùng.

## UC-12 Quản lý quy tắc cảnh báo

| Trường | Nội dung |
|---|---|
| Use case name | Quản lý quy tắc cảnh báo |
| Use case ID | UC-12 |
| Description | Tạo, sửa, bật tắt, xoá quy tắc theo công trường |
| Actor | Quản trị tổ chức; Quản lý công trường trên site được gán |
| Priority | Cao |
| Trigger | Cài đặt → Thông báo → Quy tắc cảnh báo |
| Pre-condition | Có công trường; có bot Telegram nếu chọn kênh Telegram |
| Post-condition | `AlertRule` lưu với `violationTypes`, `channels`, `recipients`, `threshold`, `cooldownSec`, `isActive` |

**Business rule:** `threshold` ≥ 1, `cooldownSec` ≥ 0; API từ chối site ngoài quyền (`assertSiteAccess`); không đổi `siteId` khi sửa.

## UC-13 Thêm camera thật · UC-14 Gán video mẫu

| Trường | UC-13 | UC-14 |
|---|---|---|
| Description | Thêm camera với nguồn `webcam:N` hoặc `rtsp://` | Chọn video đã tải làm nguồn `video:<tên>` |
| Actor | Quản trị tổ chức | Quản trị tổ chức |
| Priority | Cao | Trung bình (demo, kiểm thử) |
| Trigger | Cài đặt → Giám sát → Thêm / Sửa camera | Cùng dialog, chọn "Video mẫu" |
| Pre-condition | Có công trường | Video ≤ 200MB, tên không chứa `../` |
| Post-condition | `Camera` trạng thái `ONLINE`; AI engine mở luồng; agent thăm dò | `rtspUrl = video:<tên>`; `camera-videos.json` đồng bộ |

**Business rule:** trạng thái khác `ONLINE` thì AI bỏ qua; đổi nguồn tạo `health.probe`.

## UC-16 Quét sức khoẻ hệ thống (extend UC-17 Tự khắc phục, UC-18 Leo thang)

| Trường | Nội dung |
|---|---|
| Use case name | Quét sức khoẻ hệ thống |
| Use case ID | UC-16 |
| Description | Mỗi 60 giây agent thu thập tín hiệu camera, engine, bridge, đĩa, model; phát hiện thì khắc phục trong giới hạn hoặc leo thang |
| Actor | Agent (lane trực tiếp) |
| Priority | Cao |
| Trigger | Task `health.sweep` đến hạn (tự lên lịch lại, không trùng) |
| Pre-condition | Agent chạy; DB truy cập được (không cần `ANTHROPIC_API_KEY`) |
| Post-condition | `AgentEvent type=health` ghi kết quả; hành động (đổi trạng thái camera, khởi động lại engine, dọn snapshot) chỉ khi kill switch bật và trong `LIMITS` |

**Business rule**
- BR-16-1: Phát hiện: `camera.stalled`, `camera.recovered`, `engine.stalled` (heartbeat quá hạn), `bridge.down` (3 lần liên tiếp), `disk.pressure`, `model.missing`.
- BR-16-2: Kill switch tắt → chỉ ghi sức khoẻ, không hành động.
- BR-16-3: Vượt giới hạn tần suất → tạo `ops.escalate` cho lane nghiên cứu (cần Claude) hoặc ghi nhận nếu không có key.
- BR-16-4: Dọn snapshot chỉ xoá file cũ vượt `SNAPSHOT_MAX_MB`, không xoá ảnh của vi phạm `open`.

## UC-09 / UC-22 Hỏi agent

| Trường | Nội dung |
|---|---|
| Description | Người dùng gửi câu hỏi tự nhiên về một vi phạm, camera, công trường hoặc toàn hệ thống; agent trả lời bằng dữ liệu đọc qua tool |
| Actor | Mọi vai trò đăng nhập (trong modal); SUPER_ADMIN, ORG_ADMIN, SITE_MANAGER (trang `/agent`) |
| Priority | Trung bình |
| Trigger | Gửi câu hỏi |
| Pre-condition | Kill switch bật, có `ANTHROPIC_API_KEY`, còn trần token |
| Post-condition | `AgentEvent message.user` và `message.assistant` cùng `sessionId`; hỏi tiếp nối cùng phiên |

**Business rule:** agent chỉ đọc, không đổi dữ liệu khi trả lời câu hỏi; phiên im lặng 90 giây coi là kết thúc; hết trần token phải báo lý do (tồn đọng: hiện chưa hiện lý do trên panel).

## UC-20 Bật / tắt và cấu hình agent

| Trường | Nội dung |
|---|---|
| Description | Bật kill switch, chọn model, độ kỹ review, trần token / ngày, giờ báo cáo ca |
| Actor | Quản trị tổ chức, Quản trị hệ thống |
| Trigger | Trang `/agent` |
| Post-condition | `AgentSettings` (1 dòng, id cố định) cập nhật; agent đọc lại ở tick kế tiếp (≤ 20 giây) |

## UC-28 Cấu hình subagent camera

| Trường | Nội dung |
|---|---|
| Use case name | Cấu hình subagent camera |
| Use case ID | UC-28 |
| Description | Quản trị bật / tắt subagent của từng camera, đặt nhịp tổng hợp và trần token riêng, xem và xoá trí nhớ camera, hoặc yêu cầu tổng hợp ngay |
| Actor | Quản trị tổ chức, Quản trị hệ thống; Quản lý công trường chỉ được "Tổng hợp ngay" trong công trường được gán |
| Priority | Trung bình |
| Trigger | Mục "Subagent theo camera" trên trang `/agent`, hoặc tab Agent trong modal camera (chỉ xem) |
| Pre-condition | Đăng nhập, camera nằm trong phạm vi site được phép |
| Post-condition | `CameraAgent` được upsert; `AgentEvent action { action: 'camera-agent.settings', changes, userId }` được ghi; "Tổng hợp ngay" xếp `AgentTask kind=camera.digest` và trả `taskId` |

**Business rule:** kill switch toàn cục thắng mọi thứ, tắt subagent chỉ ảnh hưởng camera đó (vi phạm của camera tắt vẫn được ghi nhận là "bỏ qua" kèm lý do). Trần token camera mặc định 300.000/ngày, kiểm **sau** trần toàn cục 2.000.000/ngày; chạm trần thì phiên của camera đó dừng tới nửa đêm. `remember_camera` tối đa 3 lần/phiên; trí nhớ giữ tối đa 20 ghi chú, mỗi ghi chú ≤ 300 ký tự, ghi chú cũ nhất bị đẩy ra. Mọi thay đổi cài đặt subagent camera đều ghi `AgentEvent action` kèm `userId`.

## Use case danh mục (rút gọn)

| ID | Use case | Actor | Trigger | Post-condition | Business rule |
|---|---|---|---|---|---|
| UC-23 | Đăng nhập | Mọi vai trò | Mở `/login` | Session JWT có vai trò | Sai → lỗi chung; chưa đăng nhập → chuyển hướng `/login` |
| UC-24 | Quản lý công trường | Quản trị | `/sites` | Site tạo với `SETUP` | Sửa / xoá: P2 |
| UC-25 | Quản lý camera | Quản trị | Cài đặt → Giám sát | Camera CRUD | Xoá camera xoá vi phạm liên quan |
| UC-26 | Quản lý người dùng | Quản trị | `/users` | Vai trò, site gán, xoá | Tạo mới: P2 |
| UC-27 | Xem bảng điều khiển và phân tích | Theo ma trận | `/`, `/analytics` | Biểu đồ tính từ vi phạm thật | Tỉ lệ tuân thủ suy từ số vi phạm (P2 đổi cách tính) |
