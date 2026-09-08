# Subagent giám sát theo camera — kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi camera có một subagent riêng (bật/tắt, trí nhớ, trần token, digest định kỳ) chạy song song trong worker `agent/`, hiển thị trên `/agent` và modal camera.

**Architecture:** Thêm model `CameraAgent` (1 dòng/camera). `runSession` quy task về camera, kiểm tra subagent bật + trần token camera, chèn trí nhớ vào preamble, cộng token cuối phiên. Tool `remember_camera` ghi trí nhớ. Lane nghiên cứu claim tối đa 1 task/camera và chạy song song 3 phiên. Skill chuyển sang `agent/skills/<name>/SKILL.md`.

**Tech Stack:** Node 24 + tsx, Prisma 7 (SQLite/libsql), Anthropic SDK tool runner (+ runner OpenAI-compatible), Next.js 16 App Router, React Query, zod 4, node:test.

**Spec:** `docs/superpowers/specs/2026-09-08-camera-subagents-design.md`

## Global Constraints
- Định danh code, tiêu đề test, commit message tiếng Anh; comment, UI copy, tài liệu tiếng Việt (`AGENTS.md`).
- Tài liệu (`wiki/`, `README.md`, `docs/ba/`) cập nhật cùng commit với code liên quan.
- Không thêm dependency. Không chạy `npm run dev`/dev server/Chrome (máy vận hành đang quá tải) — kiểm thử bằng `npm run test:agent` (cần `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="Đồng ý, chạy db push trên agent-test.db"`), `npx tsc --noEmit`, `npx eslint .`, chạy tuần tự.
- Kill switch toàn cục và trần token toàn cục vẫn kiểm trước trần camera.
- `remember_camera` ≤ 3 lần/phiên; `memory` ≤ 20 ghi chú, mỗi ghi chú ≤ 300 ký tự.
- Test dùng `agent-test.db`; mỗi file test tự dọn dữ liệu của mình (`deleteMany` theo id/prefix riêng), không xoá bảng của file khác.

---

### Task 1: Model CameraAgent và thư viện `agent/lib/camera-agent.ts`

**Files:**
- Modify: `prisma/schema.prisma` (thêm model theo spec §2)
- Create: `agent/lib/camera-agent.ts`
- Test: `agent/test/camera-agent.test.ts`
- Modify: `wiki/04-mo-hinh-du-lieu.md` (bảng model: thêm `CameraAgent`)

**Interfaces (Produces):**
```ts
export interface CameraMemoryNote { at: string; text: string; sessionId: string }
export const MEMORY_MAX = 20; export const NOTE_MAX = 300;
export function localDay(now?: Date): string;                       // "YYYY-MM-DD" giờ địa phương
export async function cameraIdOf(task: { subjectType: string | null; subjectId: string | null }): Promise<string | null>;
export async function getCameraAgent(cameraId: string, now?: Date): Promise<CameraAgent>; // upsert + reset usage khi sang ngày
export function parseMemory(raw: string): CameraMemoryNote[];       // JSON hỏng → []
export function pushMemory(notes: CameraMemoryNote[], note: CameraMemoryNote, replaceIndex?: number): CameraMemoryNote[]; // thuần, cắt 20, cắt 300
export async function rememberCamera(cameraId: string, text: string, sessionId: string, replaceIndex?: number): Promise<CameraMemoryNote[]>;
export async function addCameraTokens(cameraId: string, tokens: number, now?: Date): Promise<void>;
export async function hasActivitySince(cameraId: string, since: Date | null): Promise<boolean>; // Violation.detectedAt > since HOẶC AgentEvent health của camera > since; since null → true
```

