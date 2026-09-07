# SafeSight Agent — Design

Date: 2026-09-07
Status: Approved by user (3 sections reviewed in chat), ready for implementation plan

## Problem

SafeSight hiện phát hiện vi phạm PPE và ghi DB, nhưng mọi thứ sau đó là việc của người:
nhìn snapshot xem có báo oan không, quyết định leo thang, để ý camera nào đứng, AI engine
có còn chạy, đĩa có đầy ảnh không, và tổng hợp cuối ca. Không ai túc trực 24/7 cho mọi
camera. Cần một agent tự động **giám sát và thao tác hệ thống** như một cán bộ an toàn
kiêm trực vận hành, và trả lời được câu hỏi của người dùng trên dashboard.

Mô hình tham chiếu là agent của Comp AI CRM (`~/Projects/crm/crm/apps/agent`, framework
eve): agent là deployment riêng, chạy trên hàng đợi việc của chính nó, tool là file, skill
là markdown, capability tuỳ chọn không bao giờ throw, "bằng chứng chứ không phải
confidence", ngân sách mỗi phiên, audit đầy đủ, panel trên từng bản ghi. Spec này sao chép
**nguyên tắc** đó vào stack của SafeSight (Next.js 16 + npm + Prisma/SQLite + Python), không
đem theo runtime eve/Bun/Postgres/Vercel.

## Scope

In scope (một đợt, chia 5 pha nghiệm thu riêng):
- **Nền**: hàng đợi `AgentTask`, worker `agent/` (tiến trình thứ 4 của `dev-all.sh`),
  audit `AgentEvent`, `AgentSettings`, capabilities, kill switch, ngân sách.
- **Vai trò 1 — Trực vận hành** (lane trực tiếp, tất định, không model): phát hiện camera
  đứng, AI engine đứng, bridge chết, đĩa đầy, thiếu model; tự khắc phục trong giới hạn.
- **Vai trò 2 — Cán bộ an toàn** (lane nghiên cứu, Claude Tool Runner): review từng vi
  phạm bằng snapshot + lịch sử, phán quyết theo ledger bằng chứng, leo thang Telegram,
  digest theo camera, báo cáo ca.
- **Vai trò 3 — Trợ lý hỏi đáp**: tab Agent trên vi phạm/camera/site, trang `/agent`,
  thread hỏi đáp trên nền `AgentEvent`.
- Tài liệu: README, wiki mới `09-agent.md`, cập nhật wiki 02/03/04/05.

Out of scope (nói rõ để không bị hiểu là quên):
- Agent **không** tự chỉnh ngưỡng nhận diện (`PART_MIN_CONF`, `CONFIRM_CONF`…) và không
  đụng file `.pt`/mã nguồn — đó là việc của người và `eval_ppe_decision.py`.
- Phát loa bằng giọng agent (cần TTS server-side, chưa có) — chỉ Telegram.
- Streaming token trong panel — panel poll `AgentEvent` 2 giây/lần.
- Nhiều worker song song / Postgres — thiết kế cho một worker trên SQLite, có ghi chú
  `ponytail:` nêu đường nâng cấp.
- Bảng đề xuất chờ duyệt — người dùng chọn **toàn quyền**; thay vào đó band bằng chứng
  quyết định hành động (xem "Bằng chứng").

## Quyết định đã chốt với người dùng

| Câu hỏi | Quyết định |
|---|---|
| Vai trò | Cả ba: trực vận hành, cán bộ an toàn, hỏi đáp |
| Thứ tự | Một đợt, một spec, một plan chia pha |
| Nền tảng | Worker Node trong repo + Anthropic SDK Tool Runner (không eve, không Claude Agent SDK) |
| Quyền | Toàn quyền, không có bước người duyệt; rào chắn nằm trong code |
| Kiến trúc | Hai lane như CRM: trực tiếp (tất định) và nghiên cứu (model) |
| Model | `claude-opus-5`, adaptive thinking, effort `medium` cho review, `high` cho báo cáo |

## Architecture

