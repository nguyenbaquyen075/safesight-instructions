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
ASC`. Lane trực tiếp lấy 20 row/vòng và chạy tuần tự; lane nghiên cứu lấy 3 row/vòng với
`{ onePerCamera: true }` (mỗi camera nhiều nhất một task/lượt, task thứ hai của cùng camera
chờ lượt sau) rồi chạy **song song** bằng `Promise.allSettled` — một phiên hỏng không kéo
theo phiên khác.
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
| `camera.digest` | nghiên cứu | 50 | `ensureRecurring()` cho mỗi camera ONLINE có subagent bật; agent cũng tự hẹn qua `schedule_followup` | `lastDigestAt + digestEveryMin` (mặc định 30 phút; lần đầu `now + digestEveryMin`) |
| `followup` | nghiên cứu | 0 | tool `schedule_followup` | theo lý do agent nêu |

`// ponytail: SQLite không có FOR UPDATE SKIP LOCKED; một worker duy nhất. Nhiều worker
hoặc Postgres thì thay claimDue bằng câu SQL của CRM lib/tasks.ts.`

### Heartbeat và kiểm danh tính trước khi SIGTERM

`ai-engine/yolo_inference.py` ghi `public/snapshots/.heartbeat.json` (`{pid, at, streams,
fps}`) mỗi 5s và xoá file này khi thoát (Ctrl+C/kill/hết chương trình, cùng `atexit` đã dùng
để dọn `violation_*.jpg`). `health.sweep` đọc file này (`readHeartbeat`,
`agent/lib/capabilities.ts`); nếu heartbeat cũ hơn `heartbeatStaleMs` (30s) → nghi
`engine.stalled`.

Chỉ "còn tiến trình mang pid đó" là chưa đủ: hệ điều hành có thể cấp lại pid đã chết cho một
tiến trình khác hoàn toàn (dev khác, bridge, editor…). Trước khi tin `pid` trong heartbeat là
engine, `agent/direct/health.ts` **trên Linux** đọc `/proc/<pid>/cmdline` và đòi có
`yolo_inference.py` trong đó (`isEngineProcess`); đọc không được hoặc không khớp = **không
phải engine**. Ngoài Linux không có `/proc` nên chỉ kiểm còn sống bằng `process.kill(pid, 0)`
— coi engine khoẻ là "đã mất" ở đó thì mỗi vòng quét lại sinh `engine.stalled` giả và sau 3
lần lặp là leo thang cho trực vận hành.

`detail.pidAlive` **không** bị hạ về `false` theo tuổi heartbeat. Engine treo thật (pid còn
sống, kẹt trong một lời gọi cv2/torch) có heartbeat cũ dần mãi; hạ `pidAlive` sau 5 phút làm
`actions.ts` bỏ qua bước SIGTERM và engine không bao giờ được khởi động lại. Việc chống pid bị
tái sử dụng đã do bước kiểm `cmdline` lo. `detail.heartbeatAgeMs` vẫn được báo để biết đã treo
bao lâu.

`ai-engine/yolo_inference.py` ghi heartbeat **ngay khi khởi động**, trước lúc nạp model (mất
vài chục giây): nếu chờ tới vòng lặp đầu tiên thì trong khoảng đó agent vẫn đọc heartbeat của
lần chạy trước và có thể SIGTERM nhầm pid cũ.

`agent/direct/actions.ts` xử lý `engine.stalled`: kiểm `detail.pidAlive === true` **trước**
khi gọi `rateLimit('engine-restart', …)` — pid chết/không phải engine thì không SIGTERM và
**không tiêu suất** hạn ngạch 3 lần/giờ (trước đây `rateLimit` được gọi trước, một pid vô
hiệu vẫn ăn mất một suất restart thật).

### Probe vs sweep

`health.probe` (do `PATCH /api/cameras/[id]` xếp lịch khi đổi nguồn/trạng thái) và
`health.sweep` (định kỳ 60s) dùng chung logic quét (`runProbe` gọi `runSweep(task, true)`),
nhưng chỉ `health.sweep` mới tự hẹn vòng kế tiếp (`task.kind === 'health.sweep'`) — trước đây
`runProbe` cũng hẹn/gộp vào `health.sweep` đang chờ, mỗi lần đổi camera lại đẩy lùi lịch quét
định kỳ thêm 60s.

Probe cũng **không đụng vào bộ đếm leo thang**: `bridgeFailStreak` và map `repeats` được định
nghĩa theo *nhịp* quét định kỳ (3 vòng 60s), nên probe đọc `bridgeFailStreak` nhưng không cộng
dồn, và dùng một map `repeats` dùng một lần. Nếu không, đổi nguồn camera vài lần liên tiếp là
đủ chạm ngưỡng `bridge.down`/leo thang mà chưa hề có 3 vòng quét thật.

### Luật dọn snapshot

`snapshot.cleanup` (`agent/direct/cleanup.ts`, `pickCleanup`) chỉ xoá ảnh thoả **cả ba**: đã có
Violation tham chiếu (ảnh chưa tham chiếu có thể đang được ghi), vi phạm đó đã **đóng**
(`RESOLVED`/`FALSE_POSITIVE`), và cũ hơn **24h**. Ảnh của vi phạm còn `OPEN`/`UNDER_REVIEW` là
bằng chứng của hồ sơ chưa xử lý xong — không xoá dù đĩa đang đầy; `runCleanup` đọc `status`
kèm `snapshotUrl` và truyền cờ `closed` cho từng file. Không còn luật giữ 30 ngày: `yolo_inference.py` xoá sạch `violation_*.jpg` mỗi lần
engine khởi động nên ảnh không bao giờ sống đủ 30 ngày — luật đó khiến cleanup luôn xoá 0 file
và `disk.pressure` lặp lại mỗi sweep dù đĩa đang đầy thật.

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
  `schedule_followup` tối đa 3/phiên; `remember_camera` tối đa 3/phiên; sweep: đổi trạng thái camera 1/5 phút/camera,
  SIGTERM engine 3/giờ.
- **Không bao giờ:** không có tool xoá bản ghi, sửa User/role/AlertRule/TelegramSettings,
  đổi `rtspUrl`, sửa ngưỡng nhận diện, đọc/ghi file ngoài `public/snapshots`, gọi mạng ngoài
  Anthropic và Telegram.
- **Trần token:** vượt `AgentSettings.dailyTokenCap` (mặc định 2 000 000) → lane nghiên cứu
  tạm dừng tới 0h, task giữ nguyên `dueAt`; lane trực tiếp không bị ảnh hưởng. Trước khi
  ném lỗi, `runSession` luôn phát `AgentEvent session.ended { stop: 'skipped', reason,
  retryAfterMs }` — nếu không thì panel hỏi-đáp (`AskAgentBox`) poll theo `sessionId` sẽ
  không bao giờ thấy điểm dừng và treo "Agent đang trả lời…" mãi.
- Bị chặn → tool trả kết quả có lý do (không `is_error`) để model viết lại thay vì thử lại.

## Subagent theo camera

Mỗi camera có một **subagent** riêng — một dòng `CameraAgent` (`id` = `Camera.id`, tạo lười
khi camera đó có task đầu tiên) chứ không phải một tiến trình riêng: vẫn cùng worker `agent/`,
cùng hàng đợi.

- **Định tuyến** (`agent/lib/camera-agent.ts`, `cameraIdOf`): task `subjectType = camera` →
  chính nó; `violation` → `Violation.cameraId`; còn lại → `null` (phiên toàn hệ thống, chạy
  như cũ).
- **Bật/tắt riêng:** `CameraAgent.isEnabled = false` → `runSession` trả về
  `subagent camera <id> đang tắt` và phát `session.ended { stop: 'skipped' }`, không gọi LLM.
  Kill switch toàn cục vẫn thắng trước.
- **Trần token riêng:** `dailyTokenCap` mặc định 300 000/ngày, đếm theo ngày **địa phương**
  (`usageDay`, sang ngày mới thì `tokensUsedToday` reset). Chạm trần → `SessionError` hoãn
  qua nửa đêm kèm `refundAttempt` (không tiêu lần thử của task) và phát `session.ended
  { stop: 'skipped', reason, retryAfterMs }` trước khi ném, đúng như trần toàn cục. Thứ tự
  kiểm: kill switch → trần toàn cục → subagent tắt → trần camera.
- **Trí nhớ:** `CameraAgent.memory` là JSON `[{ at, text, sessionId }]`, tối đa 20 ghi chú,
  mỗi ghi chú ≤ 300 ký tự (ghi chú thứ 21 đẩy ghi chú cũ nhất ra). Đầu mỗi phiên của camera,
  preamble thêm `## Bạn là subagent phụ trách camera <id>` và `## Trí nhớ camera` liệt kê
  ghi chú cũ → mới, mỗi dòng `- #<chỉ số> [YYYY-MM-DD] nội dung` (chỉ số dùng cho
  `replaceIndex`).
