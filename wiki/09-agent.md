# 09 — Agent giám sát tự động

Tiến trình thứ 4 (`agent/`, port nội bộ **4002**), chạy song song Next.js/Bridge/AI Engine
qua `npm run dev`. Không có UI riêng ngoài dashboard — mọi thao tác đi qua hàng đợi
`AgentTask` trong cùng SQLite. Nguồn thiết kế đầy đủ:
`docs/superpowers/specs/2026-09-07-safesight-agent-design.md`.

## Vai trò

Ba vai trò trong một worker:

1. **Trực vận hành** (lane trực tiếp, tất định, không dùng model) — phát hiện camera đứng,
   AI engine đứng, bridge chết, đĩa đầy, thiếu model; tự khắc phục trong giới hạn tần suất.
2. **Cán bộ an toàn** (lane nghiên cứu, Claude Tool Runner) — review từng vi phạm bằng
   snapshot + lịch sử, phán quyết theo ledger bằng chứng, leo thang Telegram, digest theo
   camera, báo cáo ca.
3. **Trợ lý hỏi đáp** — tab Agent trên vi phạm/camera/site, trang `/agent`, thread hỏi đáp
   trên nền `AgentEvent`.

Agent có **toàn quyền** trong rào chắn của code — không có bước người duyệt; band bằng
chứng quyết định hành động (xem "Bằng chứng và band").

## Hai lane và hàng đợi

`claimDue(limit, lane)` lấy các `AgentTask` `finishedAt IS NULL AND dueAt <= now AND
(leasedUntil IS NULL OR leasedUntil < now) AND attempts < 3`, sắp theo `priority DESC, dueAt
ASC`. Lane trực tiếp lấy 20 row/vòng, nghiên cứu 2 row/vòng, chạy tuần tự.
`scheduleTask()` gộp trùng theo `kind + subject`; `retireExhausted()` đóng task hết 3 lần
thử với outcome nêu rõ.

| Kind | Lane | Ưu tiên | Ai tạo | Chu kỳ / trigger |
|---|---|---|---|---|
| `health.sweep` | trực tiếp | 900 | agent tự gieo lúc khởi động | lặp 60s (task mới với `dueAt = now+60s` khi xong) |
| `health.probe` | trực tiếp | 800 | `PATCH /api/cameras/[id]` đổi nguồn/trạng thái | một lần |
| `snapshot.cleanup` | trực tiếp | 100 | `health.sweep` khi `disk.pressure` | theo nhu cầu |
| `ask` | nghiên cứu | 500 | panel (`/api/agent/ask`) | theo người dùng |
| `violation.review` | nghiên cứu | 300 | `POST /api/violations` | mỗi vi phạm chốt |
| `ops.escalate` | nghiên cứu | 250 | `health.sweep` khi không tự xử được | theo nhu cầu |
| `shift.report` | nghiên cứu | 200 | agent tự gieo theo `shiftReportAt` | 1 lần/ngày |
| `camera.digest` | nghiên cứu | 50 | `violation.review` qua `schedule_followup` | agent tự hẹn, 5–1440 phút |
| `followup` | nghiên cứu | 0 | tool `schedule_followup` | theo lý do agent nêu |

`// ponytail: SQLite không có FOR UPDATE SKIP LOCKED; một worker duy nhất. Nhiều worker
hoặc Postgres thì thay claimDue bằng câu SQL của CRM lib/tasks.ts.`

## Bằng chứng và band

`ObservationKind` là danh sách đóng, mỗi kind có `weight`, `primary`, `label`:

| Kind | weight | primary | Ý nghĩa |
|---|---|---|---|
| `snapshot.no-person` | 0.95 | ✓ | Không có người trong khung đỏ (vật/bóng/xe) → báo oan |
| `snapshot.ppe-visible` | 0.90 | ✓ | Món bị báo thiếu nhìn thấy rõ trên đúng người |
| `snapshot.ppe-clearly-missing` | 0.90 | ✓ | Thấy rõ người và thấy rõ thiếu |
| `track.confirmed-repeat` | 0.70 | ✓ | `occurrenceCount ≥ 2` cùng người |
| `history.camera-false-positive-prone` | 0.40 | | Camera có tỉ lệ báo oan > 50% trong 7 ngày |
| `snapshot.occluded-or-backlit` | 0.35 | | Che khuất/ngược sáng, không kết luận được |
| `snapshot.person-outside-work-zone` | 0.50 | | Người đi đường phía nền |
| `contradiction` | −0.60 | | Bằng chứng mâu thuẫn nhau |

`scoreEvidence()` (`agent/lib/evidence.ts`):

1. Trùng kind bị loại trước (`new Set`) — cùng một quan sát nêu hai lần không cộng dồn.
2. Mỗi chiều gộp riêng: `fp = 1 − Π(1 − w)` cho các kind chiều báo oan, `vi` tương tự cho
   chiều vi phạm.