```
                 ┌────────────────────────── Next.js (3000) ───────────────────────────┐
                 │ POST /api/violations ─ghi Violation─┐                               │
                 │ PATCH /api/cameras/[id] ────────────┤ ghi AgentTask ─► poke ────────┼──┐
                 │ /api/agent/* (panel, settings, ask) ┘  (fire-and-forget, secret)    │  │
                 └──────────────────────────────────────────────────────────────────────┘  │
                                                                                            ▼
┌─ Prisma/SQLite ──────────┐      ┌──────────────── agent/ (4002) ──────────────────────────────┐
│ AgentTask (hàng đợi)     │◄────►│ main.ts: mỗi 20s claimDue() cho 2 lane                      │
│ AgentEvent (audit+chat)  │      │  lane TRỰC TIẾP  agent/direct/*   tất định, không token     │
│ AgentSettings (1 dòng)   │      │  lane NGHIÊN CỨU agent/session.ts Claude Tool Runner        │
│ Violation.agentReview    │      │ tools/*.ts  skills/*.md  lib/{tasks,evidence,guard,audit}   │
└──────────────────────────┘      │ channels/http.ts: /internal/dispatch, /internal/ask, /health│
                                  └───────────────┬───────────────────────────┬───────────────┘
                                                  │ GET /health               │ heartbeat file, SIGTERM
                                       yolo_bridge.js (4001)          yolo_inference.py (dev-all.sh tự chạy lại)
```

Quy tắc kế thừa từ CRM (`docs/agent.md` của CRM):
1. **Intelligence không nằm trong Next API.** API chỉ ghi row `AgentTask` và poke. Không
   phân loại, không gọi model, không gửi Telegram theo phán đoán trong route.
2. **Schedule không quyết định gì.** Mọi "mỗi N phút" là `dueAt` của một task.
3. **Capability tuỳ chọn, không bao giờ throw.** Thiếu key/bridge/heartbeat = mất một khả
   năng, ghi rõ trong preamble và log lúc khởi động.
4. **Mọi read trả về id lân cận.** Không có ngõ cụt phải hỏi người lấy id.
5. **Bằng chứng, không confidence.** Tool không nhận điểm tự tin.

## Data model (Prisma, thêm vào `prisma/schema.prisma`)

```prisma
model AgentTask {
  id          String    @id @default(cuid())
  kind        String    // xem bảng kinds
  subjectType String?   // "camera" | "violation" | "site" | "system"
  subjectId   String?
  reason      String
  priority    Int       @default(0)
  budget      Int       @default(6)   // số tool call tối đa của phiên nghiên cứu
  attempts    Int       @default(0)
  dueAt       DateTime
  leasedUntil DateTime?
  sessionId   String?
  startedAt   DateTime?
  finishedAt  DateTime?
  outcome     String?
  createdAt   DateTime  @default(now())
  @@index([dueAt, leasedUntil])
  @@index([subjectType, subjectId])
}

model AgentEvent {
  id          String   @id @default(cuid())
  sessionId   String
  taskId      String?
  subjectType String?
  subjectId   String?
  type        String   // "tool.call" | "tool.result" | "verdict" | "action" | "message.user" | "message.assistant" | "health" | "error" | "report" | "session.ended"
  data        String   // JSON string (SQLite)
  emittedAt   DateTime @default(now())
  @@index([sessionId, emittedAt])
  @@index([subjectType, subjectId, emittedAt])
}

model AgentSettings {
  id             String   @id @default(cuid())
  isEnabled      Boolean  @default(true)     // kill switch
  model          String   @default("claude-opus-5")
  reviewEffort   String   @default("medium")
  dailyTokenCap  Int      @default(2000000)
  shiftReportAt  String   @default("17:30")  // HH:mm giờ máy
  updatedAt      DateTime @updatedAt
}
```

`Violation` thêm `agentReview String?` — JSON `{ verdict, band, observations[], note,
sessionId, reviewedAt }`. Không thêm bảng đề xuất.

`AgentConversation` KHÔNG tách bảng: một thread hỏi đáp = một `sessionId` trong
`AgentEvent`; panel liệt kê thread bằng `distinct sessionId where type = "message.user"`.
Nếu về sau cần tiêu đề/đếm tin thì mới tách bảng.

## Task kinds, lane, ưu tiên

| Kind | Lane | Ưu tiên | Ai tạo | Chu kỳ / trigger |
|---|---|---|---|---|
| `health.sweep` | trực tiếp | 900 | agent tự gieo lúc khởi động | lặp 60s (task mới với `dueAt = now+60s` khi xong) |
| `health.probe` | trực tiếp | 800 | `PATCH /api/cameras/[id]` đổi nguồn/trạng thái | một lần |
| `snapshot.cleanup` | trực tiếp | 100 | `health.sweep` khi `disk.pressure` | theo nhu cầu |
| `ask` | nghiên cứu | 500 | panel (`/api/agent/ask`) | theo người dùng |
| `violation.review` | nghiên cứu | 300 | `POST /api/violations` | mỗi vi phạm chốt |
| `ops.escalate` | nghiên cứu | 250 | `health.sweep` khi không tự xử được | theo nhu cầu |
| `shift.report` | nghiên cứu | 200 | agent tự gieo theo `shiftReportAt` | 1 lần/ngày |
| `camera.digest` | nghiên cứu | 50 | `violation.review` qua `schedule_followup` | ≥ 2 giờ/lần/camera |
| `followup` | nghiên cứu | 0 | tool `schedule_followup` | theo lý do agent nêu |