- [ ] **Bước 1: Schema** — thêm model `CameraAgent` đúng spec §2 vào `prisma/schema.prisma` (sau `AgentSettings`). Chạy `DATABASE_URL=file:./agent-test.db npx prisma db push --accept-data-loss` (biến consent) và `npx prisma generate`.
- [ ] **Bước 2: Test thất bại** — `agent/test/camera-agent.test.ts`:
```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { addCameraTokens, cameraIdOf, getCameraAgent, hasActivitySince, localDay, parseMemory, pushMemory, rememberCamera, MEMORY_MAX } from '../lib/camera-agent';

const CAM = 'cam-agent-t';
test.before(async () => {
  await prisma.site.upsert({ where: { id: 'site-agent-t' }, update: {}, create: { id: 'site-agent-t', organizationId: 'org-agent-t', name: 'Site T', address: '', status: 'ACTIVE' } }).catch(() => {});
  await prisma.camera.upsert({ where: { id: CAM }, update: {}, create: { id: CAM, siteId: 'site-agent-t', name: 'Cam T', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
});
test.beforeEach(async () => { await prisma.cameraAgent.deleteMany({ where: { id: CAM } }); await prisma.violation.deleteMany({ where: { cameraId: CAM } }); });

test('cameraIdOf resolves camera and violation subjects, null otherwise', async () => {
  assert.equal(await cameraIdOf({ subjectType: 'camera', subjectId: CAM }), CAM);
  const v = await prisma.violation.create({ data: { cameraId: CAM, siteId: 'site-agent-t', type: 'hard_hat', severity: 'critical', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/x.jpg' } });
  assert.equal(await cameraIdOf({ subjectType: 'violation', subjectId: v.id }), CAM);
  assert.equal(await cameraIdOf({ subjectType: 'system', subjectId: null }), null);
  assert.equal(await cameraIdOf({ subjectType: 'violation', subjectId: 'missing' }), null);
});
test('getCameraAgent creates the row lazily and resets usage on a new day', async () => {
  const a = await getCameraAgent(CAM, new Date('2026-09-08T10:00:00'));
  assert.equal(a.isEnabled, true); assert.equal(a.usageDay, localDay(new Date('2026-09-08T10:00:00')));
  await addCameraTokens(CAM, 500, new Date('2026-09-08T10:05:00'));
  assert.equal((await getCameraAgent(CAM, new Date('2026-09-08T11:00:00'))).tokensUsedToday, 500);
  assert.equal((await getCameraAgent(CAM, new Date('2026-09-09T00:01:00'))).tokensUsedToday, 0);
});
test('pushMemory caps at 20 notes and 300 chars, replaceIndex edits in place', () => {
  let notes = [] as ReturnType<typeof parseMemory>;
  for (let i = 0; i < MEMORY_MAX + 3; i++) notes = pushMemory(notes, { at: 'a', text: `n${i}`, sessionId: 's' });
  assert.equal(notes.length, MEMORY_MAX); assert.equal(notes[0].text, 'n3');
  notes = pushMemory(notes, { at: 'b', text: 'x'.repeat(400), sessionId: 's' }, 0);
  assert.equal(notes[0].text.length, 300); assert.equal(notes.length, MEMORY_MAX);
  assert.deepEqual(parseMemory('not json'), []);
});
test('rememberCamera persists notes and hasActivitySince sees new violations', async () => {
  const notes = await rememberCamera(CAM, 'ngược sáng 16-17h', 'sess-t');
  assert.equal(notes.length, 1);
  assert.equal(parseMemory((await getCameraAgent(CAM)).memory).length, 1);
  const t0 = new Date();
  assert.equal(await hasActivitySince(CAM, t0), false);
  await prisma.violation.create({ data: { cameraId: CAM, siteId: 'site-agent-t', type: 'hard_hat', severity: 'critical', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/y.jpg' } });
  assert.equal(await hasActivitySince(CAM, t0), true);
  assert.equal(await hasActivitySince(CAM, null), true);
});
```
Chạy `npm run test:agent` → FAIL (module không tồn tại). Kiểm tra tên trường bắt buộc của `Site`/`Camera`/`Violation` trong `prisma/schema.prisma` và sửa fixture cho khớp (giữ id prefix `*-agent-t`).
- [ ] **Bước 3: Cài đặt** — `agent/lib/camera-agent.ts` theo interface; `getCameraAgent`: `upsert` với `create: { id, usageDay: localDay(now) }`, sau đó nếu `usageDay !== localDay(now)` → `update { tokensUsedToday: 0, usageDay }`. `addCameraTokens`: gọi `getCameraAgent` rồi `update { tokensUsedToday: { increment } }`. `hasActivitySince`: `since === null` → true; `violation.count({ where: { cameraId, detectedAt: { gt: since } } }) > 0 || agentEvent.count({ where: { subjectType: 'camera', subjectId: cameraId, type: 'health', emittedAt: { gt: since } } }) > 0`.
- [ ] **Bước 4: Test xanh**, `tsc`, `eslint`.
- [ ] **Bước 5: wiki/04** thêm dòng `CameraAgent` vào bảng model + mô tả JSON `memory`.
- [ ] **Bước 6: Commit** `feat(agent): add CameraAgent model and per-camera memory library`.