- **Cộng token:** cuối phiên (kể cả khi phiên lỗi giữa chừng) `input + output` được cộng vào
  `tokensUsedToday` của camera; `session.started.data` ghi thêm `cameraId`.
- **Nhịp tổng hợp:** `ensureRecurring()` (`agent/lib/recurring.ts`, tách khỏi `main.ts` để test
  được) hẹn một `camera.digest` cho mỗi camera ONLINE có subagent bật. Trước khi mở phiên,
  `runResearch` gọi `hasActivitySince(cameraId, lastDigestAt)` — không có vi phạm mới và
  không có event `health` mới thì task đóng với outcome `không có hoạt động mới từ digest
  trước`, ghi `AgentEvent action { action: 'camera.digest.skipped' }`, dời `lastDigestAt` và
  **không tốn token**. Có hoạt động thì chạy phiên rồi mới dời `lastDigestAt`.
- **Song song:** vì mỗi lượt chỉ nhận một task/camera, ba phiên nghiên cứu chạy đồng thời
  không bao giờ là hai phiên của cùng một camera.

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
| `remember_camera` | ghi | `text (5..300)`, `replaceIndex?` | `{ ok, total }` — chỉ có trong phiên thuộc một camera, tối đa 3 lần/phiên (`LIMITS.rememberPerSession`) |