`claimDue(limit, lane)`: `updateMany` các row `finishedAt IS NULL AND dueAt <= now AND
(leasedUntil IS NULL OR leasedUntil < now) AND attempts < 3`, đặt `leasedUntil = now+10m`,
`attempts += 1`. Sắp theo `priority DESC, dueAt ASC`. Lane trực tiếp lấy 20 row/vòng,
nghiên cứu 2 row/vòng, chạy tuần tự.

`// ponytail: SQLite không có FOR UPDATE SKIP LOCKED; một worker duy nhất. Nhiều worker
hoặc Postgres thì thay claimDue bằng câu SQL của CRM lib/tasks.ts.`

`scheduleTask()` gộp trùng: cùng `kind + subject` chưa xong thì cập nhật `dueAt`/`reason`
thay vì tạo mới. `retireExhausted()` đóng task `attempts >= 3` với outcome nêu rõ.

## Lane trực tiếp — Trực vận hành

Tín hiệu, hai điểm thêm vào code sẵn có:
- `ai-engine/yolo_bridge.js`: `GET /health` → `{ lastDetectionAt: { [cameraId]: iso },
  clients: n, uptimeSec }`. Bridge đã nhận `/detections` theo camera nên chỉ ghi nhớ thêm.
- `ai-engine/yolo_inference.py`: ghi `public/snapshots/.heartbeat.json`
  `{ pid, at, streams: n, fps }` mỗi 5s trong vòng lặp chính. `dev-all.sh` bọc python trong
  `until ...; do ...; sleep 2; done` để tự chạy lại khi thoát.

`health.sweep` (agent/direct/sweep.ts) đo và quyết định tất định:

| Phát hiện | Điều kiện | Hành động (trong giới hạn tần suất) |
|---|---|---|
| `camera.stalled` | Camera `ONLINE` trong DB, bridge không có detection > 90s | PATCH `status = degraded`; > 10 phút → `offline`; thấy lại → `online`. Tối đa 1 đổi/5 phút/camera |
| `engine.stalled` | heartbeat cũ > 30s hoặc pid không tồn tại | `SIGTERM` pid (dev-all.sh chạy lại). Tối đa 3 lần/giờ |
| `bridge.down` | `GET /health` lỗi 3 vòng liên tiếp | Ghi event; sau 3 lần → `ops.escalate` |
| `disk.pressure` | `public/snapshots` > `SNAPSHOT_MAX_MB` (mặc định 2048) | Tạo `snapshot.cleanup`: xoá ảnh cũ nhất > 30 ngày có Violation tham chiếu, không bao giờ xoá ảnh < 24h |
| `model.missing` | thiếu `ppe_multiclass.pt` hoặc heartbeat báo model lỗi | `ops.escalate` ngay (không tự xử được) |

Mỗi phát hiện/hành động là một `AgentEvent` kind `health`/`action` với số đo. Cùng một
lỗi lặp 3 lần → Telegram cho admin qua `alert-notifier` (kênh `TELEGRAM`, recipients của
AlertRule có `violationTypes = []` tại site, hoặc `TelegramSettings` nếu không có rule).
Lane này chạy khi không có `ANTHROPIC_API_KEY`.

## Lane nghiên cứu — Cán bộ an toàn và hỏi đáp

### Phiên (agent/session.ts)
- `@anthropic-ai/sdk`: `betaZodTool` + `client.beta.messages.toolRunner({ model,
  max_tokens: 16000, thinking: { type: "adaptive" }, output_config: { effort },
  max_iterations: budget + 2, tools, system, messages })`.
- `system` = `[{ instructions.md }, { skills/*.md ghép }]` với `cache_control` trên khối
  cuối (nội dung tĩnh, không timestamp); preamble theo task đặt trong `messages[0]`.
- Mỗi tool call, kết quả, phán quyết → `AgentEvent`. Kết thúc → `session.ended` với usage
  (`input_tokens`, `cache_read_input_tokens`, `output_tokens`) cộng dồn vào trần ngày.
- Snapshot gửi dạng `image/jpeg` base64 sau khi thu nhỏ cạnh dài về 640px (dùng `sharp`
  đã có qua Next, hoặc bỏ qua thu nhỏ nếu ảnh ≤ 640).