### Task 2: Phiên chạy dưới subagent camera + tool `remember_camera`

**Files:**
- Modify: `agent/session.ts`, `agent/lib/preamble.ts`, `agent/lib/guard.ts` (`LIMITS.rememberPerSession: 3`), `agent/lib/tool-context.ts` (`spent.remembers: number`, `cameraId: string | null` trong ctx), `agent/lib/toolsets.ts`
- Create: `agent/tools/remember_camera.ts`
- Test: `agent/test/session.test.ts` (thêm case), `agent/test/remember-camera.test.ts`
- Modify: `wiki/09-agent.md` (mục mới "Subagent theo camera": định tuyến, trí nhớ, trần riêng)

**Interfaces:**
- `newToolContext(task, sessionId, cameraId?: string | null)` — thêm `cameraId`, `spent.remembers`.
- `toolsFor(kind, ctx)`: nếu `ctx.cameraId` → thêm `makeRememberCamera(ctx)` vào mọi bộ tool nghiên cứu (không thêm cho `shift.report`/`ops.escalate` toàn hệ thống vì `cameraId` null).
- `preambleFor(task, opts & { cameraId?: string | null; memory?: CameraMemoryNote[] })`: khi có cameraId thêm `## Bạn là subagent phụ trách camera <id>` + `## Trí nhớ camera` (mỗi dòng `- [YYYY-MM-DD] text`, hoặc "(chưa có ghi chú)").
- `runSession`: sau kiểm tra trần toàn cục: `const cameraId = await cameraIdOf(task)`; nếu có: `agent = await getCameraAgent(cameraId)`; `!agent.isEnabled` → `skipped(\`subagent camera ${cameraId} đang tắt\`)`; `agent.tokensUsedToday >= agent.dailyTokenCap` → `throw new SessionError('camera đã chạm trần token trong ngày', msUntilMidnight(), false, true)` (phát `session.ended skipped` trước như trần toàn cục). `session.started.data` thêm `cameraId`. Cuối phiên (cả khi lỗi): `if (cameraId) await addCameraTokens(cameraId, usage.input_tokens + usage.output_tokens)`.

- [ ] **Bước 1: Test thất bại** — thêm vào `session.test.ts` (dùng fake `SessionClient` như các test hiện có; tạo camera `cam-sess-t` + violation): (a) subagent tắt → trả về chuỗi chứa "đang tắt", có `session.ended {stop:'skipped'}`, `client.run` không được gọi; (b) `dailyTokenCap: 100`, `tokensUsedToday: 100` → reject `SessionError` với `refundAttempt: true`; (c) phiên thành công cộng token vào `CameraAgent.tokensUsedToday` và `session.started.data.cameraId` đúng; (d) `preambleFor` với memory 2 ghi chú chứa "## Trí nhớ camera" và cả 2 text.
  `remember-camera.test.ts`: gọi `makeRememberCamera(ctx).run({ text })` 4 lần → lần 4 trả `{ ok: false, blockedReason }`; ghi chú tồn tại trong DB; có event `action` với `action: 'remember_camera'`.