3. Phán quyết là chiều điểm cao hơn, và `điểm = max(fp, vi) − min(fp, vi) × 0.5` — chiều
   thua bị trừ nửa điểm chứ không bị bỏ qua.
4. Mỗi `contradiction` nhân điểm với `(1 − 0.6)`.
5. `fp === vi` (kể cả cả hai = 0) → `undecided`, `band = null`; riêng trường hợp chỉ có
   `contradiction` mà không có quan sát định hướng nào thì rationale nói rõ điều đó.

Band: `VERIFIED ≥ 0.85` **và** chiều thắng có ≥ 1 kind `primary`; `PROBABLE ≥ 0.55`;
`POSSIBLE ≥ 0.3`; dưới nữa → `band = null`.

Hành động theo band (toàn quyền, không người duyệt):
- `VERIFIED` báo oan → `Violation.status = false_positive`, ghi `agentReview`.
- `VERIFIED` thật → giữ `open`, ghi `agentReview`; `escalate` được mở nếu
  `occurrenceCount ≥ 2` hoặc `severity = critical` (theo AlertRule threshold/cooldown).
- `PROBABLE`/`POSSIBLE` → chỉ ghi `agentReview` + `write_note`, thường kèm
  `schedule_followup`; **không** đổi trạng thái, **không** escalate.
- Không bao giờ ghi đè trạng thái do người đặt (`resolved`, `under_review` do user) —
  `record_verdict` kiểm tra `status` hiện tại, chỉ đổi khi đang `open`.

## Rào chắn

Kiểm tra trong code trước khi tool ghi chạy (`agent/lib/guard.ts`):

- **Kill switch:** `AgentSettings.isEnabled = false` → tool ghi có tác dụng ra ngoài
  (`record_verdict`, `escalate`, `schedule_followup`) trả `{ blocked: … }`; lane trực tiếp
  chỉ ghi event và `snapshot.cleanup` không xoá file nào. `write_note` **vẫn chạy**: nó chỉ
  ghi nhận vào nhật ký agent, không đụng tới dữ liệu vận hành.
- **Tần suất:** `escalate` theo AlertRule cooldown; `record_verdict` 1 lần/vi phạm/phiên;
  `schedule_followup` tối đa 3/phiên; sweep: đổi trạng thái camera 1/5 phút/camera,
  SIGTERM engine 3/giờ.
- **Không bao giờ:** không có tool xoá bản ghi, sửa User/role/AlertRule/TelegramSettings,
  đổi `rtspUrl`, sửa ngưỡng nhận diện, đọc/ghi file ngoài `public/snapshots`, gọi mạng ngoài
  Anthropic và Telegram.
- **Trần token:** vượt `AgentSettings.dailyTokenCap` (mặc định 2 000 000) → lane nghiên cứu
  tạm dừng tới 0h, task giữ nguyên `dueAt`; lane trực tiếp không bị ảnh hưởng.
- Bị chặn → tool trả kết quả có lý do (không `is_error`) để model viết lại thay vì thử lại.

## Tool (`agent/tools/*.ts`, mỗi file một tool)

| Tool | Loại | Input | Trả về |
|---|---|---|---|
| `read_violation` | đọc | `violationId` | ảnh snapshot, bbox, type, severity, confidence, occurrenceCount, status, `agentReview` cũ, **cameraId, siteId** |
| `read_camera_history` | đọc | `cameraId, hours (24/168)` | vi phạm (id, type, status, detectedAt), tỉ lệ `false_positive`, giờ cao điểm, sức khoẻ gần nhất, **siteId** |
| `read_site_context` | đọc | `siteId` | site, camera (id, name, status), AlertRule bật, số người nhận Telegram |
| `search_violations` | đọc | `cameraId?/siteId?/type?/status?/from?/to?/limit` | danh sách id + tóm tắt; không fuzzy |
| `read_agent_activity` | đọc | `hours` | task đã xong/đang chờ, phán quyết gần đây, sweep gần nhất |
| `read_system_health` | đọc | — | kết quả `health.sweep` gần nhất, capabilities |
| `record_verdict` | ghi | `violationId, observations: ObservationKind[], note` | `{ band, applied: bool, statusNow }` |
| `escalate` | ghi | `violationId, caption` | `{ sent, blockedReason? }` |
| `schedule_followup` | ghi | `kind ("followup"\|"camera.digest"), subjectType, subjectId, minutes (5..1440), reason (≥10 ký tự)` | `{ dueAt }` |
| `write_note` | ghi | `subjectType, subjectId, note` | `{ ok }` |

Bộ tool cho từng kind: `violation.review` = tất cả trừ `read_agent_activity`;
`camera.digest`/`shift.report`/`ops.escalate` = đọc + `write_note` + `escalate`
(`ops.escalate` chỉ `escalate` với caption vận hành, không `record_verdict`);
`ask` = tất cả. Tool set cố định theo kind để cache prompt không vỡ.

## Skill (`agent/skills/*.md`, nạp vào system prompt)