- Vượt `dailyTokenCap` → lane nghiên cứu tạm dừng tới 0h, task giữ nguyên `dueAt`.

### Preamble (agent/lib/preamble.ts)
Mỗi task mở trên đúng một bản ghi và nêu: id vi phạm/camera/site và các id lân cận, lý do
task, ngân sách, `taskKind` (phiên dispatched là một lượt kiểm tra có ngân sách; phiên `ask`
là hội thoại với người — trả lời câu hỏi, không đưa kế hoạch), khối capabilities.

### Tool (agent/tools/*.ts, mỗi file một tool)

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

### Bằng chứng (agent/lib/evidence.ts)

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

`scoreEvidence()` giống CRM: điểm = 1 − Π(1 − w) cho các kind cùng chiều, trừ
contradiction; band `VERIFIED ≥ 0.85 (cần ≥1 primary)`, `PROBABLE ≥ 0.55`, `POSSIBLE ≥ 0.3`.

Hành động theo band (toàn quyền, không người duyệt):
- `VERIFIED` báo oan → `Violation.status = false_positive`, ghi `agentReview`.
- `VERIFIED` thật → giữ `open`, ghi `agentReview`; `escalate` được mở nếu
  `occurrenceCount ≥ 2` hoặc `severity = critical` (theo AlertRule threshold/cooldown).
- `PROBABLE`/`POSSIBLE` → chỉ ghi `agentReview` + `write_note`, thường kèm
  `schedule_followup`; **không** đổi trạng thái, **không** escalate.
- Không bao giờ ghi đè trạng thái do người đặt (`resolved`, `under_review` do user) —
  `record_verdict` kiểm tra `status` hiện tại, chỉ đổi khi đang `open`.

### Skill (agent/skills/*.md, nạp vào system prompt)
- `evidence.md`: từng ObservationKind, khi nào dùng, vì sao không có confidence.
- `ppe-review.md`: mũ chỉ tính khi ở vùng đầu; găng/giày là lớp yếu (oan 6-9%) nên cần
  bằng chứng primary mới kết luận; model không có lớp `no_vest`; người nền; ngược sáng.
- `escalation.md`: lần 1 là nhắc nhở, từ lần 2 là vi phạm; không spam; caption ngắn có
  camera, món thiếu, lần thứ mấy.
- `data-boundaries.md`: không suy đoán danh tính người, không mô tả đặc điểm cá nhân ngoài
  PPE, không gửi ảnh/đoạn văn ra ngoài ngoài Telegram đã cấu hình.

### Rào chắn (agent/lib/guard.ts) — kiểm tra trong code trước khi tool ghi chạy
- Kill switch `AgentSettings.isEnabled = false` → mọi tool ghi trả `{ blocked: "agent is
  paused" }`, lane trực tiếp chỉ ghi event.
- Tần suất: `escalate` theo AlertRule cooldown; `record_verdict` 1 lần/vi phạm/phiên;
  `schedule_followup` tối đa 3/phiên; sweep: đổi trạng thái camera 1/5 phút/camera,
  SIGTERM engine 3/giờ.
- Không tồn tại tool cho: xoá bản ghi, sửa User/role/AlertRule/TelegramSettings, đổi
  `rtspUrl`, sửa ngưỡng nhận diện, đọc/ghi file ngoài `public/snapshots`, gọi mạng ngoài
  Anthropic và Telegram.
- Bị chặn → tool trả kết quả có lý do (không `is_error`) để model viết lại thay vì thử lại.

## Panel và API (Next.js)

Route mới, tất cả bắt buộc đăng nhập, đọc DB thật, không gọi model:
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

UI (tạo `DESIGN.md` trước từ token trong `globals.css` và component `settings/ui.tsx`):
- `ViolationDetailModal`: tab "Agent" — band, observations (nhãn tiếng Việt), note,
  thời điểm, nút "Hỏi agent" mở thread trong tab.
- `LiveEventModal` (camera) và `SiteDetailModal`: khối "Agent" — nhận xét gần nhất, task
  chờ, sức khoẻ.
- Trang `/agent` (menu "Agent", quyền SUPER_ADMIN/ORG_ADMIN/SITE_MANAGER trong
  `PAGE_ROLES`): dòng thời gian `AgentEvent`, hàng đợi task, sweep gần nhất, cài đặt
  (bật/tắt, model, trần token, giờ báo cáo), ô hỏi toàn hệ thống, capabilities.
- Hook React Query: `use-agent.ts` (`useAgentTasks`, `useAgentEvents` với
  `refetchInterval` khi thread đang chạy, `useAgentSettings`, `useAskAgent`).