- [ ] **Bước 2: Cài đặt** tool:
```ts
export const makeRememberCamera = (ctx: ToolContext) => betaZodTool({
  name: 'remember_camera',
  description: 'Ghi một điều BỀN về camera này để các phiên sau dùng lại (góc máy, giờ ngược sáng, khu vực hay báo oan, việc cần theo dõi). Không dùng cho một vi phạm cụ thể (dùng write_note). Tối đa 300 ký tự, 3 lần/phiên.',
  inputSchema: z.object({ text: z.string().min(5).max(NOTE_MAX), replaceIndex: z.number().int().min(0).max(MEMORY_MAX - 1).optional() }),
  run: async ({ text, replaceIndex }) => safeRun(ctx, 'remember_camera', async () => {
    ctx.spent.calls++;
    if (!ctx.cameraId) return JSON.stringify({ ok: false, blockedReason: 'phiên này không thuộc camera nào' });
    if (ctx.spent.remembers >= LIMITS.rememberPerSession) return JSON.stringify({ ok: false, blockedReason: 'phiên này đã ghi trí nhớ đủ số lần' });
    const notes = await rememberCamera(ctx.cameraId, text, ctx.sessionId, replaceIndex);
    ctx.spent.remembers++;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'camera', subjectId: ctx.cameraId, type: 'action', data: { action: 'remember_camera', text, replaceIndex, total: notes.length } });
    return JSON.stringify({ ok: true, total: notes.length });
  }),
});
```
- [ ] **Bước 3: Test xanh**, `tsc`, `eslint`. Bước 4: wiki/09. Bước 5: Commit `feat(agent): run research sessions under the camera's subagent with memory and a per-camera token cap`.

### Task 3: Digest định kỳ theo camera, một task/camera, chạy song song

**Files:**
- Modify: `agent/lib/tasks.ts` (`claimDue(limit, lane, now, opts?: { onePerCamera?: boolean })`), `agent/main.ts` (`RESEARCH_BATCH = 3`, `ensureRecurring` tạo digest/camera, `tick` chạy nghiên cứu bằng `Promise.allSettled`), `agent/research/index.ts` (cổng hoạt động cho `camera.digest`)
- Test: `agent/test/tasks.test.ts` (thêm case), `agent/test/research-digest.test.ts`
- Modify: `wiki/09-agent.md` (nhịp digest, song song)

**Interfaces:**
- `claimDue(..., { onePerCamera: true })`: trước khi lease, với lane nghiên cứu, gom theo `await cameraIdOf(task)`; task thứ hai cùng camera trong lượt bị bỏ qua (không lease). Task không thuộc camera không bị giới hạn.
- `ensureRecurring()`: với mỗi `camera` có `status = 'ONLINE'`: `agent = getCameraAgent(id)`; nếu `agent.isEnabled`: `ensureTask({ kind: 'camera.digest', subjectType: 'camera', subjectId: id, reason: 'Tổng hợp định kỳ camera', dueAt: (agent.lastDigestAt ?? now) + digestEveryMin phút })`.
- `runResearch`: nếu `task.kind === 'camera.digest'` và `task.subjectId`: `agent = getCameraAgent(id)`; nếu `!(await hasActivitySince(id, agent.lastDigestAt))` → `update lastDigestAt = now`, `emit action { action: 'camera.digest.skipped', reason: 'không có hoạt động mới' }`, trả về `'không có hoạt động mới từ digest trước'` (không mở phiên). Ngược lại chạy `runSession` rồi `update lastDigestAt = now`.
- `tick()`: `const research = await claimDue(RESEARCH_BATCH, 'research', new Date(), { onePerCamera: true }); await Promise.allSettled(research.map(t => runOne(t, runResearch)));`

- [ ] **Bước 1: Test thất bại** — `tasks.test.ts`: tạo 3 task `violation.review` cho 2 vi phạm cùng camera + 1 camera khác → `claimDue(3,'research',now,{onePerCamera:true})` trả 2 task thuộc 2 camera khác nhau, task còn lại vẫn `leasedUntil: null`. `research-digest.test.ts`: `camera.digest` không có hoạt động mới → outcome chứa "không có hoạt động", `lastDigestAt` được đặt, không có `session.started`; có vi phạm mới → dùng fake client qua `runSession` (export một `opts.client` xuyên qua `runResearch(task, { client })`) → có `session.started`.
- [ ] **Bước 2: Cài đặt**, **Bước 3: Test xanh** (`ensureRecurring` kiểm bằng test nhỏ: seed camera ONLINE + agent bật → sau `ensureRecurring()` có task `camera.digest` với `dueAt ≈ now + 30 phút`; export `ensureRecurring` từ `agent/main.ts` hoặc tách sang `agent/lib/recurring.ts` để test được — chọn tách).
- [ ] **Bước 4: wiki/09, Bước 5: Commit** `feat(agent): per-camera digests, one session per camera, parallel research lane`.

### Task 4: Chuẩn skill `agent/skills/<name>/SKILL.md`