Bộ tool cho từng kind: `violation.review` = tất cả trừ `read_agent_activity`;
`camera.digest`/`shift.report`/`ops.escalate` = đọc + `write_note` + `escalate`
(`ops.escalate` chỉ `escalate` với caption vận hành, không `record_verdict`);
`ask` = tất cả. Tool set cố định theo kind để cache prompt không vỡ; phiên thuộc một camera
được thêm `remember_camera` ở **cuối** danh sách (thứ tự các tool trước đó không đổi).

## Skill (`agent/skills/<name>/SKILL.md`, nạp vào system prompt)

Mỗi skill là một thư mục con của `agent/skills/` chứa duy nhất `SKILL.md`, mở đầu bằng
frontmatter YAML `name: <name>` (chữ thường, gạch nối) và `description: Dùng khi …` (ngôi
thứ ba, chỉ nêu điều kiện kích hoạt, ≤ 500 ký tự, tiếng Việt), theo sau là nội dung skill.
`systemBlocks()` (`agent/lib/prompt.ts`) đọc mọi `agent/skills/*/SKILL.md` theo thứ tự tên
thư mục, bỏ frontmatter khỏi nội dung ghép vào prompt, và dựng một bảng chỉ mục
`| Skill | Dùng khi |` từ frontmatter đặt trước toàn bộ nội dung skill — `agent/instructions.md`
chỉ tham chiếu bảng này, không lặp lại nội dung skill.

Skill hiện có:
- `evidence` — từng `ObservationKind`, khi nào dùng, vì sao không có confidence.
- `ppe-review` — mũ chỉ tính khi ở vùng đầu; găng/giày là lớp yếu (oan 6–9%) nên cần
  bằng chứng primary mới kết luận; model không có lớp `no_vest`; người nền; ngược sáng.
- `escalation` — lần 1 là nhắc nhở, từ lần 2 là vi phạm; không spam; caption ngắn có
  camera, món thiếu, lần thứ mấy.
- `data-boundaries` — không suy đoán danh tính người, không mô tả đặc điểm cá nhân ngoài
  PPE, không gửi ảnh/đoạn văn ra ngoài ngoài Telegram đã cấu hình.

Thêm skill mới: tạo thư mục `agent/skills/<name>/SKILL.md` với frontmatter `name`/
`description` theo chuẩn trên rồi viết nội dung; loader tự nhặt, không cần sửa code.

## Panel