## Runtime và cấu hình
- `package.json`: `"dev:agent": "node agent/main.ts"`, `"test:agent": "node --test
  agent/test"`; dependency mới: `@anthropic-ai/sdk`. Node ≥ 22.18 (strip types); mã trong
  `agent/` chỉ dùng cú pháp xoá được (không `enum`, không `namespace`).
- `dev-all.sh`: thêm `node agent/main.ts &` sau bridge; python bọc `until`.
- Env (ghi `.env`/README/wiki 03): `ANTHROPIC_API_KEY` (tuỳ chọn), `AGENT_BRIDGE_SECRET`
  (bắt buộc cho poke/ask), `AGENT_PORT=4002`, `SNAPSHOT_MAX_MB=2048`.
- `agent/lib/capabilities.ts` in lúc boot và đưa vào preamble:
  `on/off Claude (ANTHROPIC_API_KEY)`, `Telegram (Settings)`, `Bridge (4001)`,
  `AI engine heartbeat`.
- Prisma: `npx prisma db push` sau khi thêm model (SQLite dev).

## Error handling
- Claude: bắt `RateLimitError` → lùi `dueAt` 60s×attempts; `APIConnectionError` → lùi 30s;
  `AuthenticationError`/`BadRequestError` → task kết thúc với outcome, capability Claude
  `off` tới lần khởi động sau. `stop_reason = refusal` hoặc `max_tokens` → outcome ghi rõ,
  không thử lại quá 3 lần.
- Tool lỗi → `is_error: true` với thông điệp ngắn; phiên tiếp tục.
- Lane trực tiếp: lỗi Prisma/bridge → `AgentEvent error`, chờ vòng sau; không bao giờ làm
  chết worker.
- Worker chết giữa phiên → lease 10 phút hết hạn → task được nhận lại; hành động ghi DB đều
  kiểm tra trạng thái hiện tại nên chạy lại an toàn.
- Task hết `attempts` → `retireExhausted()` với outcome "Bỏ sau 3 lần: phiên không báo
  cáo lại".

## Testing
- `agent/test/*.test.ts` bằng `node --test`, SQLite tạm qua `DATABASE_URL=file:./agent-test.db`:
  ledger bằng chứng; `claimDue`/lease/retire/gộp trùng; guard tần suất và kill switch;
  quyết định sweep từ dữ liệu health giả (5 phát hiện); parse heartbeat; `record_verdict`
  không ghi đè trạng thái do người đặt.
- Phiên Claude: client giả (không mạng) kiểm tra runner nhận đúng tool set theo kind và
  ghi `AgentEvent`; smoke `--live` chỉ khi có key.
- Nghiệm thu thủ công 2 vòng (rule 7/8): 4 tiến trình + video mẫu → vi phạm được review,
  panel hiển thị; desktop và mobile cho `/agent` và các tab mới. **Chạy khi máy tải nhẹ.**

## Phases (một plan, mỗi pha nghiệm thu riêng)
1. Nền: Prisma models, `agent/main.ts`, tasks/lease, audit, capabilities, settings,
   guard, `dev-all.sh`, bridge `/health`, heartbeat python.
2. Trực vận hành: sweep + 5 phát hiện + hành động + escalate qua Telegram.
3. Cán bộ an toàn: tools, ledger, skills, preamble, `violation.review`, poke từ
   `/api/violations`, `camera.digest`, `shift.report`, `ops.escalate`.
4. Panel: `DESIGN.md`, `/api/agent/*`, `/agent`, tab trong modal vi phạm/camera/site,
   thread `ask`.
5. Tài liệu: README, `wiki/09-agent.md`, cập nhật wiki 02/03/04/05, SPEC.md.

## Global constraints
- Định danh code tiếng Anh; copy UI, comment, commit tiếng Việt.
- Không đổi hành vi pipeline AI hiện có ngoài heartbeat + `/health` + vòng `until`.
- Không thêm dependency ngoài `@anthropic-ai/sdk`.
- Tất cả write của agent đi qua Prisma trong tiến trình agent (không HTTP tới Next), trừ
  Telegram dùng `TelegramClient`/`alert-notifier` sẵn có.
- Production sau này chạy artifact build; agent chạy cùng máy AI engine.

## Open questions (không chặn plan)
- Ai nhận Telegram vận hành (`ops.escalate`) khi site chưa có AlertRule? Mặc định: người
  nhận của AlertRule đầu tiên đang bật trong hệ thống; không có thì chỉ ghi event.
- Giờ ca (`shiftReportAt`) một ca hay nhiều ca/ngày? Mặc định một; cần nhiều thì đổi thành
  danh sách trong `AgentSettings`.
