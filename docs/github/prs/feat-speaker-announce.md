## Tóm tắt
- Khi agent chốt vi phạm **VERIFIED thật**, loa của camera tự đọc câu nhắc tiếng Việt ("Khu vực cẩu tháp 1, vui lòng đội mũ bảo hộ") — không cần người bấm mic.
- Người dùng cũng phát tay bằng nút **"Phát loa"** trong modal vi phạm; trang `/site-speaker` có nút "Thử loa" và danh sách 10 thông báo gần nhất.

## Issue
Closes #<n>

## Thay đổi chính
- `ai-engine/yolo_bridge.js`: `POST /announce { cameraId, text }` (xác thực `X-AI-Engine-Secret` như `/detections`, kiểm kiểu và độ dài 1–200) → `voice-announce` tới room `camera-<id>`, trả `{ ok, listeners }`.
- `/site-speaker`: nghe `voice-announce`, `speechSynthesis` `vi-VN` rate 0.95 (huỷ câu đọc dở trước khi đọc câu mới), cảnh báo khi trình duyệt không hỗ trợ, "Thử loa", 10 thông báo gần nhất.
- `src/lib/announce-shape.ts` (`announcementFor`, bảng hành động theo loại vi phạm, ≤ 200 ký tự), `src/lib/announce.ts` (gọi bridge, timeout 3 s), route `POST /api/cameras/[id]/announce` (session + `assertSiteAccess`, `AuditLog`), hook `useAnnounceCamera`, nút trong `ViolationDetailModal`.
- Agent: tool `announce` (chỉ 4 kind `violation.review`/`followup`/`camera.instruction`/`ask`, thêm ở cuối toolset; cần phán quyết VERIFIED thật cho camera; `LIMITS.announcePerSession = 2`, cooldown 60 s/camera, kill switch; chỉ trừ hạn mức khi bridge trả ok), OPENING `violation.review`, `env.aiEngineSecret`.

## Kiểm thử
- [x] `agent/test/*.test.ts` 197/197 (`announce.test.ts` 9 test, viết RED trước)
- [x] `npx tsc --noEmit` · `npx eslint .` · `node --check ai-engine/yolo_bridge.js`
- [ ] Kiểm tra hình ảnh desktop/mobile và bridge chạy thật — hoãn tới sau khi gộp

## Tài liệu
wiki/02, wiki/03 + README (env `YOLO_BRIDGE_URL`, `AI_ENGINE_SECRET` dùng thêm cho dashboard/agent), wiki/05 (route + sự kiện socket), wiki/09 (tool, LIMITS), docs/ba/04 F-VOICE-03, CHANGELOG.

## Rủi ro và việc còn lại
- `listeners` từ `io.sockets.adapter.rooms` chưa kiểm với client thật.
- Quyền phát loa = session + phạm vi site (như trang mic hiện tại); siết theo vai trò nếu cần.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