Route Next.js mới, tất cả bắt buộc đăng nhập, đọc DB thật, không gọi model:
- `GET /api/agent/tasks?status=open|done&subjectType&subjectId`
- `GET /api/agent/events?sessionId|subjectType&subjectId&since`
- `GET|PATCH /api/agent/settings` (SUPER_ADMIN/ORG_ADMIN)
- `POST /api/agent/ask { subjectType?, subjectId?, sessionId?, message }` → ghi
  `AgentEvent message.user`, tạo/nối `AgentTask kind=ask` với `sessionId`, poke agent, trả
  `sessionId`. Panel poll `/api/agent/events?sessionId` mỗi 2s tới khi thấy
  `session.ended` hoặc im lặng 90s. Câu hỏi thứ hai trong cùng thread chỉ nối vào task `ask`
  cũ khi task đó thoả **đúng vị từ của `claimDue`** (`finishedAt: null`, chưa bị lease,
  `attempts < MAX_ATTEMPTS`); task đã hết lượt thì rơi xuống nhánh tạo task mới. Trước đây
  route reset `attempts` về 0 — cách đó đua với `retireExhausted` (có thể đóng task ngay sau
  khi reset) và không khớp vị từ `claimDue`. Nhánh nối lại dùng `updateMany` kèm
  `finishedAt: null`; 0 dòng (task vừa xong giữa lúc đọc và ghi) cũng tạo task mới.

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
| `ANTHROPIC_API_KEY` / `LLM_API_KEY` | tuỳ chọn | Thiếu thì chỉ chạy lane trực tiếp (trực vận hành); lane nghiên cứu tắt |
| `AGENT_BRIDGE_SECRET` | bắt buộc để poke/ask | Next gọi `POST http://127.0.0.1:4002/internal/*`; thiếu ở Next thì không gọi (task vẫn nằm hàng đợi), thiếu ở agent thì route trả 401 |
| `AGENT_PORT` | tuỳ chọn | Mặc định `4002` |
| `SNAPSHOT_MAX_MB` | tuỳ chọn | Mặc định `2048` — ngưỡng `disk.pressure` cho `public/snapshots` |

### Nhà cung cấp LLM

Lane nghiên cứu chạy được trên hai loại endpoint. Mặc định là Anthropic Messages API
(`@anthropic-ai/sdk`, tool runner). Nếu key của bạn là proxy **tương thích OpenAI**
(`POST /chat/completions`), đặt `LLM_PROVIDER=openai` để agent dùng
`agent/lib/llm/openai.ts` — vòng lặp gọi tool viết bằng `fetch`, không thêm thư viện.

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | `openai` chuyển sang endpoint `/chat/completions` |
| `LLM_BASE_URL` | `ANTHROPIC_BASE_URL`, rồi `https://api.openai.com/v1` | URL gốc. Chế độ `openai`: agent tự nối `/chat/completions`. Chế độ `anthropic`: truyền thẳng vào `baseURL` của SDK, nên proxy định dạng Anthropic cũng dùng được |
| `LLM_API_KEY` | `ANTHROPIC_API_KEY` | Gửi ở header `Authorization: Bearer` khi dùng chế độ openai |
| `LLM_MODEL_DEFAULT` | — | Tên model ghi vào `AgentSettings.model` lúc tạo dòng cài đặt đầu tiên. Ngoài ra, mỗi lần worker khởi động với `LLM_PROVIDER=openai`, nếu `model` đang lưu bắt đầu bằng `claude-` (dòng cài đặt do route Next tạo trước, mặc định schema là `claude-opus-5`) thì `applyModelDefault()` nắn về giá trị này và ghi log — không thì proxy trả 400 và mọi task nghiên cứu chết. Đổi sau trên trang `/agent`: ô Model là `<input list>` + `<datalist>`, gõ được tên model bất kỳ, `PATCH /api/agent/settings` nhận chuỗi tự do 1–100 ký tự |
| `LLM_IMAGE_INPUT` | `false` | Cho phép gửi ảnh snapshot sang endpoint openai |

Ví dụ `.env.local`:

```bash
LLM_PROVIDER=openai
LLM_BASE_URL=https://proxy-cua-ban/v1
LLM_API_KEY=sk-...
LLM_MODEL_DEFAULT=ten-model-cua-proxy
```

