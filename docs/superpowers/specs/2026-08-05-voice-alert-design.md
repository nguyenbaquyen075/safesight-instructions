# Voice Alert (Mic → Loa) — Design

Date: 2026-08-05
Status: Approved by user, ready for implementation plan

## Problem

Trang `/cameras` hiện chỉ hiển thị vi phạm bằng khung đỏ. Người giám sát không có cách nào cảnh báo trực tiếp bằng giọng nói tới công nhân đang vi phạm. Cần thêm nút mic trên camera đang vi phạm, cho phép ghi âm và phát ra loa — có 2 chế độ:

- **Demo** — phát lại ngay tại chỗ (một máy, không cần thiết bị thứ hai).
- **Thật** — gửi tới một trang "Loa công trường" đang mở ở thiết bị khác, đại diện cho loa tại camera đó.

## Scope

In scope:
- Nút mic trên camera card đang có `hasViolation === true` (trang `/cameras`, khối grid đã có sẵn từ tính năng lọc vi phạm).
- Ghi âm bằng `MediaRecorder` + `getUserMedia` (API trình duyệt chuẩn, không thêm dependency).
- Công tắc chế độ toàn cục (Demo / Thật) đặt cạnh nút lọc "chỉ vi phạm" đã có.
- 1 sự kiện Socket.IO relay mới trong `ai-engine/yolo_bridge.js` để chuyển audio giữa 2 client.
- Trang mới `/site-speaker` (trong khu vực đã đăng nhập) — chọn 1 camera, tự phát audio gửi tới camera đó.

Out of scope (mặc định bỏ, nói rõ nếu cần sau):
- Lưu lịch sử ghi âm (DB/localStorage) — chỉ phát tức thời.
- Âm thanh 2 chiều thật sự liên tục (walkie-talkie giữ kết nối) — mỗi lần bấm là 1 đoạn ghi rời rạc, gửi sau khi dừng.
- Xác thực ai đang đứng ở "Loa công trường" khớp đúng người — dựa vào NextAuth hiện có (đăng nhập là đủ).
- Nhiều người cùng broadcast cùng lúc tới 1 camera (không xử lý tranh chấp, ai gửi sau thì phát sau).

## Architecture

```
[CameraCard mic button] --(MediaRecorder)--> Blob
        |
        | mode = Demo            | mode = Thật
        v                        v
  phát ngay <audio>        socket.emit('voice-broadcast',
  tại chỗ (local)            { cameraId, mimeType, audio: ArrayBuffer })
                                   |
                                   v
                        yolo_bridge.js relay
                        io.to(`camera-${cameraId}`)
                          .emit('voice-broadcast', ...)
                                   |
                                   v
                     [/site-speaker page đã subscribe
                      đúng camera đó] --> phát <audio>
```

Không cần lưu trạng thái phía server — bridge chỉ relay, giống hệt cách `yolo-data` đang hoạt động.

## Components

### 1. `useVoiceRecorder` hook (mới) — `src/hooks/useVoiceRecorder.ts`

- API: `{ isRecording, error, start(), stop(): Promise<Blob> }`.
- Dùng `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`.
- Tự động `stop()` sau 30s nếu chưa dừng thủ công (safety timeout).
- `error` set khi permission bị từ chối hoặc `MediaRecorder`/`getUserMedia` không tồn tại (trình duyệt không hỗ trợ) — không throw, để UI tự hiển thị.
- Không phụ thuộc React Context, dùng độc lập trong bất kỳ component nào cần ghi âm (camera card, sau này nếu cần chỗ khác).

### 2. `MicButton` component (mới) — `src/components/cameras/MicButton.tsx`