**Files:**
- Move: `agent/skills/{data-boundaries,escalation,evidence,ppe-review}.md` → `agent/skills/<name>/SKILL.md` với frontmatter `name: <name>` và `description: Dùng khi …` (ngôi thứ ba, chỉ điều kiện kích hoạt, ≤ 500 ký tự); giữ nội dung.
- Modify: `agent/lib/prompt.ts` (`readdir` thư mục con, đọc `SKILL.md`, bỏ frontmatter khi ghép vào prompt nhưng đưa `name — description` vào bảng chỉ mục đặt trước nội dung), `agent/instructions.md` (mục "Skill" tham chiếu bảng chỉ mục tự sinh)
- Test: `agent/test/prompt.test.ts` (thêm: `systemBlocks()` chứa tên 4 skill và không chứa `---\nname:`)
- Modify: `wiki/09-agent.md` (mục Skill: chuẩn mới, cách thêm skill)

- [ ] Bước 1 test thất bại → Bước 2 chuyển file + loader → Bước 3 test xanh → Bước 4 wiki → Bước 5 Commit `refactor(agent): move skills to SKILL.md format with frontmatter`.

### Task 5: Skill `remembering-camera-context` (viết theo superpowers:writing-skills) — **do điều phối viên (parent) thực hiện**, cần Agent tool

- [ ] **RED**: dispatch một subagent (sonnet) với system prompt = `agent/instructions.md` + 4 skill hiện có, kịch bản: phiên `camera.digest` cho camera có 12 vi phạm/24h trong đó 5 báo oan lúc 16–17h (ngược sáng), 1 vi phạm thật lặp lại ở cổng phụ, trí nhớ hiện có 1 ghi chú cũ đã sai; tool giả `remember_camera`, `write_note`, `read_camera_history` trả JSON mẫu. Ghi lại nguyên văn: agent ghi gì vào trí nhớ (có ghi vi phạm cụ thể? có lặp ghi chú cũ? có sửa ghi chú sai bằng `replaceIndex`? có vượt 300 ký tự?).
- [ ] **GREEN**: viết `agent/skills/remembering-camera-context/SKILL.md` nhắm đúng các lỗi quan sát được: cái gì bền (góc máy, giờ ngược sáng, vùng ngoài hàng rào, thiết bị che khuất, lịch ca) vs không bền (một vi phạm, một người); một ghi chú = một sự thật, có giờ/khu vực; sửa ghi chú sai bằng `replaceIndex` thay vì thêm; không lặp; ≤ 300 ký tự; tối đa 3/phiên; bảng "Suy nghĩ sai → Thực tế".
- [ ] Chạy lại kịch bản với skill → so sánh. Ghi kết quả (2 lần) vào commit message. Commit `feat(agent): add remembering-camera-context skill`.

### Task 6: API subagent camera + hook + kiểu

**Files:**
- Create: `src/app/api/agent/cameras/route.ts` (GET), `src/app/api/agent/cameras/[id]/route.ts` (PATCH), `src/app/api/agent/cameras/[id]/digest/route.ts` (POST)
- Create: `src/lib/camera-agent-shape.ts` (`toCameraAgentView(row, camera, stats)`, `parseMemory` dùng lại từ `agent/lib/camera-agent.ts`? — KHÔNG import `agent/` vào Next; sao chép `parseMemory` 5 dòng vào `src/lib/camera-agent-shape.ts` với comment)
- Modify: `src/app/api/cameras/[id]/route.ts` (DELETE: `prisma.cameraAgent.deleteMany({ where: { id } })`), `src/types/agent.ts` (`CameraAgentView`), `src/hooks/use-agent.ts` (`useCameraAgents`, `useSaveCameraAgent`, `useDigestCamera`), `src/lib/agent-bridge.ts` (không đổi; dùng `enqueueAgentTask` + `pokeAgent`)
- Test: `agent/test/camera-agent-shape.test.ts` (hàm thuần `toCameraAgentView` và `parseMemory`)
- Modify: `wiki/05-giao-dien-va-api.md` (3 route, 3 hook)