**Lưu ý về ảnh:** nhiều proxy tương thích OpenAI không nhận `image_url`. Mặc định agent
**bỏ** block ảnh trong kết quả tool (chỉ giữ phần văn bản), nên `read_violation` vẫn trả
bbox và dữ kiện nhưng model không *nhìn* được snapshot — phán quyết sẽ dựa trên số liệu.
Đặt `LLM_IMAGE_INPUT=true` nếu proxy hỗ trợ ảnh; ảnh được gửi thành một tin nhắn
`user` riêng dạng data URL ngay sau kết quả tool. Mỗi ảnh chỉ tải lên **một lần**: trước khi
thêm ảnh mới, các block `image_url` của lượt trước bị thay bằng ghi chú `(ảnh đã gửi ở lượt
trước)` — mỗi vòng đều gửi lại toàn bộ `messages`, giữ nguyên data URL là nhân đôi payload.

Chế độ openai không gửi các field riêng của Anthropic (`thinking`, `output_config`), nên
`reviewEffort` trên trang `/agent` không có tác dụng ở chế độ này. Lỗi HTTP được ném lại bằng
`Anthropic.APIError.generate(status, …)` nên `mapError` xử lý **chung một nhánh** cho cả hai
provider: 401/403 tắt chốt lane nghiên cứu tới lần khởi động sau, 429 và 5xx chờ 60s, 400 là
lỗi chết.
Kiểm thử (`agent/test/*.test.ts`), file mới thêm để lấp khoảng trống test:
- `usage.test.ts` — `dailyTokensUsed()` (`agent/lib/usage.ts`): cộng token trong ngày, bỏ qua
  JSON hỏng, row thiếu `usage`, row hôm qua và event không phải `session.ended`.
- `escalate.test.ts` — `makeEscalate()` (`agent/tools/escalate.ts`): chặn khi chưa VERIFIED,
  chưa đủ nghiêm trọng, hết lượt leo thang trong phiên, agent tạm dừng; và đường vận hành
  (không có `violationId`) gọi `sendOpsAlert` + tăng `ctx.spent.escalations`.
- `agent-bridge.test.ts` — `enqueueAgentTask()` (`src/lib/agent-bridge.ts`): gộp task trùng
  đang chờ, không gộp vào task đang lease hoặc đã xong.
- `violation-status.test.ts` — bất biến status viết HOA (route `PATCH
  src/app/api/violations/[id]/route.ts`): SQLite phân biệt hoa/thường trên cột TEXT.

### Chuẩn hoá `Violation.status`

SQLite phân biệt hoa/thường trên cột TEXT còn dữ liệu cũ có thể ghi chữ thường. Thay vì rải
idiom không-phân-biệt-hoa-thường ở từng chỗ gọi, `seed()` (`agent/main.ts`) chạy một lần lúc
worker khởi động:

```sql
UPDATE "Violation" SET status = upper(status) WHERE status <> upper(status)
```

Idempotent, chỉ ghi log khi thật sự có dòng bị đổi. Nhờ đó `search_violations` và
`read_camera_history` so sánh bằng chữ HOA thẳng.

`npm run dev` (`dev-all.sh`) tự chạy agent là tiến trình thứ 4, sau bridge và trước Next.
Lúc khởi động in 4 dòng `[agent] on/off <capability> (<nguồn>)` rồi `✅ Agent HTTP nội bộ:
http://127.0.0.1:4002`.

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân | Cách kiểm tra |
|---|---|---|
| Task nghiên cứu xong ngay với outcome nhắc "không có ANTHROPIC_API_KEY" | Thiếu key, lane nghiên cứu tắt (đúng thiết kế, không phải lỗi) | Thêm `ANTHROPIC_API_KEY` vào `.env.local` rồi khởi động lại agent |
| Mọi phiên nghiên cứu lỗi `Cannot read properties of undefined (reading 'filter')` | Endpoint là proxy tương thích OpenAI nhưng agent vẫn chạy đường Anthropic Messages | Đặt `LLM_PROVIDER=openai` (xem "Nhà cung cấp LLM") rồi khởi động lại agent |
| Panel/API trả `401` khi poke agent | `AGENT_BRIDGE_SECRET` ở Next và ở agent lệch nhau | So `.env.local` của cả hai tiến trình (cùng biến, cùng giá trị) |
| Task nằm mãi ở trạng thái "chờ" | Agent không chạy hoặc đã treo | `curl 127.0.0.1:4002/health`; nếu không phản hồi, khởi động lại `npm run dev:agent` |

---
🏠 Về [Trang chủ wiki](README.md) · Liên quan: [Cài đặt & vận hành](03-cai-dat-va-van-hanh.md) · [Giao diện & API](05-giao-dien-va-api.md)