- `evidence.md` — từng `ObservationKind`, khi nào dùng, vì sao không có confidence.
- `ppe-review.md` — mũ chỉ tính khi ở vùng đầu; găng/giày là lớp yếu (oan 6–9%) nên cần
  bằng chứng primary mới kết luận; model không có lớp `no_vest`; người nền; ngược sáng.
- `escalation.md` — lần 1 là nhắc nhở, từ lần 2 là vi phạm; không spam; caption ngắn có
  camera, món thiếu, lần thứ mấy.
- `data-boundaries.md` — không suy đoán danh tính người, không mô tả đặc điểm cá nhân ngoài
  PPE, không gửi ảnh/đoạn văn ra ngoài ngoài Telegram đã cấu hình.

## Panel

Route Next.js mới, tất cả bắt buộc đăng nhập, đọc DB thật, không gọi model:
- `GET /api/agent/tasks?status=open|done&subjectType&subjectId`
- `GET /api/agent/events?sessionId|subjectType&subjectId&since`
- `GET|PATCH /api/agent/settings` (SUPER_ADMIN/ORG_ADMIN)
- `POST /api/agent/ask { subjectType?, subjectId?, sessionId?, message }` → ghi
  `AgentEvent message.user`, tạo/nối `AgentTask kind=ask` với `sessionId`, poke agent, trả
  `sessionId`. Panel poll `/api/agent/events?sessionId` mỗi 2s tới khi thấy
  `session.ended` hoặc im lặng 90s.

Bridge Next → agent: `POST http://127.0.0.1:${AGENT_PORT}/internal/dispatch` và
`/internal/ask`, header `Authorization: Bearer ${AGENT_BRIDGE_SECRET}`; thiếu secret ở
Next thì **không gọi** (task vẫn nằm trong DB, agent tự nhặt ở vòng sau); thiếu ở agent
thì trả 401.

UI:
- `ViolationDetailModal` — tab "Agent": band, observations (nhãn tiếng Việt), note, thời
  điểm, nút "Hỏi agent" mở thread trong tab.
- `LiveEventModal` (camera) và `SiteDetailModal` — khối "Agent": nhận xét gần nhất, task
  chờ, sức khoẻ.
- Trang `/agent` (menu "Agent", quyền SUPER_ADMIN/ORG_ADMIN/SITE_MANAGER trong
  `PAGE_ROLES`): dòng thời gian `AgentEvent`, hàng đợi task, sweep gần nhất, cài đặt
  (bật/tắt, model, trần token, giờ báo cáo), ô hỏi toàn hệ thống, capabilities.
- Hook React Query `src/hooks/use-agent.ts`: `useAgentTasks`, `useAgentEvents` (poll khi
  thread đang chạy), `useAgentSettings`, `useSaveAgentSettings`, `useAskAgent`.

## Env và chạy

```bash
npm run dev:agent    # chạy riêng agent/main.ts (tsx)
npm run test:agent   # node --test agent/test/*.test.ts trên SQLite tạm
```

| Biến | Bắt buộc | Ghi chú |
|---|---|---|
| `ANTHROPIC_API_KEY` | tuỳ chọn | Thiếu thì chỉ chạy lane trực tiếp (trực vận hành); lane nghiên cứu tắt |
| `AGENT_BRIDGE_SECRET` | bắt buộc để poke/ask | Next gọi `POST http://127.0.0.1:4002/internal/*`; thiếu ở Next thì không gọi (task vẫn nằm hàng đợi), thiếu ở agent thì route trả 401 |
| `AGENT_PORT` | tuỳ chọn | Mặc định `4002` |
| `SNAPSHOT_MAX_MB` | tuỳ chọn | Mặc định `2048` — ngưỡng `disk.pressure` cho `public/snapshots` |

`npm run dev` (`dev-all.sh`) tự chạy agent là tiến trình thứ 4, sau bridge và trước Next.
Lúc khởi động in 4 dòng `[agent] on/off <capability> (<nguồn>)` rồi `✅ Agent HTTP nội bộ:
http://127.0.0.1:4002`.

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách kiểm tra |
|---|---|---|
| Task nghiên cứu xong ngay với outcome nhắc "không có ANTHROPIC_API_KEY" | Thiếu key, lane nghiên cứu tắt (đúng thiết kế, không phải lỗi) | Thêm `ANTHROPIC_API_KEY` vào `.env.local` rồi khởi động lại agent |
| Panel/API trả `401` khi poke agent | `AGENT_BRIDGE_SECRET` ở Next và ở agent lệch nhau | So `.env.local` của cả hai tiến trình (cùng biến, cùng giá trị) |
| Task nằm mãi ở trạng thái "chờ" | Agent không chạy hoặc đã treo | `curl 127.0.0.1:4002/health`; nếu không phản hồi, khởi động lại `npm run dev:agent` |

---
🏠 Về [Trang chủ wiki](README.md) · Liên quan: [Cài đặt & vận hành](03-cai-dat-va-van-hanh.md) · [Giao diện & API](05-giao-dien-va-api.md)
