# Subagent giám sát theo camera — thiết kế

Ngày: 2026-09-08. Trạng thái: đã duyệt hai câu hỏi chính (mô hình có trí nhớ riêng; nhịp theo sự kiện + tổng hợp định kỳ). Nền: agent hiện có (`docs/superpowers/specs/2026-09-07-safesight-agent-design.md`, `wiki/09-agent.md`).

## 1. Mục tiêu
Mỗi camera có một **subagent** riêng: bật/tắt riêng, trí nhớ riêng (những gì đã học về camera đó), ngân sách token riêng, tổng hợp định kỳ riêng; các subagent chạy song song trong cùng worker `agent/`. Người quản lý thấy từng subagent trên trang `/agent` và trong modal camera.

Không đổi: lane trực vận hành (tất định, 60s), hàng đợi `AgentTask`, tool runner, kill switch toàn cục, trần token toàn cục (vẫn là trần trên cùng).

## 2. Dữ liệu
```prisma
model CameraAgent {
  id              String   @id            // = Camera.id
  isEnabled       Boolean  @default(true)
  memory          String   @default("[]") // JSON: [{ at, text, sessionId }], tối đa 20, text ≤ 300 ký tự
  digestEveryMin  Int      @default(30)
  dailyTokenCap   Int      @default(300000)
  tokensUsedToday Int      @default(0)
  usageDay        String   @default("")   // "YYYY-MM-DD" theo giờ địa phương; khác ngày thì reset tokensUsedToday
  lastDigestAt    DateTime?
  updatedAt       DateTime @updatedAt
}
```
Tạo lười (upsert) khi lần đầu có task của camera đó. Xoá camera → xoá CameraAgent (xoá tường minh trong `DELETE /api/cameras/[id]`; không dùng quan hệ Prisma để giữ SQLite đơn giản).

## 3. Định tuyến phiên
`agent/lib/camera-agent.ts`:
- `cameraIdOf(task)`: `subjectType=camera` → `subjectId`; `violation` → `Violation.cameraId`; khác → `null` (phiên toàn hệ thống như cũ).
- `getCameraAgent(cameraId)` upsert; `resetUsageIfNewDay`.
- Trong `runSession` (trước khi mở phiên LLM): nếu có cameraId: agent tắt → `skipped('subagent camera <id> đang tắt')`; `tokensUsedToday >= dailyTokenCap` → `SessionError` hoãn qua nửa đêm, `refundAttempt`. Trần toàn cục kiểm trước, trần camera kiểm sau.
- Preamble thêm mục `## Trí nhớ camera <id>` (danh sách ghi chú cũ → mới) và câu "Bạn là subagent phụ trách riêng camera này".
- Cuối phiên: cộng `input+output` vào `tokensUsedToday` của camera; `session.started` ghi thêm `cameraId`.

## 4. Tool mới: `remember_camera`
Chỉ có trong phiên có cameraId. Input `{ text ≤ 300, replaceIndex? }`. Ghi/sửa ghi chú trong `memory`; quá 20 thì bỏ ghi chú cũ nhất. Ghi event `action { action: 'remember_camera' }`. Không dùng cho vi phạm cụ thể (đã có `write_note`) — chỉ cho điều **bền** về camera: góc máy, giờ ngược sáng, khu vực hay báo oan, việc cần theo dõi.

## 5. Nhịp và song song
- Review: như cũ (`violation.review` khi có vi phạm mới).
- Digest: `ensureRecurring()` tạo `camera.digest` cho mỗi camera `ONLINE` có subagent bật, `dueAt = lastDigestAt + digestEveryMin` (lần đầu: now + digestEveryMin). Trước khi mở phiên LLM, `hasActivitySince(cameraId, lastDigestAt)` (vi phạm mới hoặc event `health` của camera) — không có thì hoàn tất task với outcome "không có hoạt động mới", cập nhật `lastDigestAt`, không tốn token.
- Song song: `RESEARCH_BATCH = 3`; `claimDue` lane nghiên cứu chỉ nhận **tối đa một task cho mỗi camera** trong một lượt (task thứ hai của cùng camera chờ lượt sau); `tick()` chạy các task nghiên cứu đã claim bằng `Promise.allSettled` (mỗi task một phiên, cùng tiến trình).
- Tool `schedule_followup` với `kind=camera.digest` giữ nguyên (digest thủ công của model).