- Props: `{ cameraId: string; mode: 'demo' | 'broadcast' }`.
- Dùng `useVoiceRecorder`. Bấm 1 = `start()`, icon chuyển đỏ/nhấp nháy. Bấm lại = `stop()`.
- Sau khi có `Blob`:
  - `mode === 'demo'` → tạo `Audio(URL.createObjectURL(blob))`, `.play()`.
  - `mode === 'broadcast'` → đọc `Blob` thành `ArrayBuffer`, `socket.emit('voice-broadcast', { cameraId, mimeType: blob.type, audio: arrayBuffer })` qua socket dùng chung với `useYolo`.
- Hiển thị lỗi ngắn gọn (toast nhỏ hoặc text đỏ dưới icon) nếu `error` có giá trị.

### 3. Sửa `src/app/(dashboard)/cameras/page.tsx`

- Thêm state `voiceMode: 'demo' | 'broadcast'` (mặc định `'demo'`).
- Thêm toggle UI cạnh nút lọc vi phạm hiện có: "Chế độ mic: Demo | Thật".
- Trong card đang `hasViolation`, render `<MicButton cameraId={cam.id} mode={voiceMode} />`.

### 4. Sửa `ai-engine/yolo_bridge.js`

Thêm trong `io.on('connection', ...)`:

```js
socket.on('voice-broadcast', ({ cameraId, audio, mimeType }) => {
  io.to(`camera-${cameraId}`).emit('voice-broadcast', { cameraId, audio, mimeType });
});
```

Dùng lại room `camera-${cameraId}` đã có sẵn từ `subscribe-camera` — không cần room mới.

### 5. Trang mới `src/app/(dashboard)/site-speaker/page.tsx`

- Dropdown chọn 1 camera trong `mockCameras` (online).
- Khi chọn, mở socket tới `NEXT_PUBLIC_YOLO_SERVER_URL`, `emit('subscribe-camera', cameraId)`.
- Lắng nghe `voice-broadcast`: dựng lại `Blob` từ `ArrayBuffer` + `mimeType`, phát qua `<audio autoPlay>`.
- Hiển thị trạng thái kết nối (giống `LiveLog`/`isConnected` pattern đã có trong `useYolo`).
- Thêm link trong sidebar nav (cạnh mục "Camera") nếu có menu component chung — kiểm tra lúc viết plan.

## Data flow (bản Thật)

1. Admin mở `/cameras`, bấm mic trên camera "Cổng chính - Entrance A" (đang vi phạm), chế độ = Thật.
2. Nói, bấm dừng → `Blob` audio ~vài giây.
3. Client emit `voice-broadcast` kèm `cameraId: 'cam-001'`.
4. Bridge relay tới room `camera-cam-001`.
5. Máy tính bảng tại công trường mở `/site-speaker`, đã chọn camera "Cổng chính - Entrance A" (nên đã `subscribe-camera('cam-001')`) → nhận event, phát audio.

## Error handling

- Trình duyệt không hỗ trợ mic (Safari cũ, http không secure context, v.v.) → `MicButton` hiện icon mic gạch chéo + tooltip lý do, không crash.
- Người dùng từ chối quyền mic → thông báo ngắn "Cần cấp quyền micro để dùng tính năng này".
- Socket mất kết nối khi đang gửi broadcast → dùng lại cơ chế reconnect có sẵn của `useYolo`/socket.io-client; nếu gửi thất bại, hiện lỗi, không crash trang.
- `/site-speaker` chưa chọn camera nào → không subscribe, không phát gì, hiện trạng thái "Chưa chọn camera".

## Testing

- Không có test framework tự động cho phần UI trình duyệt (mic/audio) trong repo hiện tại — theo pattern hiện có của `/cameras`.
- Thủ công: chạy `npm run dev`, mở 2 tab (`/cameras` và `/site-speaker`), chọn cùng 1 camera, bấm mic ở chế độ Thật, xác nhận tab kia phát ra đúng đoạn ghi âm.
- Thủ công: chế độ Demo, xác nhận phát lại đúng ngay trên tab `/cameras`, không cần tab thứ hai.
- Kiểm tra lỗi permission: từ chối quyền mic trong Chrome, xác nhận không crash, hiện thông báo.