**Hợp đồng:**
- `GET /api/agent/cameras`: `requireSession`; `allowedSiteIds` scope; với mỗi camera (scoped) lấy `cameraAgent` (không upsert — thiếu thì trả mặc định `isEnabled: true, memory: [] …` với `exists: false`), `openViolations = count(status OPEN)`, `reviewed24h = count(agentReview not null AND detectedAt > now-24h)`, `falsePositiveRate24h`.
- `PATCH`: `ORG_WIDE_ROLES` (dùng `assertSiteAccess` không đủ — kiểm role như `PATCH /api/agent/settings`); zod `{ isEnabled?: boolean, digestEveryMin?: int 5..1440, dailyTokenCap?: int ≥ 0, clearMemory?: true }`; upsert; ghi `AgentEvent action { action: 'camera-agent.settings', changes, userId }` với `sessionId = randomUUID()`.
- `POST digest`: `assertSiteAccess(camera.siteId)`; `enqueueAgentTask({ kind: 'camera.digest', subjectType: 'camera', subjectId: id, reason: 'Người dùng yêu cầu tổng hợp', priority: 60 }).then(() => pokeAgent('/internal/dispatch'))`; 202 `{ taskId }`.

- [ ] Bước 1 test thất bại (shape) → Bước 2 cài đặt → Bước 3 test/tsc/eslint xanh → Bước 4 wiki/05 → Bước 5 Commit `feat(api): camera subagent settings, listing and manual digest`.

### Task 7: Giao diện `/agent` và panel camera

**Files:**
- Create: `src/components/agent/CameraAgentCard.tsx`
- Modify: `src/app/(dashboard)/agent/page.tsx` (mục "Subagent theo camera": lưới `md:grid-cols-2 xl:grid-cols-3`, trạng thái tải/trống/lỗi), `src/components/agent/SubjectAgentPanel.tsx` (khi `subjectType === 'camera'`: header trạng thái subagent + danh sách trí nhớ, dùng `useCameraAgents` lọc theo id), `DESIGN.md` (mục "Thẻ subagent camera": token dùng, trạng thái)
- Modify: `wiki/05` (trang `/agent` mô tả mục mới), `docs/ba/07-screen-specs.md` (SCR-10 thêm mục 11–16: thẻ subagent), `docs/ba/04-function-list.md` (F-AGENT-08 Bật/tắt subagent camera, F-AGENT-09 Trí nhớ camera, F-AGENT-10 Tổng hợp ngay), `docs/ba/05-permission-matrix.md`, `docs/ba/11-use-case-specs.md` (UC-28 Cấu hình subagent camera), `docs/ba/13-user-stories.md` (US-21, US-22)

**Thẻ** (`CameraAgentCard`): tên camera + công trường; `Switch` bật/tắt (lưu ngay, toast); `InputGroup` "Nhịp tổng hợp (phút)" number 5–1440 lưu khi blur; "Token hôm nay" `x / cap` với thanh tiến trình (`--primary`, đổi `--warning` khi > 80%); "Digest gần nhất" thời gian; "Vi phạm mở" và "Báo oan 24h"; 3 ghi chú mới nhất (mono 12px, `text-secondary`); nút "Tổng hợp ngay" (`useDigestCamera`, disabled khi tắt) và "Xoá trí nhớ" (confirm). Dùng `SettingCard`, `Switch`, `InputGroup` từ `components/settings/ui.tsx`. Focus ring trên nút.

- [ ] Bước 1 cài đặt → Bước 2 `tsc`/`eslint` → Bước 3 tài liệu → Bước 4 Commit `feat(ui): camera subagent cards on /agent and memory in the camera panel`. **Kiểm tra hình ảnh desktop/mobile hoãn** tới khi máy rảnh (ghi rõ trong commit body và CHANGELOG).

### Task 8: README, CHANGELOG, BA còn lại, nghiệm thu

- [ ] README mục Agent: thêm đoạn "Subagent theo camera" (3 câu + biến `LIMITS`). `CHANGELOG.md` `## [Unreleased] → ### Thêm`. `docs/ba/01-bpmn.md` QT-03 thêm ghi chú digest/camera (không vẽ lại sơ đồ). `docs/ba/14-nfr.md` NFR-07 cập nhật trần theo camera.
- [ ] Chạy lần cuối: `npm run test:agent`, `tsc`, `eslint`, `npm run build` (khi máy rảnh). Commit `docs(agent): document per-camera subagents`.