## 6. API và giao diện
- `GET /api/agent/cameras` (đăng nhập; scope theo `allowedSiteIds`): mỗi camera → `{ cameraId, name, siteId, cameraStatus, isEnabled, digestEveryMin, dailyTokenCap, tokensUsedToday, lastDigestAt, memory[], openViolations, reviewed24h, falsePositiveRate24h }`.
- `PATCH /api/agent/cameras/[id]` (SUPER_ADMIN/ORG_ADMIN): `isEnabled`, `digestEveryMin` (5–1440), `dailyTokenCap` (≥ 0), `clearMemory: true`.
- `POST /api/agent/cameras/[id]/digest` (SUPER_ADMIN/ORG_ADMIN/SITE_MANAGER trong site): tạo `camera.digest` ngay (`scheduleTask` gộp) + poke.
- Trang `/agent`: mục "Subagent theo camera" — lưới thẻ (tên camera, công trường, công tắc bật/tắt, nhịp digest, token hôm nay / trần, digest gần nhất, số vi phạm mở, tỉ lệ báo oan 24h, 3 ghi chú mới nhất, nút "Tổng hợp ngay", nút "Xoá trí nhớ" có xác nhận). Trạng thái tải/trống/lỗi. Token từ `DESIGN.md`.
- `SubjectAgentPanel` (subjectType camera): đầu panel hiện trạng thái subagent + trí nhớ (đầy đủ), dưới là dòng thời gian như cũ.
- Hook `useCameraAgents`, `useSaveCameraAgent`, `useDigestCamera` trong `src/hooks/use-agent.ts`; kiểu trong `src/types/agent.ts`.

## 7. Skill
- Chuẩn: `agent/skills/<name>/SKILL.md`, frontmatter `name` (chữ thường, gạch nối) và `description` (bắt đầu "Dùng khi…", chỉ nêu điều kiện kích hoạt, ngôi thứ ba). Nội dung tiếng Việt. `systemBlocks()` nạp mọi `SKILL.md` (sắp xếp theo tên); `instructions.md` liệt kê bảng skill (name — description).
- Chuyển 4 skill hiện có sang chuẩn này, giữ nội dung.
- Skill mới `remembering-camera-context`: khi nào ghi trí nhớ camera, ghi gì, không ghi gì, định dạng; viết theo quy trình writing-skills (kịch bản không có skill → ghi lại lỗi → viết skill → chạy lại).

## 8. Rào chắn
- Kill switch toàn cục thắng mọi thứ; subagent tắt chỉ ảnh hưởng camera đó (review vi phạm của camera tắt vẫn được ghi nhận là "bỏ qua" với lý do).
- Trần token camera mặc định 300k/ngày; trần toàn cục vẫn 2M.
- `remember_camera` tối đa 3 lần/phiên (`LIMITS.rememberPerSession`).
- Mọi thay đổi cài đặt camera-agent ghi `AgentEvent action` với userId.

## 9. Kiểm thử
- Unit (`agent/test/`): `cameraIdOf`, upsert/reset ngày, trần token camera (refund), skipped khi tắt, `remember_camera` (giới hạn 20 và 3/phiên), `claimDue` một-camera-một-task, `hasActivitySince`, `ensureRecurring` tạo digest đúng `dueAt`, preamble có mục trí nhớ.
- Route: where-builder cho `GET /api/agent/cameras` (scope site) là hàm thuần có test.
- UI: kiểm tra desktop/mobile bằng CDP **khi máy rảnh** (người vận hành không cho chạy app lúc máy quá tải).

## 10. Tài liệu
`wiki/09-agent.md` (mục Subagent theo camera), `wiki/04` (model), `wiki/05` (route, hook), `docs/ba/` (chức năng F-AGENT-08..10, use case UC-28 "Cấu hình subagent camera", ma trận phân quyền, màn hình SCR-10 bổ sung), README mục Agent, CHANGELOG.
