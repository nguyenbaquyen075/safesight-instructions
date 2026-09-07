# SafeSight Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm tiến trình `agent/` tự động giám sát và thao tác SafeSight theo ba vai trò — trực vận hành (tất định), cán bộ an toàn (Claude Tool Runner review từng vi phạm), trợ lý hỏi đáp trên dashboard — với hàng đợi task trong Prisma, ledger bằng chứng thay cho bước người duyệt, rào chắn trong code và audit đầy đủ.

**Architecture:** Worker Node/TypeScript trong repo (tiến trình thứ 4 của `dev-all.sh`, HTTP nội bộ cổng 4002) nhặt `AgentTask` từ SQLite mỗi 20s theo hai lane: lane trực tiếp chạy handler tất định (`agent/direct/`), lane nghiên cứu mở phiên `client.beta.messages.toolRunner` với tool là file (`agent/tools/`) và skill là markdown (`agent/skills/`). Next API chỉ ghi row `AgentTask` rồi poke agent; panel đọc `AgentEvent` qua `/api/agent/*`.

**Tech Stack:** Node 24 + TypeScript chạy bằng `tsx`, `@anthropic-ai/sdk` (Tool Runner, `betaZodTool`, model `claude-opus-5`), Prisma 7 + SQLite, zod 4, `sharp` (đã có qua Next), Next.js 16 App Router + React Query cho panel, `node --test` cho test.

**Spec:** `docs/superpowers/specs/2026-09-07-safesight-agent-design.md`

## Global Constraints

- **Dependency mới:** đúng hai gói — `@anthropic-ai/sdk` (runtime) và `tsx` (devDependency, để chạy TS có alias `@/*` và `enum` từ `src/`; spec ghi "chỉ SDK", đây là bổ sung dev-only đã báo người dùng). Không thêm gì khác.
- **Máy đang tải nặng:** mọi bước "Run" có chạy DB/tiến trình/gọi API chỉ thực hiện khi `uptime` load average < 4; nếu cao hơn, ghi lại và chờ, không bỏ bước.
- **Định danh code tiếng Anh; copy UI, comment, commit tiếng Việt.** Không đổi tên định danh legacy.
- **Không đổi hành vi pipeline AI** ngoài: heartbeat file trong `yolo_inference.py`, `GET /health` trong `yolo_bridge.js`, vòng `until` trong `dev-all.sh`.
- **Intelligence không nằm trong Next API:** route chỉ ghi `AgentTask`/đọc `AgentEvent` và poke; không gọi model, không phán đoán.
- **Mọi write của agent đi qua Prisma trong tiến trình agent**, trừ Telegram dùng `TelegramClient`/`alert-notifier` sẵn có.
- **Không có tool nào** cho: xoá bản ghi, sửa User/role/AlertRule/TelegramSettings, đổi `rtspUrl`, sửa ngưỡng nhận diện, ghi file ngoài `public/snapshots`, gọi mạng ngoài Anthropic/Telegram.
- **Model:** `claude-opus-5`, `thinking: { type: "adaptive" }`, `output_config.effort` = `AgentSettings.reviewEffort` (mặc định `medium`), `high` cho `shift.report`. `max_tokens: 16000`.
- **SQLite JSON-in-String:** `AgentEvent.data`, `Violation.agentReview` là chuỗi JSON; luôn `JSON.parse`/`JSON.stringify` ở tầng app.
- **Giá trị String enum-backed** ghi lowercase như route hiện có (`'false_positive'`, `'telegram'`); `Camera.status` ghi chữ HOA (`'DEGRADED'`) khớp `cameras/[id]/route.ts`.
- **Test:** `node --test` qua `tsx`, DB tạm `file:./agent-test.db` (gitignore). Không thêm framework.
- **Secret** (`ANTHROPIC_API_KEY`, `AGENT_BRIDGE_SECRET`) chỉ trong `.env.local`; không log, không trả về API.
- **Commit** sau mỗi task, message tiếng Việt kiểu `feat(agent): ...`, không push.
- Đường dẫn tương đối tính từ gốc repo `/home/maiychrus/Projects/safesight-instructions`.

---

## Pha 1 — Nền

### Task 1: Prisma — `AgentTask`, `AgentEvent`, `AgentSettings`, `Violation.agentReview`

**Files:**
- Modify: `prisma/schema.prisma` (thêm sau `model TelegramSettings`, và trong `model Violation`)
- Modify: `.gitignore`

**Interfaces:**
- Produces: bảng `AgentTask`, `AgentEvent`, `AgentSettings`; cột `Violation.agentReview String?`. Mọi task sau dùng `prisma.agentTask`, `prisma.agentEvent`, `prisma.agentSettings`.

- [ ] **Step 1: Thêm 3 model vào cuối `prisma/schema.prisma`**

```prisma
model AgentTask {
  id          String    @id @default(cuid())
  kind        String
  subjectType String?
  subjectId   String?
  reason      String
  priority    Int       @default(0)
  budget      Int       @default(6)
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
  type        String
  data        String   // JSON string
  emittedAt   DateTime @default(now())

  @@index([sessionId, emittedAt])
  @@index([subjectType, subjectId, emittedAt])
}

model AgentSettings {
  id            String   @id @default(cuid())
  isEnabled     Boolean  @default(true)
  model         String   @default("claude-opus-5")
  reviewEffort  String   @default("medium")
  dailyTokenCap Int      @default(2000000)
  shiftReportAt String   @default("17:30")
  updatedAt     DateTime @updatedAt
}
```

- [ ] **Step 2: Thêm cột vào `model Violation`** ngay sau `occurrenceCount`:

```prisma
  agentReview     String?  // JSON: { verdict, band, observations, note, sessionId, reviewedAt }
```

- [ ] **Step 3: Gitignore DB test** — thêm vào cuối `.gitignore`:

```
# DB tạm cho test agent (npm run test:agent)
agent-test.db*
```

- [ ] **Step 4: Đẩy schema (khi máy tải nhẹ)**

Run: `DATABASE_URL="file:./dev.db" npx prisma db push && DATABASE_URL="file:./dev.db" npx prisma generate`
Expected: `Your database is now in sync with your Prisma schema` và không lỗi generate.

- [ ] **Step 5: Kiểm tra kiểu và bảng**

Run: `npx tsc --noEmit && sqlite3 dev.db ".tables" | tr ' ' '\n' | grep -c "^Agent"`
Expected: tsc không lỗi; in `3`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma .gitignore
git commit -m "feat(agent): bảng AgentTask/AgentEvent/AgentSettings và cột Violation.agentReview"
```

---

### Task 2: Dependency, script npm, env loader, prisma/audit/settings helpers

**Files:**
- Modify: `package.json`
- Create: `agent/lib/env.ts`, `agent/lib/db.ts`, `agent/lib/audit.ts`, `agent/lib/settings.ts`
- Test: `agent/test/audit.test.ts`

**Interfaces:**
- Produces:
  - `env: { agentPort: number; bridgeUrl: string; bridgeSecret: string | null; snapshotMaxMb: number; anthropicKey: string | null; snapshotDir: string }`
  - `prisma` (re-export từ `@/lib/prisma`)
  - `emit(input: { sessionId: string; taskId?: string | null; subjectType?: string | null; subjectId?: string | null; type: EventType; data: unknown }): Promise<void>`; `newSessionId(): string`
  - `getAgentSettings(): Promise<AgentSettings>`; `isPaused(): Promise<boolean>`

- [ ] **Step 1: Cài dependency**

Run: `npm install @anthropic-ai/sdk && npm install -D tsx`
Expected: cả hai xuất hiện trong `package.json`; `node -e "require('@anthropic-ai/sdk/package.json').version"` in số phiên bản.

- [ ] **Step 2: Thêm script vào `package.json`** (trong `"scripts"`, sau `"dev:yolo"`):

```json
    "dev:agent": "tsx agent/main.ts",
    "test:agent": "DATABASE_URL=file:./agent-test.db prisma db push --accept-data-loss && DATABASE_URL=file:./agent-test.db node --import tsx --test --test-concurrency=1 agent/test/*.test.ts",
```

- [ ] **Step 3: `agent/lib/env.ts`**

```ts
// SPDX-License-Identifier: MIT
import { config } from 'dotenv';
import path from 'node:path';

// .env.local ghi đè .env — giống thứ tự Next.js đọc. Chạy một lần khi import.
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export const env = {
  agentPort: Number(process.env.AGENT_PORT ?? 4002),
  bridgeUrl: process.env.YOLO_BRIDGE_URL?.trim() || 'http://127.0.0.1:4001',
  bridgeSecret: optional('AGENT_BRIDGE_SECRET'),
  snapshotMaxMb: Number(process.env.SNAPSHOT_MAX_MB ?? 2048),
  anthropicKey: optional('ANTHROPIC_API_KEY'),
  snapshotDir: path.resolve(process.cwd(), 'public', 'snapshots'),
};
```

- [ ] **Step 4: `agent/lib/db.ts`**

```ts
// SPDX-License-Identifier: MIT
import './env';
export { prisma } from '@/lib/prisma';
```

- [ ] **Step 5: `agent/lib/audit.ts`**

```ts
// SPDX-License-Identifier: MIT
import { randomUUID } from 'node:crypto';
import { prisma } from './db';

export type EventType =
  | 'tool.call' | 'tool.result' | 'verdict' | 'action' | 'health' | 'error'
  | 'report' | 'message.user' | 'message.assistant' | 'session.started' | 'session.ended';

export interface EmitInput {
  sessionId: string;
  taskId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  type: EventType;
  data: unknown;
}

export function newSessionId(): string {
  return randomUUID();
}

// Không bao giờ ném lỗi: audit hỏng không được làm chết phiên.
export async function emit(input: EmitInput): Promise<void> {
  try {
    await prisma.agentEvent.create({
      data: {
        sessionId: input.sessionId,
        taskId: input.taskId ?? null,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        type: input.type,
        data: JSON.stringify(input.data ?? {}),
      },
    });
  } catch (error) {
    console.warn('[audit] không ghi được event', input.type, error instanceof Error ? error.message : String(error));
  }
}
```

- [ ] **Step 6: `agent/lib/settings.ts`**

```ts
// SPDX-License-Identifier: MIT
import type { AgentSettings } from '@prisma/client';
import { prisma } from './db';

export async function getAgentSettings(): Promise<AgentSettings> {
  const existing = await prisma.agentSettings.findFirst();
  if (existing) return existing;
  return prisma.agentSettings.create({ data: {} });
}

export async function isPaused(): Promise<boolean> {
  return !(await getAgentSettings()).isEnabled;
}
```

- [ ] **Step 7: Test `agent/test/audit.test.ts`**

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { emit, newSessionId } from '../lib/audit';
import { getAgentSettings, isPaused } from '../lib/settings';

test('emit ghi AgentEvent với data JSON', async () => {
  const sessionId = newSessionId();
  await emit({ sessionId, type: 'health', data: { code: 'camera.stalled', cameraId: 'cam-001' } });
  const row = await prisma.agentEvent.findFirst({ where: { sessionId } });
  assert.ok(row);
  assert.equal(row.type, 'health');
  assert.equal(JSON.parse(row.data).code, 'camera.stalled');
});

test('getAgentSettings tạo đúng một dòng và isPaused theo isEnabled', async () => {
  const a = await getAgentSettings();
  const b = await getAgentSettings();
  assert.equal(a.id, b.id);
  assert.equal(await isPaused(), false);
  await prisma.agentSettings.update({ where: { id: a.id }, data: { isEnabled: false } });
  assert.equal(await isPaused(), true);
  await prisma.agentSettings.update({ where: { id: a.id }, data: { isEnabled: true } });
});
```

- [ ] **Step 8: Chạy test (máy tải nhẹ)**

Run: `npm run test:agent`
Expected: `# pass 2`, `# fail 0`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json agent/lib/env.ts agent/lib/db.ts agent/lib/audit.ts agent/lib/settings.ts agent/test/audit.test.ts
git commit -m "feat(agent): nền worker — env, prisma, audit, settings, script test"
```

---

### Task 3: Hàng đợi `agent/lib/tasks.ts`

**Files:**
- Create: `agent/lib/tasks.ts`
- Test: `agent/test/tasks.test.ts`

**Interfaces:**
- Produces:
  - `type Lane = 'direct' | 'research'`; `DIRECT_KINDS`, `KINDS`, `PRIORITY`, `MAX_ATTEMPTS = 3`, `LEASE_MS = 600_000`
  - `type LeasedTask = { id: string; kind: string; subjectType: string | null; subjectId: string | null; reason: string; budget: number; attempts: number; priority: number; dueAt: Date }`
  - `scheduleTask(input: { kind: string; subjectType?: string | null; subjectId?: string | null; reason: string; dueAt: Date; priority?: number; budget?: number }): Promise<{ id: string; merged: boolean }>`
  - `claimDue(limit: number, lane: Lane, now?: Date): Promise<LeasedTask[]>`
  - `completeTask(id: string, outcome: string, sessionId?: string): Promise<void>`
  - `releaseTask(id: string, delayMs: number, note: string): Promise<void>` (trả lease, lùi `dueAt`)
  - `retireExhausted(now?: Date): Promise<number>`
  - `laneOf(kind: string): Lane`

- [ ] **Step 1: Viết test trước `agent/test/tasks.test.ts`**

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { claimDue, completeTask, laneOf, MAX_ATTEMPTS, releaseTask, retireExhausted, scheduleTask } from '../lib/tasks';

test.beforeEach(async () => { await prisma.agentTask.deleteMany(); });

test('laneOf tách đúng hai lane', () => {
  assert.equal(laneOf('health.sweep'), 'direct');
  assert.equal(laneOf('violation.review'), 'research');
});

test('scheduleTask gộp trùng cùng kind + subject chưa xong', async () => {
  const past = new Date(Date.now() - 1000);
  const a = await scheduleTask({ kind: 'violation.review', subjectType: 'violation', subjectId: 'v1', reason: 'lần 1', dueAt: past });
  const b = await scheduleTask({ kind: 'violation.review', subjectType: 'violation', subjectId: 'v1', reason: 'lần 2', dueAt: past });
  assert.equal(a.id, b.id);
  assert.equal(b.merged, true);
  const row = await prisma.agentTask.findUnique({ where: { id: a.id } });
  assert.equal(row?.reason, 'lần 2');
});

test('claimDue chỉ lấy đúng lane, ưu tiên cao trước, và khoá lease', async () => {
  const past = new Date(Date.now() - 1000);
  await scheduleTask({ kind: 'health.sweep', subjectType: 'system', reason: 'sweep', dueAt: past, priority: 900 });
  await scheduleTask({ kind: 'violation.review', subjectType: 'violation', subjectId: 'v2', reason: 'r', dueAt: past, priority: 300 });
  await scheduleTask({ kind: 'ask', subjectType: 'system', reason: 'q', dueAt: past, priority: 500 });
  const research = await claimDue(10, 'research');
  assert.deepEqual(research.map(t => t.kind), ['ask', 'violation.review']);
  assert.equal(research[0].attempts, 1);
  const again = await claimDue(10, 'research');
  assert.equal(again.length, 0, 'đã lease thì không nhặt lại');
  const direct = await claimDue(10, 'direct');
  assert.equal(direct.length, 1);
  assert.equal(direct[0].kind, 'health.sweep');
});

test('releaseTask lùi dueAt và bỏ lease; completeTask đóng task', async () => {
  const past = new Date(Date.now() - 1000);
  const { id } = await scheduleTask({ kind: 'ask', subjectType: 'system', reason: 'q', dueAt: past });
  const [claimed] = await claimDue(1, 'research');
  assert.equal(claimed.id, id);
  await releaseTask(id, 60_000, '429');
  const row = await prisma.agentTask.findUnique({ where: { id } });
  assert.equal(row?.leasedUntil, null);
  assert.ok(row!.dueAt.getTime() > Date.now() + 30_000);
  await prisma.agentTask.update({ where: { id }, data: { dueAt: past } });
  await claimDue(1, 'research');
  await completeTask(id, 'xong', 'sess-1');
  const done = await prisma.agentTask.findUnique({ where: { id } });
  assert.ok(done?.finishedAt);
  assert.equal(done?.sessionId, 'sess-1');
  assert.equal((await claimDue(1, 'research')).length, 0);
});

test('retireExhausted đóng task quá MAX_ATTEMPTS', async () => {
  const past = new Date(Date.now() - 1000);
  const { id } = await scheduleTask({ kind: 'ask', subjectType: 'system', reason: 'q', dueAt: past });
  await prisma.agentTask.update({ where: { id }, data: { attempts: MAX_ATTEMPTS } });
  assert.equal(await retireExhausted(), 1);
  const row = await prisma.agentTask.findUnique({ where: { id } });
  assert.ok(row?.finishedAt);
  assert.match(row!.outcome ?? '', /3 lần/);
});
```

- [ ] **Step 2: Chạy test, mong đợi fail vì module chưa có**

Run: `npm run test:agent`
Expected: lỗi `Cannot find module '../lib/tasks'`.

- [ ] **Step 3: Viết `agent/lib/tasks.ts`**

```ts
// SPDX-License-Identifier: MIT
import { prisma } from './db';

export type Lane = 'direct' | 'research';

export const DIRECT_KINDS = ['health.sweep', 'health.probe', 'snapshot.cleanup'] as const;
export const RESEARCH_KINDS = ['ask', 'violation.review', 'ops.escalate', 'shift.report', 'camera.digest', 'followup'] as const;
export const KINDS = [...DIRECT_KINDS, ...RESEARCH_KINDS] as const;
export type TaskKind = (typeof KINDS)[number];

export const PRIORITY = {
  'health.sweep': 900, 'health.probe': 800, 'ask': 500, 'violation.review': 300,
  'ops.escalate': 250, 'shift.report': 200, 'snapshot.cleanup': 100, 'camera.digest': 50, 'followup': 0,
} as const satisfies Record<TaskKind, number>;

export const MAX_ATTEMPTS = 3;
export const LEASE_MS = 10 * 60_000;
export const RETIRED_OUTCOME = `Bỏ sau ${MAX_ATTEMPTS} lần: phiên không báo cáo lại.`;

export interface LeasedTask {
  id: string; kind: string; subjectType: string | null; subjectId: string | null;
  reason: string; budget: number; attempts: number; priority: number; dueAt: Date;
}

export function laneOf(kind: string): Lane {
  return (DIRECT_KINDS as readonly string[]).includes(kind) ? 'direct' : 'research';
}

export async function scheduleTask(input: {
  kind: string; subjectType?: string | null; subjectId?: string | null;
  reason: string; dueAt: Date; priority?: number; budget?: number;
}): Promise<{ id: string; merged: boolean }> {
  const existing = await prisma.agentTask.findFirst({
    where: { kind: input.kind, finishedAt: null, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null },
    select: { id: true },
  });
  if (existing) {
    await prisma.agentTask.update({ where: { id: existing.id }, data: { dueAt: input.dueAt, reason: input.reason } });
    return { id: existing.id, merged: true };
  }
  const created = await prisma.agentTask.create({
    data: {
      kind: input.kind, subjectType: input.subjectType ?? null, subjectId: input.subjectId ?? null,
      reason: input.reason, dueAt: input.dueAt,
      priority: input.priority ?? (PRIORITY as Record<string, number>)[input.kind] ?? 0,
      budget: input.budget ?? 6,
    },
    select: { id: true },
  });
  return { id: created.id, merged: false };
}

// ponytail: SQLite không có FOR UPDATE SKIP LOCKED — thiết kế cho MỘT worker.
// Nhiều worker/Postgres thì thay bằng UPDATE ... FROM (SELECT ... FOR UPDATE SKIP LOCKED) như CRM lib/tasks.ts.
export async function claimDue(limit: number, lane: Lane, now = new Date()): Promise<LeasedTask[]> {
  const kinds = lane === 'direct' ? [...DIRECT_KINDS] : [...RESEARCH_KINDS];
  const due = await prisma.agentTask.findMany({
    where: {
      finishedAt: null, kind: { in: kinds }, dueAt: { lte: now }, attempts: { lt: MAX_ATTEMPTS },
      OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }],
    },
    orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
    take: limit,
  });
  const leased: LeasedTask[] = [];
  const until = new Date(now.getTime() + LEASE_MS);
  for (const task of due) {
    const { count } = await prisma.agentTask.updateMany({
      where: { id: task.id, OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }] },
      data: { leasedUntil: until, startedAt: task.startedAt ?? now, attempts: { increment: 1 } },
    });
    if (count === 1) {
      leased.push({
        id: task.id, kind: task.kind, subjectType: task.subjectType, subjectId: task.subjectId,
        reason: task.reason, budget: task.budget, attempts: task.attempts + 1, priority: task.priority, dueAt: task.dueAt,
      });
    }
  }
  return leased;
}

export async function completeTask(id: string, outcome: string, sessionId?: string): Promise<void> {
  await prisma.agentTask.updateMany({
    where: { id, finishedAt: null },
    data: { finishedAt: new Date(), leasedUntil: null, outcome: outcome.slice(0, 500), ...(sessionId ? { sessionId } : {}) },
  });
}

export async function releaseTask(id: string, delayMs: number, note: string): Promise<void> {
  await prisma.agentTask.updateMany({
    where: { id, finishedAt: null },
    data: { leasedUntil: null, dueAt: new Date(Date.now() + delayMs), outcome: note.slice(0, 500) },
  });
}

export async function retireExhausted(now = new Date()): Promise<number> {
  const { count } = await prisma.agentTask.updateMany({
    where: { finishedAt: null, attempts: { gte: MAX_ATTEMPTS }, OR: [{ leasedUntil: null }, { leasedUntil: { lt: now } }] },
    data: { finishedAt: now, outcome: RETIRED_OUTCOME },
  });
  return count;
}
```

- [ ] **Step 4: Chạy test**

Run: `npm run test:agent`
Expected: `# pass 7`, `# fail 0` (2 test Task 2 + 5 test này).

- [ ] **Step 5: Commit**

```bash
git add agent/lib/tasks.ts agent/test/tasks.test.ts
git commit -m "feat(agent): hàng đợi AgentTask — schedule/claim/lease/release/retire"
```

---

### Task 4: Rào chắn `agent/lib/guard.ts` và capabilities

**Files:**
- Create: `agent/lib/guard.ts`, `agent/lib/capabilities.ts`
- Test: `agent/test/guard.test.ts`

**Interfaces:**
- Produces:
  - `type Blocked = { blocked: true; reason: string }`; `allow<T>(value: T): { blocked: false } & T`
  - `checkPaused(): Promise<Blocked | null>`
  - `rateLimit(key: string, max: number, windowMs: number, now?: number): boolean` (true = được phép, đếm trong bộ nhớ tiến trình)
  - `LIMITS = { engineRestartPerHour: 3, cameraStatusPerCamera5m: 1, escalatePerSession: 2, followupPerSession: 3 }`
  - `type CapabilityId = 'CLAUDE' | 'TELEGRAM' | 'BRIDGE' | 'ENGINE'`; `capabilities(): Promise<Capability[]>`; `capabilitiesMarkdown(): Promise<string>`; `logCapabilities(): Promise<void>`; `unavailable(id: CapabilityId): { ok: false; configured: false; reason: string }`

- [ ] **Step 1: Test `agent/test/guard.test.ts`**

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, checkPaused } from '../lib/guard';
import { prisma } from '../lib/db';
import { getAgentSettings } from '../lib/settings';

test('rateLimit cho phép đúng max lần trong cửa sổ rồi chặn', () => {
  const t0 = 1_000_000;
  assert.equal(rateLimit('engine', 3, 3_600_000, t0), true);
  assert.equal(rateLimit('engine', 3, 3_600_000, t0 + 1), true);
  assert.equal(rateLimit('engine', 3, 3_600_000, t0 + 2), true);
  assert.equal(rateLimit('engine', 3, 3_600_000, t0 + 3), false);
  assert.equal(rateLimit('engine', 3, 3_600_000, t0 + 3_600_001), true, 'hết cửa sổ thì mở lại');
});

test('checkPaused phản ánh kill switch', async () => {
  const s = await getAgentSettings();
  await prisma.agentSettings.update({ where: { id: s.id }, data: { isEnabled: false } });
  const blocked = await checkPaused();
  assert.ok(blocked && /tạm dừng/.test(blocked.reason));
  await prisma.agentSettings.update({ where: { id: s.id }, data: { isEnabled: true } });
  assert.equal(await checkPaused(), null);
});
```

- [ ] **Step 2: Chạy test → fail `Cannot find module '../lib/guard'`**

- [ ] **Step 3: `agent/lib/guard.ts`**

```ts
// SPDX-License-Identifier: MIT
import { isPaused } from './settings';

export type Blocked = { blocked: true; reason: string };

export const LIMITS = {
  engineRestartPerHour: 3,
  cameraStatusPerCamera5m: 1,
  escalatePerSession: 2,
  followupPerSession: 3,
} as const;

export async function checkPaused(): Promise<Blocked | null> {
  if (await isPaused()) {
    return { blocked: true, reason: 'Agent đang tạm dừng (AgentSettings.isEnabled = false). Không làm gì, chỉ ghi nhận.' };
  }
  return null;
}

// ponytail: bộ đếm trong bộ nhớ tiến trình — đủ cho một worker; restart worker là reset.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function resetRateLimits(): void { hits.clear(); }
```

- [ ] **Step 4: `agent/lib/capabilities.ts`**

```ts
// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';
import { prisma } from './db';

export type CapabilityId = 'CLAUDE' | 'TELEGRAM' | 'BRIDGE' | 'ENGINE';

export interface Capability { id: CapabilityId; label: string; gives: string; enabled: boolean; from: string }

async function bridgeUp(): Promise<boolean> {
  try {
    const res = await fetch(`${env.bridgeUrl}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch { return false; }
}

export async function readHeartbeat(): Promise<{ pid: number; at: string; streams: number; fps: number } | null> {
  try {
    const raw = await readFile(path.join(env.snapshotDir, '.heartbeat.json'), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

export async function capabilities(): Promise<Capability[]> {
  const telegram = await prisma.telegramSettings.findFirst();
  const heartbeat = await readHeartbeat();
  const engineFresh = heartbeat ? Date.now() - new Date(heartbeat.at).getTime() < 30_000 : false;
  return [
    { id: 'CLAUDE', from: 'ANTHROPIC_API_KEY', label: 'Claude', enabled: env.anthropicKey !== null,
      gives: 'lane nghiên cứu: review vi phạm bằng ảnh, báo cáo ca, trả lời câu hỏi' },
    { id: 'TELEGRAM', from: 'Cài đặt → Thông báo', label: 'Telegram', enabled: !!(telegram?.isEnabled && telegram.botTokenEncrypted),
      gives: 'gửi cảnh báo tới người phụ trách theo AlertRule' },
    { id: 'BRIDGE', from: env.bridgeUrl, label: 'YOLO Bridge', enabled: await bridgeUp(),
      gives: 'biết camera nào đang có detection (sức khoẻ camera)' },
    { id: 'ENGINE', from: 'public/snapshots/.heartbeat.json', label: 'AI engine heartbeat', enabled: engineFresh,
      gives: 'biết AI engine còn chạy, số luồng, fps' },
  ];
}

export function unavailable(id: CapabilityId): { ok: false; configured: false; reason: string } {
  return { ok: false, configured: false,
    reason: `Cài đặt này không có ${id}; nguồn đó không dùng được. Không phải lỗi, thử lại không giúp gì — dùng những gì đã có và nói rõ trong kết luận điều chưa kiểm tra được.` };
}

export async function capabilitiesMarkdown(): Promise<string> {
  const all = await capabilities();
  const on = all.filter(c => c.enabled); const off = all.filter(c => !c.enabled);
  const lines = ['## Khả năng của cài đặt này', ''];
  if (on.length) { lines.push('Đang có:'); for (const c of on) lines.push(`- **${c.label}** — ${c.gives}.`); }
  if (off.length) { lines.push('', 'Không có ở đây, đừng lên kế hoạch dựa vào:'); for (const c of off) lines.push(`- ${c.label}`); }
  return lines.join('\n');
}

export async function logCapabilities(): Promise<void> {
  for (const c of await capabilities()) console.log(`[agent] ${c.enabled ? 'on ' : 'off'}  ${c.label} (${c.from})`);
}
```

- [ ] **Step 5: Chạy test** → `# pass 9`.

- [ ] **Step 6: Commit**

```bash
git add agent/lib/guard.ts agent/lib/capabilities.ts agent/test/guard.test.ts
git commit -m "feat(agent): rào chắn (kill switch, rate limit) và capabilities"
```

---

### Task 5: Worker `agent/main.ts`, HTTP nội bộ, dev-all.sh, bridge `/health`, heartbeat Python

**Files:**
- Create: `agent/main.ts`, `agent/channels/http.ts`, `agent/direct/index.ts` (khung), `agent/research/index.ts` (khung)
- Modify: `dev-all.sh`, `ai-engine/yolo_bridge.js:18-29`, `ai-engine/yolo_inference.py:372-456`, `README.md` (mục env), `.env` không có trong repo → ghi vào README

**Interfaces:**
- Produces:
  - `runDirect(task: LeasedTask): Promise<string>` (agent/direct/index.ts — Task 6-7 điền handler; khung trả `'chưa có handler'`)
  - `runResearch(task: LeasedTask, opts?: { sessionId?: string }): Promise<string>` (agent/research/index.ts — Task 12 điền)
  - HTTP: `GET /health` → `{ ok, capabilities, lastSweepAt }`; `POST /internal/dispatch` (Bearer secret) → `202`; `POST /internal/ask` (Bearer secret, body `{ taskId }`) → `202`
  - Bridge: `GET http://127.0.0.1:4001/health` → `{ ok: true, lastDetectionAt: Record<string, string>, clients: number, uptimeSec: number }`
  - Heartbeat: `public/snapshots/.heartbeat.json` = `{ "pid", "at" (ISO), "streams", "fps" }` mỗi 5s

- [ ] **Step 1: `agent/direct/index.ts` (khung)**

```ts
// SPDX-License-Identifier: MIT
import type { LeasedTask } from '../lib/tasks';

export type DirectHandler = (task: LeasedTask) => Promise<string>;
export const directHandlers: Record<string, DirectHandler> = {};

export async function runDirect(task: LeasedTask): Promise<string> {
  const handler = directHandlers[task.kind];
  if (!handler) return `chưa có handler cho ${task.kind}`;
  return handler(task);
}
```

- [ ] **Step 2: `agent/research/index.ts` (khung)**

```ts
// SPDX-License-Identifier: MIT
import type { LeasedTask } from '../lib/tasks';

export async function runResearch(task: LeasedTask, _opts: { sessionId?: string } = {}): Promise<string> {
  return `chưa có phiên nghiên cứu cho ${task.kind}`;
}
```

- [ ] **Step 3: `agent/channels/http.ts`**

```ts
// SPDX-License-Identifier: MIT
import http from 'node:http';
import { env } from '../lib/env';
import { capabilities } from '../lib/capabilities';

export interface HttpHooks { drain: () => void; lastSweepAt: () => Date | null }

function authorised(req: http.IncomingMessage): boolean {
  if (!env.bridgeSecret) return false; // thiếu secret = từ chối, không mở
  return req.headers.authorization === `Bearer ${env.bridgeSecret}`;
}

export function startHttp(hooks: HttpHooks): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = req.url ?? '/';
    if (req.method === 'GET' && url === '/health') {
      const body = JSON.stringify({ ok: true, capabilities: await capabilities(), lastSweepAt: hooks.lastSweepAt() });
      res.writeHead(200, { 'content-type': 'application/json' }); res.end(body); return;
    }
    if (req.method === 'POST' && (url === '/internal/dispatch' || url === '/internal/ask')) {
      if (!authorised(req)) { res.writeHead(401); res.end('Unauthorized'); return; }
      hooks.drain(); // row đã nằm trong DB; chỉ đánh thức vòng lặp sớm
      res.writeHead(202); res.end(); return;
    }
    res.writeHead(404); res.end();
  });
  server.listen(env.agentPort, '127.0.0.1', () => console.log(`✅ Agent HTTP nội bộ: http://127.0.0.1:${env.agentPort}`));
  return server;
}
```

- [ ] **Step 4: `agent/main.ts`**

```ts
// SPDX-License-Identifier: MIT
import './lib/env';
import { logCapabilities } from './lib/capabilities';
import { claimDue, completeTask, releaseTask, retireExhausted, scheduleTask, type LeasedTask } from './lib/tasks';
import { emit, newSessionId } from './lib/audit';
import { runDirect } from './direct/index';
import { runResearch } from './research/index';
import { startHttp } from './channels/http';
import { getAgentSettings } from './lib/settings';

const TICK_MS = 20_000;
const DIRECT_BATCH = 20;
const RESEARCH_BATCH = 2;

let wake: (() => void) | null = null;
let lastSweepAt: Date | null = null;
let stopping = false;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => { wake = () => { wake = null; resolve(); }; setTimeout(() => { if (wake) { wake = null; resolve(); } }, ms); });
}

async function runOne(task: LeasedTask, run: (t: LeasedTask) => Promise<string>): Promise<void> {
  try {
    const outcome = await run(task);
    if (task.kind === 'health.sweep') lastSweepAt = new Date();
    await completeTask(task.id, outcome);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emit({ sessionId: newSessionId(), taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'error', data: { kind: task.kind, message } });
    await releaseTask(task.id, 30_000 * task.attempts, `lỗi: ${message}`);
  }
}

async function tick(): Promise<void> {
  await retireExhausted();
  for (const task of await claimDue(DIRECT_BATCH, 'direct')) await runOne(task, runDirect);
  for (const task of await claimDue(RESEARCH_BATCH, 'research')) await runOne(task, t => runResearch(t));
}

async function seed(): Promise<void> {
  await scheduleTask({ kind: 'health.sweep', subjectType: 'system', reason: 'Quét sức khoẻ định kỳ', dueAt: new Date() });
  const settings = await getAgentSettings();
  const [hh, mm] = settings.shiftReportAt.split(':').map(Number);
  const due = new Date(); due.setHours(hh, mm, 0, 0);
  if (due.getTime() < Date.now()) due.setDate(due.getDate() + 1);
  await scheduleTask({ kind: 'shift.report', subjectType: 'system', reason: `Báo cáo ca lúc ${settings.shiftReportAt}`, dueAt: due });
}

async function main(): Promise<void> {
  console.log('🤖 SafeSight Agent khởi động');
  await logCapabilities();
  await seed();
  startHttp({ drain: () => wake?.(), lastSweepAt: () => lastSweepAt });
  process.on('SIGTERM', () => { stopping = true; wake?.(); });
  process.on('SIGINT', () => { stopping = true; wake?.(); });
  while (!stopping) {
    try { await tick(); } catch (error) { console.error('[agent] tick lỗi', error); }
    await sleep(TICK_MS);
  }
  console.log('[agent] dừng');
  process.exit(0);
}

void main();
```

- [ ] **Step 5: Bridge `GET /health`** — trong `ai-engine/yolo_bridge.js`, thay khối `app.post('/detections', ...)` bằng:

```js
const lastDetectionAt = {};   // cameraId -> thời điểm nhận detection gần nhất (cho agent/health)
const startedAt = Date.now();

app.use(express.json());
app.post('/detections', (req, res) => {
  const { cameraId, detections, videoPos } = req.body;
  lastDetectionAt[cameraId] = new Date().toISOString();
  const targets = [`camera-${cameraId}`, 'all-cameras'];
  io.to(targets).emit('yolo-data', { cameraId, detections, videoPos });

  // Check for violations to trigger UI alerts
  const violation = detections.find(d => d.isViolation);
  if (violation) {
    io.to(targets).emit('new-violation', { cameraId, ...violation });
  }
  res.sendStatus(200);
});

// Sức khoẻ cho agent/direct/health.ts: camera nào còn gửi detection, bao nhiêu client đang xem
app.get('/health', (_req, res) => {
  res.json({ ok: true, lastDetectionAt, clients: io.engine.clientsCount, uptimeSec: Math.round((Date.now() - startedAt) / 1000) });
});
```

- [ ] **Step 6: Heartbeat Python** — trong `ai-engine/yolo_inference.py`, ngay sau dòng `violation_count = {}` (trước `while True:`), thêm:

```python
    # Heartbeat cho agent (agent/lib/capabilities.ts đọc file này): còn sống, bao nhiêu luồng, fps ước lượng.
    HEARTBEAT_PATH = os.path.join(SNAPSHOT_DIR, ".heartbeat.json")
    _hb_last = 0.0
    _hb_frames = 0
```

và ngay trước dòng `time.sleep(0.01)` cuối vòng `while True:`, thêm:

```python
        _hb_frames += 1
        if time.time() - _hb_last >= 5.0:
            try:
                os.makedirs(SNAPSHOT_DIR, exist_ok=True)
                with open(HEARTBEAT_PATH, "w", encoding="utf-8") as f:
                    json.dump({"pid": os.getpid(), "at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                               "streams": len(streams), "fps": round(_hb_frames / max(time.time() - _hb_last, 1e-6), 1)}, f)
            except OSError:
                pass
            _hb_last, _hb_frames = time.time(), 0
```

Lưu ý `clear_snapshots()` chỉ xoá `violation_*.jpg` nên không đụng `.heartbeat.json`. `agent/lib/capabilities.ts` parse `at` bằng `new Date(...)`: định dạng `%Y-%m-%dT%H:%M:%S%z` (vd `2026-09-07T11:20:06+0700`) được `Date` chấp nhận.

- [ ] **Step 7: `dev-all.sh`** — thay khối `# 2) YOLO inference` bằng:

```bash
# 2) YOLO inference — chạy model thật (ưu tiên python trong .venv).
#    Bọc trong vòng until: tiến trình thoát (kể cả do agent gửi SIGTERM khi treo) thì tự chạy lại sau 2s.
if [ -x ".venv/bin/python" ]; then
  (until .venv/bin/python ai-engine/yolo_inference.py; do echo "[dev] AI engine thoát, chạy lại sau 2s..."; sleep 2; done) &
else
  echo "[dev] ⚠️  Chưa có .venv — bỏ qua YOLO inference."
  echo "[dev]     Tạo venv + cài thư viện rồi chạy: npm run dev:yolo"
fi

# 2b) Agent — trực vận hành + cán bộ an toàn (port 4002). Thiếu ANTHROPIC_API_KEY vẫn chạy lane trực tiếp.
lsof -ti:4002 2>/dev/null | xargs kill -9 2>/dev/null || true
npx tsx agent/main.ts &
```

và sửa dòng echo mở đầu thành `echo "[dev] 🚀 Khởi động SafeSight (frontend + bridge + YOLO + agent)..."`.

- [ ] **Step 8: README** — trong mục "Chạy dự án", bảng tiến trình thêm dòng `| Agent (trực vận hành + cán bộ an toàn) | \`npm run dev:agent\` | 4002 (nội bộ) |`; trong khối cài đặt `.env.local` thêm:

```
                      # AGENT_BRIDGE_SECRET (bắt buộc để Next đánh thức agent và gửi câu hỏi từ
                      # panel; thiếu thì agent vẫn chạy theo chu kỳ 20s, sinh bằng
                      # `openssl rand -base64 24`)
                      #
                      # ANTHROPIC_API_KEY (tuỳ chọn — mở lane nghiên cứu của agent: review vi
                      # phạm bằng ảnh, báo cáo ca, hỏi đáp; thiếu thì chỉ chạy trực vận hành)
```

- [ ] **Step 9: Kiểm tra (máy tải nhẹ)**

Run: `npx tsc --noEmit && node -e "require('child_process').execSync('node --check ai-engine/yolo_bridge.js')" && python3 -m py_compile ai-engine/yolo_inference.py && echo OK`
Expected: `OK`.

Run: `AGENT_BRIDGE_SECRET=x DATABASE_URL=file:./dev.db timeout 25 npx tsx agent/main.ts; echo "exit $?"`
Expected: in `[agent] on/off ...` 4 dòng capability, `✅ Agent HTTP nội bộ`, không stack trace; exit 124 (timeout) là bình thường. Trong lúc chạy: `curl -s 127.0.0.1:4002/health | head -c 120` trả JSON `{"ok":true,...}`; `curl -s -o /dev/null -w "%{http_code}" -X POST 127.0.0.1:4002/internal/dispatch` trả `401`.

Run: `sqlite3 dev.db "select kind, reason from AgentTask where finishedAt is null"`
Expected: có `health.sweep` và `shift.report` (sweep có thể đã kết thúc với outcome "chưa có handler" — hợp lệ ở task này).

- [ ] **Step 10: Commit**

```bash
git add agent/main.ts agent/channels/http.ts agent/direct/index.ts agent/research/index.ts dev-all.sh ai-engine/yolo_bridge.js ai-engine/yolo_inference.py README.md
git commit -m "feat(agent): worker dispatch hai lane, HTTP nội bộ, heartbeat AI engine, bridge /health"
```

---

## Pha 2 — Trực vận hành (lane trực tiếp)

### Task 6: Thu tín hiệu và quyết định — `agent/direct/health.ts`

**Files:**
- Create: `agent/direct/health.ts`
- Test: `agent/test/health.test.ts`

**Interfaces:**
- Produces:
  - `type HealthSignals = { now: number; bridge: { ok: boolean; lastDetectionAt: Record<string, string> } | null; heartbeat: { pid: number; at: string; streams: number; fps: number } | null; pidAlive: boolean; snapshotBytes: number; modelFiles: { required: boolean; present: boolean }[]; cameras: { id: string; status: string; rtspUrl: string }[] }`
  - `type FindingCode = 'camera.stalled' | 'camera.recovered' | 'engine.stalled' | 'bridge.down' | 'disk.pressure' | 'model.missing'`
  - `type Finding = { code: FindingCode; subjectType: 'camera' | 'system'; subjectId: string | null; detail: Record<string, unknown> }`
  - `collectSignals(): Promise<HealthSignals>`
  - `decide(signals: HealthSignals, opts: { snapshotMaxMb: number; bridgeFailStreak: number }): Finding[]` — thuần, không I/O
  - `THRESHOLDS = { cameraStalledMs: 90_000, cameraOfflineMs: 600_000, heartbeatStaleMs: 30_000, bridgeFailStreak: 3 }`

- [ ] **Step 1: Test `agent/test/health.test.ts`** (thuần, không DB)

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { decide, THRESHOLDS, type HealthSignals } from '../direct/health';

const now = Date.parse('2026-09-07T10:00:00Z');
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

function base(over: Partial<HealthSignals> = {}): HealthSignals {
  return {
    now,
    bridge: { ok: true, lastDetectionAt: { 'cam-001': iso(5_000) } },
    heartbeat: { pid: 4242, at: iso(2_000), streams: 1, fps: 3.5 },
    pidAlive: true,
    snapshotBytes: 10 * 1024 * 1024,
    modelFiles: [{ required: true, present: true }],
    cameras: [{ id: 'cam-001', status: 'ONLINE', rtspUrl: 'video:samples1.mp4' }],
    ...over,
  };
}

const opts = { snapshotMaxMb: 2048, bridgeFailStreak: 0 };
const codes = (f: ReturnType<typeof decide>) => f.map(x => x.code).sort();

test('bình thường → không phát hiện gì', () => {
  assert.deepEqual(decide(base(), opts), []);
});

test('camera ONLINE không có detection > 90s → camera.stalled; > 10 phút kèm detail.offline', () => {
  const f = decide(base({ bridge: { ok: true, lastDetectionAt: { 'cam-001': iso(THRESHOLDS.cameraStalledMs + 1) } } }), opts);
  assert.deepEqual(codes(f), ['camera.stalled']);
  assert.equal(f[0].subjectId, 'cam-001');
  assert.equal(f[0].detail.offline, false);
  const g = decide(base({ bridge: { ok: true, lastDetectionAt: {} } }), opts); // chưa từng thấy
  assert.equal(g[0].detail.offline, true);
});

test('camera OFFLINE/DEGRADED mà có detection mới → camera.recovered', () => {
  const f = decide(base({ cameras: [{ id: 'cam-001', status: 'DEGRADED', rtspUrl: 'webcam:0' }] }), opts);
  assert.deepEqual(codes(f), ['camera.recovered']);
});

test('heartbeat cũ hoặc pid chết → engine.stalled', () => {
  assert.deepEqual(codes(decide(base({ heartbeat: { pid: 1, at: iso(THRESHOLDS.heartbeatStaleMs + 1), streams: 1, fps: 0 } }), opts)), ['engine.stalled']);
  assert.deepEqual(codes(decide(base({ pidAlive: false }), opts)), ['engine.stalled']);
  assert.deepEqual(decide(base({ heartbeat: null }), opts), [], 'chưa từng có heartbeat = engine chưa bật, không phải treo');
});

test('bridge lỗi 3 vòng liên tiếp → bridge.down, và không xét camera khi bridge null', () => {
  assert.deepEqual(decide(base({ bridge: null }), { ...opts, bridgeFailStreak: 2 }), []);
  assert.deepEqual(codes(decide(base({ bridge: null }), { ...opts, bridgeFailStreak: 3 })), ['bridge.down']);
});

test('snapshot vượt trần → disk.pressure; thiếu model bắt buộc → model.missing', () => {
  assert.deepEqual(codes(decide(base({ snapshotBytes: 3 * 1024 * 1024 * 1024 }), opts)), ['disk.pressure']);
  assert.deepEqual(codes(decide(base({ modelFiles: [{ required: true, present: false }] }), opts)), ['model.missing']);
});
```

- [ ] **Step 2: Chạy `npm run test:agent`** → fail `Cannot find module '../direct/health'`.

- [ ] **Step 3: `agent/direct/health.ts`**

```ts
// SPDX-License-Identifier: MIT
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env';
import { prisma } from '../lib/db';
import { readHeartbeat } from '../lib/capabilities';

export const THRESHOLDS = { cameraStalledMs: 90_000, cameraOfflineMs: 600_000, heartbeatStaleMs: 30_000, bridgeFailStreak: 3 } as const;

export const MODEL_FILES = [
  { file: 'ppe_multiclass.pt', required: true },
  { file: 'ppe_boots.pt', required: false },
  { file: 'ppe_gang.pt', required: false },
  { file: 'yolov8n-pose.pt', required: false },
] as const;

export interface HealthSignals {
  now: number;
  bridge: { ok: boolean; lastDetectionAt: Record<string, string> } | null;
  heartbeat: { pid: number; at: string; streams: number; fps: number } | null;
  pidAlive: boolean;
  snapshotBytes: number;
  modelFiles: { required: boolean; present: boolean; file?: string }[];
  cameras: { id: string; status: string; rtspUrl: string }[];
}

export type FindingCode = 'camera.stalled' | 'camera.recovered' | 'engine.stalled' | 'bridge.down' | 'disk.pressure' | 'model.missing';
export interface Finding { code: FindingCode; subjectType: 'camera' | 'system'; subjectId: string | null; detail: Record<string, unknown> }

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function dirBytes(dir: string): Promise<number> {
  try {
    let total = 0;
    for (const name of await readdir(dir)) {
      if (!name.endsWith('.jpg')) continue;
      total += (await stat(path.join(dir, name))).size;
    }
    return total;
  } catch { return 0; }
}

async function exists(file: string): Promise<boolean> {
  try { await stat(path.resolve(process.cwd(), file)); return true; } catch { return false; }
}

export async function collectSignals(): Promise<HealthSignals> {
  let bridge: HealthSignals['bridge'] = null;
  try {
    const res = await fetch(`${env.bridgeUrl}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) { const j = await res.json(); bridge = { ok: true, lastDetectionAt: j.lastDetectionAt ?? {} }; }
  } catch { bridge = null; }
  const heartbeat = await readHeartbeat();
  const cameras = await prisma.camera.findMany({ select: { id: true, status: true, rtspUrl: true } });
  return {
    now: Date.now(),
    bridge,
    heartbeat,
    pidAlive: heartbeat ? pidAlive(heartbeat.pid) : false,
    snapshotBytes: await dirBytes(env.snapshotDir),
    modelFiles: await Promise.all(MODEL_FILES.map(async m => ({ file: m.file, required: m.required, present: await exists(m.file) }))),
    cameras,
  };
}

export function decide(s: HealthSignals, opts: { snapshotMaxMb: number; bridgeFailStreak: number }): Finding[] {
  const out: Finding[] = [];

  if (s.bridge === null) {
    if (opts.bridgeFailStreak >= THRESHOLDS.bridgeFailStreak) out.push({ code: 'bridge.down', subjectType: 'system', subjectId: null, detail: { streak: opts.bridgeFailStreak } });
  } else {
    for (const cam of s.cameras) {
      const last = s.bridge.lastDetectionAt[cam.id];
      const ageMs = last ? s.now - Date.parse(last) : Number.POSITIVE_INFINITY;
      const stalled = ageMs > THRESHOLDS.cameraStalledMs;
      if (cam.status === 'ONLINE' && stalled) {
        out.push({ code: 'camera.stalled', subjectType: 'camera', subjectId: cam.id, detail: { ageMs, offline: ageMs > THRESHOLDS.cameraOfflineMs, rtspUrl: cam.rtspUrl } });
      } else if ((cam.status === 'DEGRADED' || cam.status === 'OFFLINE') && !stalled) {
        out.push({ code: 'camera.recovered', subjectType: 'camera', subjectId: cam.id, detail: { ageMs } });
      }
    }
  }

  if (s.heartbeat) {
    const age = s.now - Date.parse(s.heartbeat.at);
    if (age > THRESHOLDS.heartbeatStaleMs || !s.pidAlive) {
      out.push({ code: 'engine.stalled', subjectType: 'system', subjectId: null, detail: { pid: s.heartbeat.pid, heartbeatAgeMs: age, pidAlive: s.pidAlive } });
    }
  }

  if (s.snapshotBytes > opts.snapshotMaxMb * 1024 * 1024) {
    out.push({ code: 'disk.pressure', subjectType: 'system', subjectId: null, detail: { bytes: s.snapshotBytes, maxMb: opts.snapshotMaxMb } });
  }
  for (const m of s.modelFiles) {
    if (m.required && !m.present) out.push({ code: 'model.missing', subjectType: 'system', subjectId: null, detail: { file: m.file ?? 'ppe_multiclass.pt' } });
  }
  return out;
}
```

- [ ] **Step 4: Chạy test** → `# pass 15` (9 trước + 6 mới).

- [ ] **Step 5: Commit**

```bash
git add agent/direct/health.ts agent/test/health.test.ts
git commit -m "feat(agent): thu tín hiệu sức khoẻ và quyết định tất định"
```

---

### Task 7: Hành động vận hành — `agent/direct/actions.ts`, `sweep.ts`, `cleanup.ts`, thông báo admin

**Files:**
- Create: `agent/direct/actions.ts`, `agent/direct/sweep.ts`, `agent/direct/cleanup.ts`, `agent/lib/notify.ts`
- Modify: `agent/direct/index.ts` (đăng ký handler), `src/lib/alert-notifier.ts:104` (thêm tham số caption)
- Test: `agent/test/actions.test.ts`

**Interfaces:**
- Consumes: `decide`, `collectSignals`, `Finding` (Task 6); `rateLimit`, `LIMITS`, `checkPaused` (Task 4); `scheduleTask`, `PRIORITY` (Task 3); `emit` (Task 2).
- Produces:
  - `notifyViolation(violation, camera, opts?: { caption?: string })` — mở rộng hàm sẵn có, tương thích ngược
  - `sendOpsAlert(text: string): Promise<{ sent: boolean; reason?: string }>` — Telegram tới người nhận vận hành (AlertRule bật đầu tiên có `violationTypes = []`, không có thì rule bật đầu tiên bất kỳ; không có rule → `{ sent:false }`)
  - `applyFindings(findings: Finding[], ctx: { sessionId: string; taskId: string; repeats: Map<string, number> }): Promise<string[]>` — trả mô tả hành động đã làm
  - `pickCleanup(files: { name: string; mtimeMs: number; referenced: boolean }[], now: number, targetBytes: number, sizes: Record<string, number>): string[]` — thuần: chọn file xoá
  - handler `health.sweep`, `health.probe`, `snapshot.cleanup` đăng ký vào `directHandlers`

- [ ] **Step 1: Mở rộng `src/lib/alert-notifier.ts`** — đổi chữ ký hai hàm:

```ts
async function sendToRecipients(rule: MatchedRule, violation: Violation, camera: Camera, botToken: string, captionOverride?: string): Promise<void> {
  const client = new TelegramClient(botToken);
  const title =
    violation.occurrenceCount <= 1
      ? '⚠️ Nhắc nhở vi phạm ATLĐ'
      : `🚨 Vi phạm ATLĐ (lần ${violation.occurrenceCount})`;
  const caption = captionOverride ??
    `<b>${title}</b>\n` +
    `Loại vi phạm: ${getViolationTypeLabel(violation.type)}\n` +
    `Camera: ${camera.name}\n` +
    `Thời gian: ${violation.detectedAt.toISOString()}`;
  // ... phần còn lại giữ nguyên
```

và

```ts
export async function notifyViolation(violation: Violation, camera: Camera, opts: { caption?: string } = {}): Promise<void> {
  // ... giữ nguyên, chỉ đổi dòng gọi:
    await sendToRecipients(rule, violation, camera, botToken, opts.caption);
```

Chạy `npx tsc --noEmit` → không lỗi (caller cũ trong `violations/route.ts` không đổi).

- [ ] **Step 2: `agent/lib/notify.ts`**

```ts
// SPDX-License-Identifier: MIT
import { prisma } from './db';
import { decrypt } from '@/lib/crypto';
import { TelegramClient } from '@/lib/telegram';
import { AlertChannel } from '@/types/enums';

function parseArray(value: string): string[] {
  try { const v = JSON.parse(value); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Người nhận vận hành: rule Telegram đang bật có violationTypes rỗng (= mọi loại), không có thì rule Telegram bật đầu tiên.
export async function opsRecipients(): Promise<{ ruleId: string; chatIds: string[] } | null> {
  const rules = await prisma.alertRule.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  const telegram = rules.filter(r => parseArray(r.channels).includes(AlertChannel.TELEGRAM));
  const pick = telegram.find(r => parseArray(r.violationTypes).length === 0) ?? telegram[0];
  if (!pick) return null;
  return { ruleId: pick.id, chatIds: parseArray(pick.recipients) };
}

export async function sendOpsAlert(text: string): Promise<{ sent: boolean; reason?: string }> {
  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.isEnabled || !settings.botTokenEncrypted) return { sent: false, reason: 'Telegram chưa bật' };
  const to = await opsRecipients();
  if (!to || to.chatIds.length === 0) return { sent: false, reason: 'chưa có AlertRule Telegram nào' };
  const client = new TelegramClient(decrypt(settings.botTokenEncrypted));
  let ok = false;
  for (const chatId of to.chatIds) {
    const r = await client.sendMessage(chatId, text);
    ok = ok || r.ok;
  }
  return ok ? { sent: true } : { sent: false, reason: 'Telegram trả lỗi' };
}
```

Kiểm tra `TelegramClient.sendMessage(chatId, text)` tồn tại trong `src/lib/telegram.ts` (`grep -n "sendMessage" src/lib/telegram.ts`); nếu tên khác thì dùng đúng tên trong file.

- [ ] **Step 3: Test `agent/test/actions.test.ts`** (thuần cho `pickCleanup`)

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCleanup } from '../direct/cleanup';

const DAY = 86_400_000;
const now = Date.parse('2026-09-07T10:00:00Z');

test('pickCleanup xoá cũ nhất trước, không đụng file < 24h hay file chưa có Violation tham chiếu', () => {
  const files = [
    { name: 'violation_a.jpg', mtimeMs: now - 40 * DAY, referenced: true },
    { name: 'violation_b.jpg', mtimeMs: now - 35 * DAY, referenced: true },
    { name: 'violation_c.jpg', mtimeMs: now - 2 * DAY, referenced: true },
    { name: 'violation_d.jpg', mtimeMs: now - 50 * DAY, referenced: false },
    { name: 'violation_e.jpg', mtimeMs: now - 1000, referenced: true },
  ];
  const sizes = { 'violation_a.jpg': 100, 'violation_b.jpg': 100, 'violation_c.jpg': 100, 'violation_d.jpg': 100, 'violation_e.jpg': 100 };
  assert.deepEqual(pickCleanup(files, now, 150, sizes), ['violation_a.jpg', 'violation_b.jpg']);
  assert.deepEqual(pickCleanup(files, now, 1000, sizes), ['violation_a.jpg', 'violation_b.jpg'], 'chỉ xoá file > 30 ngày có tham chiếu');
});
```

- [ ] **Step 4: Chạy test → fail `Cannot find module '../direct/cleanup'`**

- [ ] **Step 5: `agent/direct/cleanup.ts`**

```ts
// SPDX-License-Identifier: MIT
import { readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../lib/env';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import type { LeasedTask } from '../lib/tasks';

const DAY = 86_400_000;
export const KEEP_DAYS = 30;

// Thuần: chọn file xoá tới khi giải phóng đủ targetBytes. Chỉ file > 30 ngày VÀ đã có Violation tham chiếu
// (ảnh chưa tham chiếu có thể đang được ghi; ảnh < 24h là bằng chứng mới, không bao giờ đụng).
export function pickCleanup(files: { name: string; mtimeMs: number; referenced: boolean }[], now: number, targetBytes: number, sizes: Record<string, number>): string[] {
  const eligible = files
    .filter(f => f.referenced && now - f.mtimeMs > KEEP_DAYS * DAY && now - f.mtimeMs > DAY)
    .sort((a, b) => a.mtimeMs - b.mtimeMs);
  const out: string[] = []; let freed = 0;
  for (const f of eligible) { if (freed >= targetBytes) break; out.push(f.name); freed += sizes[f.name] ?? 0; }
  return out;
}

export async function runCleanup(task: LeasedTask, sessionId: string): Promise<string> {
  const names = (await readdir(env.snapshotDir)).filter(n => n.startsWith('violation_') && n.endsWith('.jpg'));
  const urls = names.map(n => `/snapshots/${n}`);
  const referenced = new Set((await prisma.violation.findMany({ where: { snapshotUrl: { in: urls } }, select: { snapshotUrl: true } })).map(v => path.basename(v.snapshotUrl)));
  const files = []; const sizes: Record<string, number> = {};
  for (const name of names) { const s = await stat(path.join(env.snapshotDir, name)); files.push({ name, mtimeMs: s.mtimeMs, referenced: referenced.has(name) }); sizes[name] = s.size; }
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  const target = Math.max(0, total - env.snapshotMaxMb * 1024 * 1024 * 0.8);
  const picked = pickCleanup(files, Date.now(), target, sizes);
  for (const name of picked) { try { await unlink(path.join(env.snapshotDir, name)); } catch { /* đã mất thì thôi */ } }
  await emit({ sessionId, taskId: task.id, subjectType: 'system', type: 'action', data: { action: 'snapshot.cleanup', deleted: picked.length, freedBytes: picked.reduce((a, n) => a + (sizes[n] ?? 0), 0) } });
  return `đã xoá ${picked.length} ảnh`;
}
```

- [ ] **Step 6: `agent/direct/actions.ts`**

```ts
// SPDX-License-Identifier: MIT
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { LIMITS, rateLimit } from '../lib/guard';
import { PRIORITY, scheduleTask } from '../lib/tasks';
import { sendOpsAlert } from '../lib/notify';
import type { Finding } from './health';

export interface ActionContext { sessionId: string; taskId: string; repeats: Map<string, number> }

const OPS_ALERT_AFTER = 3;

async function setCameraStatus(cameraId: string, status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'): Promise<boolean> {
  if (!rateLimit(`camera-status:${cameraId}`, LIMITS.cameraStatusPerCamera5m, 5 * 60_000)) return false;
  await prisma.camera.updateMany({ where: { id: cameraId, NOT: { status } }, data: { status } });
  return true;
}

export async function applyFindings(findings: Finding[], ctx: ActionContext): Promise<string[]> {
  const done: string[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    const key = `${f.code}:${f.subjectId ?? 'system'}`;
    seen.add(key);
    const repeats = (ctx.repeats.get(key) ?? 0) + 1;
    ctx.repeats.set(key, repeats);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: f.subjectType, subjectId: f.subjectId, type: 'health', data: { ...f, repeats } });

    switch (f.code) {
      case 'camera.stalled': {
        const status = f.detail.offline ? 'OFFLINE' : 'DEGRADED';
        if (await setCameraStatus(f.subjectId!, status)) done.push(`${f.subjectId} → ${status}`);
        break;
      }
      case 'camera.recovered': {
        if (await setCameraStatus(f.subjectId!, 'ONLINE')) done.push(`${f.subjectId} → ONLINE`);
        break;
      }
      case 'engine.stalled': {
        const pid = Number(f.detail.pid);
        if (rateLimit('engine-restart', LIMITS.engineRestartPerHour, 3_600_000) && Number.isFinite(pid) && pid > 1) {
          try { process.kill(pid, 'SIGTERM'); done.push(`SIGTERM AI engine pid ${pid} (dev-all.sh tự chạy lại)`); } catch { /* pid đã chết */ }
        }
        break;
      }
      case 'disk.pressure': {
        await scheduleTask({ kind: 'snapshot.cleanup', subjectType: 'system', reason: `Ảnh vi phạm ${Math.round(Number(f.detail.bytes) / 1048576)}MB vượt trần ${f.detail.maxMb}MB`, dueAt: new Date(), priority: PRIORITY['snapshot.cleanup'] });
        done.push('xếp lịch dọn ảnh');
        break;
      }
      case 'bridge.down':
      case 'model.missing': break; // chỉ leo thang khi lặp (bên dưới)
    }

    if (repeats === OPS_ALERT_AFTER || f.code === 'model.missing' && repeats === 1) {
      const text = `🛠 SafeSight agent: ${f.code}${f.subjectId ? ` (${f.subjectId})` : ''} lặp ${repeats} lần. ${JSON.stringify(f.detail)}`;
      const r = await sendOpsAlert(text);
      await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: f.subjectType, subjectId: f.subjectId, type: 'action', data: { action: 'ops.telegram', sent: r.sent, reason: r.reason } });
      await scheduleTask({ kind: 'ops.escalate', subjectType: f.subjectType, subjectId: f.subjectId, reason: `${f.code} lặp ${repeats} lần, không tự xử được`, dueAt: new Date(), priority: PRIORITY['ops.escalate'] });
      done.push(`leo thang ${f.code}`);
    }
    for (const a of done.slice(-1)) await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: f.subjectType, subjectId: f.subjectId, type: 'action', data: { action: a, code: f.code } });
  }
  for (const key of [...ctx.repeats.keys()]) if (!seen.has(key)) ctx.repeats.delete(key); // hết lỗi thì reset đếm
  return done;
}
```

- [ ] **Step 7: `agent/direct/sweep.ts`**

```ts
// SPDX-License-Identifier: MIT
import { env } from '../lib/env';
import { newSessionId } from '../lib/audit';
import { checkPaused } from '../lib/guard';
import { scheduleTask, type LeasedTask } from '../lib/tasks';
import { collectSignals, decide } from './health';
import { applyFindings } from './actions';

const SWEEP_EVERY_MS = 60_000;
const repeats = new Map<string, number>();
let bridgeFailStreak = 0;

export async function runSweep(task: LeasedTask): Promise<string> {
  const sessionId = newSessionId();
  const signals = await collectSignals();
  bridgeFailStreak = signals.bridge ? 0 : bridgeFailStreak + 1;
  const findings = decide(signals, { snapshotMaxMb: env.snapshotMaxMb, bridgeFailStreak });
  const paused = await checkPaused();
  const actions = paused ? [] : await applyFindings(findings, { sessionId, taskId: task.id, repeats });
  // Lặp: task mới, không cron.
  await scheduleTask({ kind: 'health.sweep', subjectType: 'system', reason: 'Quét sức khoẻ định kỳ', dueAt: new Date(Date.now() + SWEEP_EVERY_MS) });
  return `${findings.length} phát hiện, ${actions.length} hành động${paused ? ' (đang tạm dừng, chỉ ghi nhận)' : ''}`;
}

// Kiểm một camera vừa đổi nguồn/trạng thái: sweep ngay, không chờ 60s.
export async function runProbe(task: LeasedTask): Promise<string> {
  return runSweep(task);
}
```

- [ ] **Step 8: Đăng ký handler** — sửa `agent/direct/index.ts`:

```ts
// SPDX-License-Identifier: MIT
import type { LeasedTask } from '../lib/tasks';
import { newSessionId } from '../lib/audit';
import { runSweep, runProbe } from './sweep';
import { runCleanup } from './cleanup';

export type DirectHandler = (task: LeasedTask) => Promise<string>;
export const directHandlers: Record<string, DirectHandler> = {
  'health.sweep': runSweep,
  'health.probe': runProbe,
  'snapshot.cleanup': (task) => runCleanup(task, newSessionId()),
};

export async function runDirect(task: LeasedTask): Promise<string> {
  const handler = directHandlers[task.kind];
  if (!handler) return `chưa có handler cho ${task.kind}`;
  return handler(task);
}
```

- [ ] **Step 9: Poke từ Next khi đổi camera** — tạo `src/lib/agent-bridge.ts`:

```ts
// SPDX-License-Identifier: MIT
import { prisma } from '@/lib/prisma';

const AGENT_URL = `http://127.0.0.1:${process.env.AGENT_PORT ?? 4002}`;

export async function enqueueAgentTask(input: { kind: string; subjectType: string; subjectId?: string | null; reason: string; priority: number; budget?: number; dueAt?: Date }): Promise<string> {
  const existing = await prisma.agentTask.findFirst({ where: { kind: input.kind, finishedAt: null, subjectType: input.subjectType, subjectId: input.subjectId ?? null }, select: { id: true } });
  if (existing) { await prisma.agentTask.update({ where: { id: existing.id }, data: { reason: input.reason, dueAt: input.dueAt ?? new Date() } }); return existing.id; }
  const row = await prisma.agentTask.create({ data: { kind: input.kind, subjectType: input.subjectType, subjectId: input.subjectId ?? null, reason: input.reason, priority: input.priority, budget: input.budget ?? 6, dueAt: input.dueAt ?? new Date() }, select: { id: true } });
  return row.id;
}

// Fire-and-forget: row đã là thông điệp; thiếu secret thì KHÔNG gọi (agent tự nhặt ở vòng 20s).
export function pokeAgent(path: '/internal/dispatch' | '/internal/ask', body: unknown = {}): void {
  const secret = process.env.AGENT_BRIDGE_SECRET?.trim();
  if (!secret) return;
  fetch(`${AGENT_URL}${path}`, { method: 'POST', headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(2000) })
    .catch(err => console.warn('[agent-bridge] poke thất bại', err instanceof Error ? err.message : String(err)));
}
```

Trong `src/app/api/cameras/[id]/route.ts`, trong `PATCH` ngay trước `return NextResponse.json(...)` thành công, thêm:

```ts
  await enqueueAgentTask({ kind: 'health.probe', subjectType: 'camera', subjectId: id, reason: 'Camera vừa được sửa trong Cài đặt', priority: 800 });
  pokeAgent('/internal/dispatch');
```

(và `import { enqueueAgentTask, pokeAgent } from '@/lib/agent-bridge';` ở đầu file; `id` là biến id camera đang dùng trong route — đọc file để lấy đúng tên biến).

- [ ] **Step 10: Chạy test + typecheck**

Run: `npm run test:agent && npx tsc --noEmit`
Expected: `# pass 16`, tsc không lỗi.

- [ ] **Step 11: Kiểm thủ công (máy tải nhẹ, cần bridge chạy: `npm run dev:bridge &`)**

Run: `AGENT_BRIDGE_SECRET=x DATABASE_URL=file:./dev.db timeout 40 npx tsx agent/main.ts`
Rồi: `sqlite3 dev.db "select type, substr(data,1,120) from AgentEvent order by emittedAt desc limit 5"`
Expected: có event `health` với `camera.stalled` cho các cam ONLINE (không có AI engine chạy nên bridge không có detection), và `Camera.status` của chúng chuyển `DEGRADED`: `sqlite3 dev.db "select id,status from Camera"`. Dừng bridge: `pkill -f yolo_bridge.js`.

- [ ] **Step 12: Commit**

```bash
git add agent/direct agent/lib/notify.ts src/lib/alert-notifier.ts src/lib/agent-bridge.ts "src/app/api/cameras/[id]/route.ts" agent/test/actions.test.ts
git commit -m "feat(agent): trực vận hành — sweep, hành động tất định, dọn ảnh, leo thang admin"
```

---

## Pha 3 — Cán bộ an toàn (lane nghiên cứu)

### Task 8: Ledger bằng chứng `agent/lib/evidence.ts`

**Files:**
- Create: `agent/lib/evidence.ts`
- Test: `agent/test/evidence.test.ts`

**Interfaces:**
- Produces:
  - `OBSERVATION_KINDS` (tuple), `type ObservationKind`, `WEIGHTS: Record<ObservationKind, { weight: number; primary: boolean; label: string; direction: 'false_positive' | 'violation' | 'neutral' | 'contra' }>`
  - `type Band = 'VERIFIED' | 'PROBABLE' | 'POSSIBLE'`; `BAND_FLOOR = { VERIFIED: 0.85, PROBABLE: 0.55, POSSIBLE: 0.3 }`
  - `scoreEvidence(kinds: ObservationKind[]): { verdict: 'false_positive' | 'violation' | 'undecided'; score: number; band: Band | null; hasPrimary: boolean; rationale: string }`

- [ ] **Step 1: Test `agent/test/evidence.test.ts`**

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreEvidence } from '../lib/evidence';

test('một primary mạnh về báo oan → VERIFIED false_positive', () => {
  const r = scoreEvidence(['snapshot.no-person']);
  assert.equal(r.verdict, 'false_positive'); assert.equal(r.band, 'VERIFIED'); assert.equal(r.hasPrimary, true);
});

test('thấy rõ thiếu + tái phạm → VERIFIED violation', () => {
  const r = scoreEvidence(['snapshot.ppe-clearly-missing', 'track.confirmed-repeat']);
  assert.equal(r.verdict, 'violation'); assert.equal(r.band, 'VERIFIED');
});

test('chỉ bằng chứng phụ → không VERIFIED, không có primary', () => {
  const r = scoreEvidence(['history.camera-false-positive-prone', 'snapshot.occluded-or-backlit']);
  assert.equal(r.hasPrimary, false); assert.notEqual(r.band, 'VERIFIED');
  assert.equal(r.verdict, 'false_positive');
});

test('mâu thuẫn kéo điểm xuống; không quan sát → undecided', () => {
  const a = scoreEvidence(['snapshot.ppe-visible']);
  const b = scoreEvidence(['snapshot.ppe-visible', 'contradiction']);
  assert.ok(b.score < a.score);
  assert.equal(scoreEvidence([]).verdict, 'undecided');
  assert.equal(scoreEvidence([]).band, null);
});
```

- [ ] **Step 2: Chạy test → fail module.**

- [ ] **Step 3: `agent/lib/evidence.ts`**

```ts
// SPDX-License-Identifier: MIT
export const OBSERVATION_KINDS = [
  'snapshot.no-person', 'snapshot.ppe-visible', 'snapshot.ppe-clearly-missing', 'track.confirmed-repeat',
  'history.camera-false-positive-prone', 'snapshot.occluded-or-backlit', 'snapshot.person-outside-work-zone', 'contradiction',
] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

type Direction = 'false_positive' | 'violation' | 'neutral' | 'contra';

export const WEIGHTS: Record<ObservationKind, { weight: number; primary: boolean; label: string; direction: Direction }> = {
  'snapshot.no-person':                  { weight: 0.95, primary: true,  direction: 'false_positive', label: 'khung đỏ không có người (vật/bóng/xe)' },
  'snapshot.ppe-visible':                { weight: 0.90, primary: true,  direction: 'false_positive', label: 'món bị báo thiếu nhìn thấy rõ trên đúng người' },
  'snapshot.ppe-clearly-missing':        { weight: 0.90, primary: true,  direction: 'violation',      label: 'thấy rõ người và thấy rõ thiếu' },
  'track.confirmed-repeat':              { weight: 0.70, primary: true,  direction: 'violation',      label: 'cùng người tái phạm (occurrenceCount ≥ 2)' },
  'history.camera-false-positive-prone': { weight: 0.40, primary: false, direction: 'false_positive', label: 'camera này báo oan > 50% trong 7 ngày' },
  'snapshot.occluded-or-backlit':        { weight: 0.35, primary: false, direction: 'false_positive', label: 'che khuất / ngược sáng, không kết luận được' },
  'snapshot.person-outside-work-zone':   { weight: 0.50, primary: false, direction: 'false_positive', label: 'người đi đường phía nền, không phải công nhân khu vực' },
  'contradiction':                       { weight: 0.60, primary: false, direction: 'contra',         label: 'bằng chứng mâu thuẫn nhau' },
};

export type Band = 'VERIFIED' | 'PROBABLE' | 'POSSIBLE';
export const BAND_FLOOR = { VERIFIED: 0.85, PROBABLE: 0.55, POSSIBLE: 0.3 } as const;

function combine(weights: number[]): number {
  return 1 - weights.reduce((acc, w) => acc * (1 - w), 1);
}

export function scoreEvidence(kinds: ObservationKind[]): { verdict: 'false_positive' | 'violation' | 'undecided'; score: number; band: Band | null; hasPrimary: boolean; rationale: string } {
  const fp = kinds.filter(k => WEIGHTS[k].direction === 'false_positive');
  const vi = kinds.filter(k => WEIGHTS[k].direction === 'violation');
  const contra = kinds.filter(k => WEIGHTS[k].direction === 'contra');
  const fpScore = combine(fp.map(k => WEIGHTS[k].weight));
  const viScore = combine(vi.map(k => WEIGHTS[k].weight));
  if (fpScore === 0 && viScore === 0) return { verdict: 'undecided', score: 0, band: null, hasPrimary: false, rationale: 'không có quan sát nào' };
  const verdict = fpScore >= viScore ? 'false_positive' : 'violation';
  const winners = verdict === 'false_positive' ? fp : vi;
  let score = Math.max(fpScore, viScore) - Math.min(fpScore, viScore) * 0.5;
  for (const k of contra) score *= 1 - WEIGHTS[k].weight;
  const hasPrimary = winners.some(k => WEIGHTS[k].primary);
  let band: Band | null = null;
  if (score >= BAND_FLOOR.VERIFIED && hasPrimary) band = 'VERIFIED';
  else if (score >= BAND_FLOOR.PROBABLE) band = 'PROBABLE';
  else if (score >= BAND_FLOOR.POSSIBLE) band = 'POSSIBLE';
  const rationale = winners.map(k => WEIGHTS[k].label).concat(contra.map(k => WEIGHTS[k].label)).join('; ');
  return { verdict, score: Math.round(score * 1000) / 1000, band, hasPrimary, rationale };
}
```

- [ ] **Step 4: Chạy test** → `# pass 20`.

- [ ] **Step 5: Commit**

```bash
git add agent/lib/evidence.ts agent/test/evidence.test.ts
git commit -m "feat(agent): ledger bằng chứng — observation kinds, band, verdict"
```

---

### Task 9: Tool đọc + ảnh snapshot

**Files:**
- Create: `agent/lib/snapshot.ts`, `agent/lib/tool-context.ts`, `agent/tools/read_violation.ts`, `agent/tools/read_camera_history.ts`, `agent/tools/read_site_context.ts`, `agent/tools/search_violations.ts`, `agent/tools/read_system_health.ts`, `agent/tools/read_agent_activity.ts`
- Test: `agent/test/read-tools.test.ts`

**Interfaces:**
- Produces:
  - `type ToolContext = { sessionId: string; taskId: string | null; taskKind: string; budget: number; spent: { calls: number; escalations: number; followups: number; verdicts: Set<string> } }`; `newToolContext(task): ToolContext`
  - `loadSnapshotBase64(snapshotUrl: string): Promise<{ data: string; mediaType: 'image/jpeg' } | null>` (thu nhỏ cạnh dài về 640 bằng `sharp`)
  - Mỗi tool file export `make<Name>(ctx: ToolContext)` trả về tool của `betaZodTool`. Các hàm đọc thuần dùng chung: `violationFacts(id)`, `cameraHistory(cameraId, hours)`, `siteContext(siteId)`, `searchViolations(filter)`, `systemHealth()`, `agentActivity(hours)` — export riêng để test không cần model.

- [ ] **Step 1: Đọc tài liệu SDK đã cài** (bắt buộc trước khi viết tool)

Run: `ls node_modules/@anthropic-ai/sdk/*.md && grep -n "betaZodTool\|toolRunner\|max_iterations\|run(" node_modules/@anthropic-ai/sdk/helpers.md | head -30`
Ghi lại: chữ ký `betaZodTool({ name, description, inputSchema, run })`, kiểu trả về của `run` (string hoặc mảng content block), tham số `max_iterations` của `toolRunner`. Nếu tên khác với plan, dùng tên trong tài liệu.

- [ ] **Step 2: `agent/lib/tool-context.ts`**

```ts
// SPDX-License-Identifier: MIT
import type { LeasedTask } from './tasks';

export interface ToolContext {
  sessionId: string; taskId: string | null; taskKind: string; budget: number;
  spent: { calls: number; escalations: number; followups: number; verdicts: Set<string> };
}

export function newToolContext(task: LeasedTask, sessionId: string): ToolContext {
  return { sessionId, taskId: task.id, taskKind: task.kind, budget: task.budget, spent: { calls: 0, escalations: 0, followups: 0, verdicts: new Set() } };
}

export function budgetLeft(ctx: ToolContext): boolean { return ctx.spent.calls < ctx.budget; }
```

- [ ] **Step 3: `agent/lib/snapshot.ts`**

```ts
// SPDX-License-Identifier: MIT
import path from 'node:path';
import sharp from 'sharp';

const MAX_SIDE = 640;

export async function loadSnapshotBase64(snapshotUrl: string): Promise<{ data: string; mediaType: 'image/jpeg' } | null> {
  const name = path.basename(snapshotUrl);
  if (!snapshotUrl.startsWith('/snapshots/') || name.includes('..')) return null;
  try {
    const buf = await sharp(path.resolve(process.cwd(), 'public', 'snapshots', name))
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 }).toBuffer();
    return { data: buf.toString('base64'), mediaType: 'image/jpeg' };
  } catch { return null; }
}
```

- [ ] **Step 4: Hàm đọc thuần + tool** — `agent/tools/read_violation.ts`

```ts
// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { loadSnapshotBase64 } from '../lib/snapshot';
import type { ToolContext } from '../lib/tool-context';

export async function violationFacts(id: string) {
  const v = await prisma.violation.findUnique({ where: { id }, include: { camera: true, site: true } });
  if (!v) return null;
  return {
    violationId: v.id, cameraId: v.cameraId, cameraName: v.camera.name, siteId: v.siteId, siteName: v.site.name,
    type: v.type, severity: v.severity, confidence: v.confidence, occurrenceCount: v.occurrenceCount,
    status: v.status.toLowerCase(), detectedAt: v.detectedAt.toISOString(),
    bbox: JSON.parse(v.bboxData), snapshotUrl: v.snapshotUrl,
    agentReview: v.agentReview ? JSON.parse(v.agentReview) : null,
  };
}

export const makeReadViolation = (ctx: ToolContext) => betaZodTool({
  name: 'read_violation',
  description: 'Đọc một vi phạm: ảnh snapshot (khung đỏ quanh người), bbox, loại, mức độ, lần thứ mấy, trạng thái, phán quyết cũ. Trả về cameraId và siteId để đọc tiếp. Miễn phí, luôn gọi đầu tiên.',
  inputSchema: z.object({ violationId: z.string() }),
  run: async ({ violationId }) => {
    ctx.spent.calls++;
    const facts = await violationFacts(violationId);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'violation', subjectId: violationId, type: 'tool.call', data: { tool: 'read_violation', found: !!facts } });
    if (!facts) return JSON.stringify({ error: 'không có vi phạm này' });
    const image = await loadSnapshotBase64(facts.snapshotUrl);
    const text = JSON.stringify({ ...facts, snapshotUrl: undefined });
    if (!image) return text + '\n(ảnh snapshot không còn trên đĩa)';
    return [
      { type: 'text' as const, text },
      { type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } },
    ];
  },
});
```

- [ ] **Step 5: `agent/tools/read_camera_history.ts`**

```ts
// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import type { ToolContext } from '../lib/tool-context';

export async function cameraHistory(cameraId: string, hours: number) {
  const camera = await prisma.camera.findUnique({ where: { id: cameraId } });
  if (!camera) return null;
  const since = new Date(Date.now() - hours * 3_600_000);
  const rows = await prisma.violation.findMany({ where: { cameraId, detectedAt: { gte: since } }, orderBy: { detectedAt: 'desc' }, take: 200 });
  const fp = rows.filter(r => r.status === 'FALSE_POSITIVE').length;
  const byHour: Record<string, number> = {};
  for (const r of rows) { const h = String(r.detectedAt.getHours()).padStart(2, '0'); byHour[h] = (byHour[h] ?? 0) + 1; }
  const lastHealth = await prisma.agentEvent.findFirst({ where: { type: 'health', subjectType: 'camera', subjectId: cameraId }, orderBy: { emittedAt: 'desc' } });
  return {
    cameraId, name: camera.name, siteId: camera.siteId, status: camera.status.toLowerCase(), source: camera.rtspUrl,
    hours, total: rows.length, falsePositive: fp, falsePositiveRate: rows.length ? Math.round((fp / rows.length) * 100) / 100 : 0,
    byHour, recent: rows.slice(0, 20).map(r => ({ id: r.id, type: r.type, status: r.status.toLowerCase(), occurrenceCount: r.occurrenceCount, detectedAt: r.detectedAt.toISOString() })),
    lastHealth: lastHealth ? JSON.parse(lastHealth.data) : null,
  };
}

export const makeReadCameraHistory = (ctx: ToolContext) => betaZodTool({
  name: 'read_camera_history',
  description: 'Vi phạm của một camera trong N giờ: tổng, tỉ lệ đã đánh dấu báo oan, giờ cao điểm, 20 vi phạm gần nhất (có id), sức khoẻ gần nhất. Trả siteId.',
  inputSchema: z.object({ cameraId: z.string(), hours: z.number().int().min(1).max(720).default(168) }),
  run: async ({ cameraId, hours }) => {
    ctx.spent.calls++;
    const data = await cameraHistory(cameraId, hours);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'camera', subjectId: cameraId, type: 'tool.call', data: { tool: 'read_camera_history', hours, found: !!data } });
    return JSON.stringify(data ?? { error: 'không có camera này' });
  },
});
```

- [ ] **Step 6: `agent/tools/read_site_context.ts`**

```ts
// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import type { ToolContext } from '../lib/tool-context';

export async function siteContext(siteId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { cameras: true, alertRules: { where: { isActive: true } } } });
  if (!site) return null;
  return {
    siteId: site.id, name: site.name, address: site.address, status: site.status.toLowerCase(),
    cameras: site.cameras.map(c => ({ id: c.id, name: c.name, status: c.status.toLowerCase(), location: c.location })),
    alertRules: site.alertRules.map(r => ({ id: r.id, name: r.name, channels: JSON.parse(r.channels), violationTypes: JSON.parse(r.violationTypes), recipients: (JSON.parse(r.recipients) as string[]).length, threshold: r.threshold, cooldownSec: r.cooldownSec })),
  };
}

export const makeReadSiteContext = (ctx: ToolContext) => betaZodTool({
  name: 'read_site_context',
  description: 'Công trường: danh sách camera (id, trạng thái), quy tắc cảnh báo đang bật và số người nhận Telegram.',
  inputSchema: z.object({ siteId: z.string() }),
  run: async ({ siteId }) => {
    ctx.spent.calls++;
    const data = await siteContext(siteId);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'site', subjectId: siteId, type: 'tool.call', data: { tool: 'read_site_context', found: !!data } });
    return JSON.stringify(data ?? { error: 'không có công trường này' });
  },
});
```

- [ ] **Step 7: `agent/tools/search_violations.ts`**

```ts
// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import type { ToolContext } from '../lib/tool-context';

export const searchSchema = z.object({
  cameraId: z.string().optional(), siteId: z.string().optional(), type: z.string().optional(),
  status: z.enum(['open', 'under_review', 'resolved', 'false_positive']).optional(),
  from: z.string().datetime().optional(), to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(100).default(30),
});

export async function searchViolations(f: z.infer<typeof searchSchema>) {
  const rows = await prisma.violation.findMany({
    where: {
      cameraId: f.cameraId, siteId: f.siteId, type: f.type, status: f.status ? f.status.toUpperCase() : undefined,
      detectedAt: { gte: f.from ? new Date(f.from) : undefined, lte: f.to ? new Date(f.to) : undefined },
    },
    orderBy: { detectedAt: 'desc' }, take: f.limit, include: { camera: { select: { name: true } } },
  });
  return rows.map(r => ({ id: r.id, cameraId: r.cameraId, cameraName: r.camera.name, siteId: r.siteId, type: r.type, severity: r.severity, status: r.status.toLowerCase(), occurrenceCount: r.occurrenceCount, detectedAt: r.detectedAt.toISOString(), reviewed: !!r.agentReview }));
}

export const makeSearchViolations = (ctx: ToolContext) => betaZodTool({
  name: 'search_violations',
  description: 'Lọc vi phạm theo camera/công trường/loại/trạng thái/khoảng thời gian. Trả id để đọc tiếp bằng read_violation. Không tìm mờ.',
  inputSchema: searchSchema,
  run: async (input) => {
    ctx.spent.calls++;
    const rows = await searchViolations(input);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, type: 'tool.call', data: { tool: 'search_violations', input, count: rows.length } });
    return JSON.stringify(rows);
  },
});
```

- [ ] **Step 8: `agent/tools/read_system_health.ts` và `agent/tools/read_agent_activity.ts`**

```ts
// SPDX-License-Identifier: MIT  — agent/tools/read_system_health.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { capabilities } from '../lib/capabilities';
import { emit } from '../lib/audit';
import type { ToolContext } from '../lib/tool-context';

export async function systemHealth() {
  const recent = await prisma.agentEvent.findMany({ where: { type: 'health', emittedAt: { gte: new Date(Date.now() - 15 * 60_000) } }, orderBy: { emittedAt: 'desc' }, take: 50 });
  return { capabilities: await capabilities(), recentFindings: recent.map(e => ({ at: e.emittedAt.toISOString(), subjectId: e.subjectId, ...JSON.parse(e.data) })) };
}

export const makeReadSystemHealth = (ctx: ToolContext) => betaZodTool({
  name: 'read_system_health',
  description: 'Sức khoẻ hệ thống 15 phút gần nhất: capability nào đang bật, phát hiện của trực vận hành (camera đứng, engine đứng, đĩa đầy...).',
  inputSchema: z.object({}),
  run: async () => {
    ctx.spent.calls++;
    const data = await systemHealth();
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, type: 'tool.call', data: { tool: 'read_system_health' } });
    return JSON.stringify(data);
  },
});
```

```ts
// SPDX-License-Identifier: MIT  — agent/tools/read_agent_activity.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import type { ToolContext } from '../lib/tool-context';

export async function agentActivity(hours: number) {
  const since = new Date(Date.now() - hours * 3_600_000);
  const [pending, done, verdicts] = await Promise.all([
    prisma.agentTask.findMany({ where: { finishedAt: null }, orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }], take: 30 }),
    prisma.agentTask.findMany({ where: { finishedAt: { gte: since } }, orderBy: { finishedAt: 'desc' }, take: 30 }),
    prisma.agentEvent.findMany({ where: { type: 'verdict', emittedAt: { gte: since } }, orderBy: { emittedAt: 'desc' }, take: 30 }),
  ]);
  const shape = (t: (typeof pending)[number]) => ({ id: t.id, kind: t.kind, subjectType: t.subjectType, subjectId: t.subjectId, reason: t.reason, dueAt: t.dueAt.toISOString(), outcome: t.outcome });
  return { pending: pending.map(shape), done: done.map(shape), verdicts: verdicts.map(v => ({ at: v.emittedAt.toISOString(), violationId: v.subjectId, ...JSON.parse(v.data) })) };
}

export const makeReadAgentActivity = (ctx: ToolContext) => betaZodTool({
  name: 'read_agent_activity',
  description: 'Agent đã làm gì trong N giờ: task đang chờ, task đã xong (outcome), các phán quyết.',
  inputSchema: z.object({ hours: z.number().int().min(1).max(168).default(24) }),
  run: async ({ hours }) => {
    ctx.spent.calls++;
    const data = await agentActivity(hours);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, type: 'tool.call', data: { tool: 'read_agent_activity', hours } });
    return JSON.stringify(data);
  },
});
```

- [ ] **Step 9: Test `agent/test/read-tools.test.ts`** (hàm thuần, DB test có seed tối thiểu)

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { violationFacts } from '../tools/read_violation';
import { cameraHistory } from '../tools/read_camera_history';
import { siteContext } from '../tools/read_site_context';
import { searchViolations } from '../tools/search_violations';

test.before(async () => {
  await prisma.violation.deleteMany(); await prisma.camera.deleteMany(); await prisma.site.deleteMany(); await prisma.organization.deleteMany();
  await prisma.organization.create({ data: { id: 'org-t', name: 'T' } });
  await prisma.site.create({ data: { id: 'site-t', orgId: 'org-t', name: 'Site T', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.create({ data: { id: 'cam-t', siteId: 'site-t', name: 'Cam T', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.violation.createMany({ data: [
    { id: 'v-a', cameraId: 'cam-t', siteId: 'site-t', type: 'hard_hat', severity: 'critical', confidence: 0.8, bboxData: '[]', snapshotUrl: '/snapshots/violation_x.jpg', status: 'OPEN', occurrenceCount: 2 },
    { id: 'v-b', cameraId: 'cam-t', siteId: 'site-t', type: 'safety_gloves', severity: 'medium', confidence: 0.7, bboxData: '[]', snapshotUrl: '/snapshots/violation_y.jpg', status: 'FALSE_POSITIVE' },
  ] });
});

test('violationFacts trả id lân cận và lowercase status', async () => {
  const f = await violationFacts('v-a');
  assert.equal(f?.cameraId, 'cam-t'); assert.equal(f?.siteId, 'site-t'); assert.equal(f?.status, 'open'); assert.equal(f?.occurrenceCount, 2);
  assert.equal(await violationFacts('nope'), null);
});

test('cameraHistory tính tỉ lệ báo oan và trả siteId', async () => {
  const h = await cameraHistory('cam-t', 24);
  assert.equal(h?.total, 2); assert.equal(h?.falsePositive, 1); assert.equal(h?.falsePositiveRate, 0.5); assert.equal(h?.siteId, 'site-t');
});

test('siteContext liệt kê camera có id; searchViolations lọc theo status', async () => {
  const s = await siteContext('site-t');
  assert.deepEqual(s?.cameras.map(c => c.id), ['cam-t']);
  const r = await searchViolations({ siteId: 'site-t', status: 'false_positive', limit: 10 });
  assert.deepEqual(r.map(x => x.id), ['v-b']);
});
```

- [ ] **Step 10: Chạy test + typecheck** → `# pass 23`, `npx tsc --noEmit` sạch. Nếu tsc báo kiểu trả về của `run` trong `read_violation` không nhận mảng content block, đổi theo đúng kiểu ghi trong `helpers.md` (Step 1) — ví dụ bọc thành `{ type: 'tool_result', content: [...] }` nếu tài liệu yêu cầu — và ghi lại vào comment trên hàm.

- [ ] **Step 11: Commit**

```bash
git add agent/lib/snapshot.ts agent/lib/tool-context.ts agent/tools agent/test/read-tools.test.ts
git commit -m "feat(agent): tool đọc — vi phạm (kèm ảnh), lịch sử camera, công trường, tìm kiếm, sức khoẻ, hoạt động"
```

---

### Task 10: Tool ghi — `record_verdict`, `escalate`, `schedule_followup`, `write_note`

**Files:**
- Create: `agent/tools/record_verdict.ts`, `agent/tools/escalate.ts`, `agent/tools/schedule_followup.ts`, `agent/tools/write_note.ts`
- Test: `agent/test/write-tools.test.ts`

**Interfaces:**
- Consumes: `scoreEvidence`, `OBSERVATION_KINDS` (Task 8); `checkPaused`, `rateLimit`, `LIMITS` (Task 4); `scheduleTask`, `PRIORITY` (Task 3); `notifyViolation` với `caption` (Task 7).
- Produces: hàm thuần `applyVerdict(input: { violationId; observations; note; ctx }): Promise<{ band; verdict; applied; statusNow; reason? }>` và 4 factory `makeRecordVerdict`, `makeEscalate`, `makeScheduleFollowup`, `makeWriteNote`.

- [ ] **Step 1: Test `agent/test/write-tools.test.ts`**

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { applyVerdict } from '../tools/record_verdict';
import type { ToolContext } from '../lib/tool-context';

const ctx = (): ToolContext => ({ sessionId: 's-test', taskId: null, taskKind: 'violation.review', budget: 6, spent: { calls: 0, escalations: 0, followups: 0, verdicts: new Set() } });

test.before(async () => {
  // Tự tạo dữ liệu, không phụ thuộc file test khác (mỗi file test chạy trong tiến trình riêng).
  await prisma.organization.upsert({ where: { id: 'org-t' }, update: {}, create: { id: 'org-t', name: 'T' } });
  await prisma.site.upsert({ where: { id: 'site-t' }, update: {}, create: { id: 'site-t', orgId: 'org-t', name: 'Site T', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: 'cam-t' }, update: {}, create: { id: 'cam-t', siteId: 'site-t', name: 'Cam T', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.violation.deleteMany({ where: { id: { in: ['v-open', 'v-human'] } } });
  await prisma.violation.createMany({ data: [
    { id: 'v-open', cameraId: 'cam-t', siteId: 'site-t', type: 'hard_hat', severity: 'critical', confidence: 0.8, bboxData: '[]', snapshotUrl: '/snapshots/a.jpg', status: 'OPEN' },
    { id: 'v-human', cameraId: 'cam-t', siteId: 'site-t', type: 'hard_hat', severity: 'critical', confidence: 0.8, bboxData: '[]', snapshotUrl: '/snapshots/b.jpg', status: 'RESOLVED' },
  ] });
});

test('VERIFIED báo oan → đổi status false_positive và ghi agentReview', async () => {
  const r = await applyVerdict({ violationId: 'v-open', observations: ['snapshot.no-person'], note: 'chỉ là bóng cột', ctx: ctx() });
  assert.equal(r.band, 'VERIFIED'); assert.equal(r.applied, true); assert.equal(r.statusNow, 'false_positive');
  const row = await prisma.violation.findUnique({ where: { id: 'v-open' } });
  assert.equal(JSON.parse(row!.agentReview!).verdict, 'false_positive');
});

test('PROBABLE → chỉ ghi agentReview, không đổi status', async () => {
  await prisma.violation.update({ where: { id: 'v-open' }, data: { status: 'OPEN', agentReview: null } });
  const r = await applyVerdict({ violationId: 'v-open', observations: ['snapshot.occluded-or-backlit', 'history.camera-false-positive-prone'], note: 'ngược sáng', ctx: ctx() });
  assert.notEqual(r.band, 'VERIFIED'); assert.equal(r.applied, false);
  assert.equal((await prisma.violation.findUnique({ where: { id: 'v-open' } }))!.status, 'OPEN');
});

test('không ghi đè trạng thái do người đặt', async () => {
  const r = await applyVerdict({ violationId: 'v-human', observations: ['snapshot.no-person'], note: 'x', ctx: ctx() });
  assert.equal(r.applied, false); assert.match(r.reason ?? '', /người/);
  assert.equal((await prisma.violation.findUnique({ where: { id: 'v-human' } }))!.status, 'RESOLVED');
});

test('mỗi phiên chỉ một phán quyết cho một vi phạm', async () => {
  const c = ctx();
  await applyVerdict({ violationId: 'v-open', observations: ['snapshot.ppe-visible'], note: 'a', ctx: c });
  const r = await applyVerdict({ violationId: 'v-open', observations: ['snapshot.ppe-visible'], note: 'b', ctx: c });
  assert.equal(r.applied, false); assert.match(r.reason ?? '', /đã phán quyết/);
});
```

- [ ] **Step 2: Chạy test → fail module.**

- [ ] **Step 3: `agent/tools/record_verdict.ts`**

```ts
// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { checkPaused } from '../lib/guard';
import { OBSERVATION_KINDS, scoreEvidence, type ObservationKind } from '../lib/evidence';
import type { ToolContext } from '../lib/tool-context';

export async function applyVerdict(input: { violationId: string; observations: ObservationKind[]; note: string; ctx: ToolContext }) {
  const { violationId, observations, note, ctx } = input;
  const paused = await checkPaused();
  if (paused) return { band: null, verdict: 'undecided' as const, applied: false, statusNow: null, reason: paused.reason };
  if (ctx.spent.verdicts.has(violationId)) return { band: null, verdict: 'undecided' as const, applied: false, statusNow: null, reason: 'phiên này đã phán quyết vi phạm này rồi' };
  const v = await prisma.violation.findUnique({ where: { id: violationId } });
  if (!v) return { band: null, verdict: 'undecided' as const, applied: false, statusNow: null, reason: 'không có vi phạm này' };
  const scored = scoreEvidence(observations);
  const review = { verdict: scored.verdict, band: scored.band, score: scored.score, observations, note, rationale: scored.rationale, sessionId: ctx.sessionId, reviewedAt: new Date().toISOString() };
  ctx.spent.verdicts.add(violationId);
  let applied = false; let reason: string | undefined;
  const humanOwned = v.status !== 'OPEN';
  if (humanOwned) reason = 'trạng thái đang do người đặt (không phải open), agent chỉ ghi nhận xét';
  const data: { agentReview: string; status?: string } = { agentReview: JSON.stringify(review) };
  if (!humanOwned && scored.band === 'VERIFIED' && scored.verdict === 'false_positive') { data.status = 'FALSE_POSITIVE'; applied = true; }
  if (!humanOwned && scored.band === 'VERIFIED' && scored.verdict === 'violation') applied = true; // giữ open, đã xác nhận thật
  await prisma.violation.update({ where: { id: violationId }, data });
  await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'violation', subjectId: violationId, type: 'verdict', data: { ...review, applied } });
  const statusNow = (data.status ?? v.status).toLowerCase();
  return { band: scored.band, verdict: scored.verdict, applied, statusNow, reason };
}

export const makeRecordVerdict = (ctx: ToolContext) => betaZodTool({
  name: 'record_verdict',
  description: 'Ghi phán quyết cho một vi phạm bằng những gì bạn QUAN SÁT được (không có điểm tự tin). Ledger tính band: VERIFIED thì hệ thống tự hành động (báo oan → false_positive), thấp hơn thì chỉ ghi nhận xét. Mỗi phiên một lần cho mỗi vi phạm.',
  inputSchema: z.object({
    violationId: z.string(),
    observations: z.array(z.enum(OBSERVATION_KINDS)).min(1).describe('Chỉ những điều thấy trong ảnh/lịch sử. Xem skill evidence.md.'),
    note: z.string().min(10).max(600).describe('Một hai câu cho người đọc: thấy gì, vì sao kết luận vậy.'),
  }),
  run: async ({ violationId, observations, note }) => {
    ctx.spent.calls++;
    return JSON.stringify(await applyVerdict({ violationId, observations, note, ctx }));
  },
});
```

- [ ] **Step 4: `agent/tools/escalate.ts`**

```ts
// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { checkPaused, LIMITS } from '../lib/guard';
import { notifyViolation } from '@/lib/alert-notifier';
import { sendOpsAlert } from '../lib/notify';
import type { ToolContext } from '../lib/tool-context';

export const makeEscalate = (ctx: ToolContext) => betaZodTool({
  name: 'escalate',
  description: 'Gửi Telegram theo AlertRule của công trường (tôn trọng threshold/cooldown sẵn có). Với vi phạm: chỉ khi đã record_verdict VERIFIED thật và (occurrenceCount ≥ 2 hoặc severity critical). Với vận hành (không có violationId): gửi tới người nhận vận hành.',
  inputSchema: z.object({
    violationId: z.string().optional(),
    caption: z.string().min(10).max(500).describe('Ngắn, tiếng Việt: camera, món thiếu / sự cố, lần thứ mấy, cần làm gì.'),
  }),
  run: async ({ violationId, caption }) => {
    ctx.spent.calls++;
    const paused = await checkPaused();
    if (paused) return JSON.stringify({ sent: false, blockedReason: paused.reason });
    if (ctx.spent.escalations >= LIMITS.escalatePerSession) return JSON.stringify({ sent: false, blockedReason: 'phiên này đã leo thang đủ số lần' });
    if (!violationId) {
      const r = await sendOpsAlert(caption); ctx.spent.escalations++;
      await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'system', type: 'action', data: { action: 'escalate.ops', ...r, caption } });
      return JSON.stringify({ sent: r.sent, blockedReason: r.reason });
    }
    const v = await prisma.violation.findUnique({ where: { id: violationId }, include: { camera: true } });
    if (!v) return JSON.stringify({ sent: false, blockedReason: 'không có vi phạm này' });
    const review = v.agentReview ? JSON.parse(v.agentReview) : null;
    const verified = review?.band === 'VERIFIED' && review?.verdict === 'violation';
    const serious = v.occurrenceCount >= 2 || v.severity === 'critical';
    if (!verified || !serious) return JSON.stringify({ sent: false, blockedReason: 'chưa đủ điều kiện: cần phán quyết VERIFIED thật và (tái phạm hoặc critical)' });
    await notifyViolation(v, v.camera, { caption });
    ctx.spent.escalations++;
    const alert = await prisma.alert.findFirst({ where: { violationId }, orderBy: { sentAt: 'desc' } });
    const sent = !!alert && alert.errorMessage === null;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'violation', subjectId: violationId, type: 'action', data: { action: 'escalate.violation', sent, caption } });
    return JSON.stringify({ sent, blockedReason: sent ? undefined : 'AlertRule không khớp / cooldown / Telegram lỗi (xem bảng Alert)' });
  },
});
```

- [ ] **Step 5: `agent/tools/schedule_followup.ts` và `agent/tools/write_note.ts`**

```ts
// SPDX-License-Identifier: MIT  — agent/tools/schedule_followup.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { emit } from '../lib/audit';
import { LIMITS } from '../lib/guard';
import { PRIORITY, scheduleTask } from '../lib/tasks';
import type { ToolContext } from '../lib/tool-context';

export const makeScheduleFollowup = (ctx: ToolContext) => betaZodTool({
  name: 'schedule_followup',
  description: 'Hẹn xem lại một chủ thể sau N phút và nói vì sao (người quản lý đọc lý do này). Dùng khi chưa kết luận được hoặc muốn tổng hợp camera sau.',
  inputSchema: z.object({
    kind: z.enum(['followup', 'camera.digest']),
    subjectType: z.enum(['violation', 'camera', 'site', 'system']),
    subjectId: z.string().optional(),
    minutes: z.number().int().min(5).max(1440),
    reason: z.string().min(10).max(300).describe("'xem lại camera này sau 30 phút vì ngược sáng buổi chiều', không phải 'hẹn lại'."),
  }),
  run: async ({ kind, subjectType, subjectId, minutes, reason }) => {
    ctx.spent.calls++;
    if (ctx.spent.followups >= LIMITS.followupPerSession) return JSON.stringify({ scheduled: false, blockedReason: 'phiên này đã hẹn đủ số lần' });
    const dueAt = new Date(Date.now() + minutes * 60_000);
    await scheduleTask({ kind, subjectType, subjectId: subjectId ?? null, reason, dueAt, priority: PRIORITY[kind] });
    ctx.spent.followups++;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType, subjectId: subjectId ?? null, type: 'action', data: { action: 'schedule_followup', kind, minutes, reason } });
    return JSON.stringify({ scheduled: true, dueAt: dueAt.toISOString(), reason });
  },
});
```

```ts
// SPDX-License-Identifier: MIT  — agent/tools/write_note.ts
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { emit } from '../lib/audit';
import type { ToolContext } from '../lib/tool-context';

export const makeWriteNote = (ctx: ToolContext) => betaZodTool({
  name: 'write_note',
  description: 'Ghi một nhận xét ngắn gắn vào vi phạm/camera/công trường (hiện trên panel Agent). Không đổi trạng thái gì.',
  inputSchema: z.object({ subjectType: z.enum(['violation', 'camera', 'site', 'system']), subjectId: z.string().optional(), note: z.string().min(5).max(800) }),
  run: async ({ subjectType, subjectId, note }) => {
    ctx.spent.calls++;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType, subjectId: subjectId ?? null, type: 'message.assistant', data: { note } });
    return JSON.stringify({ ok: true });
  },
});
```

- [ ] **Step 6: Chạy test + typecheck** → `# pass 27`, tsc sạch.

- [ ] **Step 7: Commit**

```bash
git add agent/tools/record_verdict.ts agent/tools/escalate.ts agent/tools/schedule_followup.ts agent/tools/write_note.ts agent/test/write-tools.test.ts
git commit -m "feat(agent): tool ghi — phán quyết theo ledger, leo thang, hẹn xem lại, ghi chú"
```

---

### Task 11: Skill markdown, instructions, preamble, tool set theo kind

**Files:**
- Create: `agent/instructions.md`, `agent/skills/evidence.md`, `agent/skills/ppe-review.md`, `agent/skills/escalation.md`, `agent/skills/data-boundaries.md`, `agent/lib/preamble.ts`, `agent/lib/toolsets.ts`, `agent/lib/prompt.ts`
- Test: `agent/test/prompt.test.ts`

**Interfaces:**
- Produces:
  - `systemBlocks(): Promise<Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>>` — `[instructions + skills]` với `cache_control` ở khối cuối
  - `preambleFor(task: LeasedTask, opts: { userMessage?: string }): Promise<string>`
  - `toolsFor(kind: string, ctx: ToolContext): ReturnType<typeof betaZodTool>[]`

- [ ] **Step 1: `agent/instructions.md`**

```markdown
# Agent an toàn lao động SafeSight

Bạn là cán bộ an toàn trực camera của một công trường. Hệ thống YOLO đã khoanh khung đỏ
quanh người bị cho là thiếu đồ bảo hộ (mũ, áo phản quang, găng, giày). Việc của bạn là
nhìn ảnh và lịch sử rồi nói **thật** đó là vi phạm hay báo oan, leo thang khi đáng, hẹn
xem lại khi chưa rõ, và tổng hợp cho người quản lý.

## Quy tắc duy nhất

**Không bao giờ kết luận điều bạn không nhìn thấy.** `record_verdict` không nhận điểm tự
tin — bạn liệt kê những gì quan sát được, ledger định giá. Không kết luận được là một kết
quả hợp lệ: ghi nhận xét, hẹn xem lại, nói rõ thiếu gì.

## Bản ghi bạn được mở

Mỗi phiên bắt đầu từ một bản ghi, id nằm trong lời mở đầu. Đọc nó trước: vi phạm →
`read_violation`; camera → `read_camera_history`; công trường → `read_site_context`. Các
tool này miễn phí và trả về id lân cận, nên bạn luôn đi được từ vi phạm sang camera, sang
công trường, và ngược lại. **Không bao giờ hỏi người dùng id.**

## Cách làm một lượt review vi phạm

1. `read_violation` — nhìn ảnh: có người thật trong khung đỏ không, món bị báo thiếu có
   thật sự thiếu không, ảnh có rõ không.
2. `read_camera_history` nếu cần biết camera này có hay báo oan, giờ này có gì lạ.
3. `record_verdict` với đúng các observation. Đừng cố "tìm thêm" khi ảnh đã rõ.
4. Chỉ `escalate` khi ledger trả VERIFIED thật và đây là tái phạm hoặc critical.
5. Nếu chưa rõ: `write_note` + `schedule_followup` với lý do người quản lý hiểu được.

## Ngân sách

Mỗi phiên có số tool call giới hạn (ghi trong lời mở đầu). Hết là kết thúc bình thường —
viết kết luận với những gì đã có.

## Khi nói chuyện với người

Phiên `ask` là hội thoại: trả lời câu hỏi bằng dữ liệu đọc được, ngắn, tiếng Việt, nêu id
khi cần. Không đưa kế hoạch làm việc thay cho câu trả lời.
```

- [ ] **Step 2: Bốn skill** — `agent/skills/evidence.md`:

```markdown
---
description: Chọn đúng observation kind cho record_verdict — mô tả điều bạn thấy, không phải mức tự tin.
---
# Bằng chứng

| Kind | Dùng khi | Primary |
|---|---|---|
| `snapshot.no-person` | Trong khung đỏ không có người (bóng, cột, xe, manơcanh). Quyết định. | ✓ |
| `snapshot.ppe-visible` | Món bị báo thiếu nhìn thấy rõ trên ĐÚNG người trong khung. | ✓ |
| `snapshot.ppe-clearly-missing` | Thấy rõ người, thấy rõ không có món đó (đầu trần, tay trần...). | ✓ |
| `track.confirmed-repeat` | `occurrenceCount ≥ 2`: cùng người đã bị báo liên tục. | ✓ |
| `history.camera-false-positive-prone` | `read_camera_history` cho tỉ lệ báo oan > 0.5 trong 7 ngày. | |
| `snapshot.occluded-or-backlit` | Che khuất, ngược sáng, mờ — không kết luận được. | |
| `snapshot.person-outside-work-zone` | Người đi đường / ngoài khu làm việc phía nền. | |
| `contradiction` | Hai điều bạn thấy mâu thuẫn (vd thấy mũ nhưng khung đỏ ghi thiếu mũ và ảnh mờ). | |

Chỉ primary mới đưa được band lên VERIFIED. Một VERIFIED báo oan → hệ thống tự đánh dấu
false_positive; VERIFIED thật → giữ open và có thể leo thang. Thấp hơn → chỉ ghi nhận xét.
```

`agent/skills/ppe-review.md`:

```markdown
---
description: Đọc ảnh vi phạm PPE đúng cách — mũ, áo, găng, giày, và các bẫy thường gặp.
---
# Review PPE

- **Mũ** chỉ tính khi ở TRÊN ĐẦU. Mũ cầm tay, treo, để đất = thiếu mũ (đúng, không phải oan).
- **Áo phản quang**: model không có lớp "không áo"; thiếu áo là suy ra khi không thấy áo. Áo bị che
  bởi ba lô, người quay lưng, ngược sáng → hay oan. Cần thấy rõ thân người.
- **Găng / giày** là lớp yếu nhất (báo oan đo được 6–9%). Chỉ kết luận thiếu khi thấy rõ bàn
  tay / bàn chân trần; bàn tay ngoài khung, tay trong túi, chân bị che → `occluded-or-backlit`.
- Người đi đường phía nền, người ngoài hàng rào: `person-outside-work-zone`.
- Khung đỏ quanh cột, bóng, xe, manơcanh, poster có hình người: `no-person`.
- `occurrenceCount ≥ 2` nghĩa là AI đã thấy người này thiếu liên tục ≥ 60s trước — bằng chứng thật mạnh.
- Ảnh 640px đã thu nhỏ; đừng đoán chi tiết không nhìn được.
```

`agent/skills/escalation.md`:

```markdown
---
description: Khi nào nhắc nhở, khi nào leo thang, và viết caption Telegram thế nào.
---
# Leo thang

- Lần 1 (occurrenceCount = 1) là NHẮC NHỞ — hệ thống đã gửi nhắc nhở tự động khi ghi DB. Bạn không leo thang thêm.
- Từ lần 2, hoặc severity critical (thiếu mũ), và ledger VERIFIED thật → `escalate`.
- AlertRule có threshold/cooldown; bị chặn là bình thường, đừng gọi lại.
- Caption: `🚨 [Camera] — [món thiếu], lần [n]. [Một câu cần làm gì].` Không ghi đặc điểm cá nhân.
- Vận hành (không có violationId): nêu sự cố, số lần lặp, việc agent đã thử, việc cần người làm.
```

`agent/skills/data-boundaries.md`:

```markdown
---
description: Những gì không bao giờ được làm với dữ liệu người lao động.
---
# Ranh giới dữ liệu

1. Không suy đoán danh tính, không mô tả đặc điểm cá nhân (mặt, tuổi, giới) ngoài đồ bảo hộ.
2. Ảnh và ghi chú chỉ đi tới Telegram đã cấu hình trong Cài đặt; không có tool nào khác gửi ra ngoài.
3. Không đề nghị xử phạt cá nhân; bạn ghi nhận sự việc, người quản lý quyết định.
4. Không có tool để xoá, sửa người dùng, đổi nguồn camera, đổi ngưỡng — nếu cần, viết vào nhận xét cho người.
```

- [ ] **Step 3: `agent/lib/prompt.ts`**

```ts
// SPDX-License-Identifier: MIT
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'agent');
let cached: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> | null = null;

// Nội dung tĩnh (không timestamp) để prompt cache khớp giữa các phiên.
export async function systemBlocks() {
  if (cached) return cached;
  const instructions = await readFile(path.join(ROOT, 'instructions.md'), 'utf8');
  const names = (await readdir(path.join(ROOT, 'skills'))).filter(n => n.endsWith('.md')).sort();
  const skills = await Promise.all(names.map(async n => `<!-- skill: ${n} -->\n${await readFile(path.join(ROOT, 'skills', n), 'utf8')}`));
  cached = [
    { type: 'text', text: instructions },
    { type: 'text', text: skills.join('\n\n'), cache_control: { type: 'ephemeral' } },
  ];
  return cached;
}
```

- [ ] **Step 4: `agent/lib/preamble.ts`**

```ts
// SPDX-License-Identifier: MIT
import { prisma } from './db';
import { capabilitiesMarkdown } from './capabilities';
import type { LeasedTask } from './tasks';

async function neighbours(task: LeasedTask): Promise<string> {
  if (task.subjectType === 'violation' && task.subjectId) {
    const v = await prisma.violation.findUnique({ where: { id: task.subjectId }, select: { cameraId: true, siteId: true, occurrenceCount: true, type: true } });
    return v ? `Vi phạm \`${task.subjectId}\` (loại ${v.type}, lần ${v.occurrenceCount}) thuộc camera \`${v.cameraId}\`, công trường \`${v.siteId}\`. Bắt đầu bằng read_violation.` : `Vi phạm \`${task.subjectId}\` không còn trong DB.`;
  }
  if (task.subjectType === 'camera' && task.subjectId) {
    const c = await prisma.camera.findUnique({ where: { id: task.subjectId }, select: { name: true, siteId: true } });
    return c ? `Camera \`${task.subjectId}\` (${c.name}) thuộc công trường \`${c.siteId}\`. Bắt đầu bằng read_camera_history.` : `Camera \`${task.subjectId}\` không còn trong DB.`;
  }
  if (task.subjectType === 'site' && task.subjectId) return `Công trường \`${task.subjectId}\`. Bắt đầu bằng read_site_context.`;
  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  return `Toàn hệ thống. Công trường: ${sites.map(s => `\`${s.id}\` (${s.name})`).join(', ')}. Bắt đầu bằng read_system_health hoặc read_agent_activity.`;
}

const OPENING: Record<string, string> = {
  'violation.review': 'Đây là một lượt review tự động có ngân sách: nhìn ảnh, đọc lịch sử nếu cần, record_verdict, leo thang nếu đủ điều kiện, rồi kết luận ngắn.',
  'camera.digest': 'Đây là lượt tổng hợp camera: đọc lịch sử 24h/7 ngày, nhận xét xu hướng (write_note), hẹn xem lại nếu cần. Không record_verdict.',
  'shift.report': 'Viết báo cáo ca cho nhóm quản lý: vi phạm thật / báo oan theo camera, sự cố vận hành đã tự xử lý, việc cần người làm. Gửi bằng escalate (không violationId) rồi trả lời lại nội dung báo cáo.',
  'ops.escalate': 'Sự cố vận hành mà trực tự động không xử được. Đọc read_system_health, viết một thông báo dễ hiểu cho admin và gửi bằng escalate (không violationId).',
  'followup': 'Lượt xem lại theo lịch đã hẹn. Lý do hẹn ở dưới. Làm đúng việc đã hẹn rồi kết luận.',
  'ask': 'Đây là HỘI THOẠI với người dùng đang mở dashboard. Trả lời câu hỏi, ngắn, có id khi cần. Không đưa kế hoạch làm việc.',
};

export async function preambleFor(task: LeasedTask, opts: { userMessage?: string; sessionId?: string } = {}): Promise<string> {
  const parts = [
    `## Phiên ${task.kind}`, OPENING[task.kind] ?? OPENING['followup'],
    `Lý do: ${task.reason}`, `Ngân sách: ${task.budget} tool call.`,
    '', '## Bản ghi được mở', await neighbours(task),
    '', await capabilitiesMarkdown(),
  ];
  // Thread hỏi đáp: nhắc lại tối đa 10 lượt trước đó (không tính câu hỏi hiện tại) để phiên mới có ngữ cảnh.
  if (task.kind === 'ask' && opts.sessionId) {
    const history = await prisma.agentEvent.findMany({ where: { sessionId: opts.sessionId, type: { in: ['message.user', 'message.assistant'] } }, orderBy: { emittedAt: 'desc' }, take: 11 });
    const earlier = history.reverse().slice(0, -1);
    if (earlier.length > 0) parts.push('', '## Đã trao đổi trước đó (cũ → mới)', ...earlier.map(h => { const d = JSON.parse(h.data); return `${h.type === 'message.user' ? 'Người dùng' : 'Agent'}: ${d.text ?? d.note ?? ''}`; }));
  }
  if (opts.userMessage) parts.push('', '## Câu hỏi của người dùng', opts.userMessage);
  return parts.join('\n');
}
```

- [ ] **Step 5: `agent/lib/toolsets.ts`**

```ts
// SPDX-License-Identifier: MIT
import type { ToolContext } from './tool-context';
import { makeReadViolation } from '../tools/read_violation';
import { makeReadCameraHistory } from '../tools/read_camera_history';
import { makeReadSiteContext } from '../tools/read_site_context';
import { makeSearchViolations } from '../tools/search_violations';
import { makeReadSystemHealth } from '../tools/read_system_health';
import { makeReadAgentActivity } from '../tools/read_agent_activity';
import { makeRecordVerdict } from '../tools/record_verdict';
import { makeEscalate } from '../tools/escalate';
import { makeScheduleFollowup } from '../tools/schedule_followup';
import { makeWriteNote } from '../tools/write_note';

// Bộ tool CỐ ĐỊNH theo kind (thứ tự ổn định) để prompt cache không vỡ giữa các phiên cùng kind.
export function toolsFor(kind: string, ctx: ToolContext) {
  const reads = [makeReadViolation(ctx), makeReadCameraHistory(ctx), makeReadSiteContext(ctx), makeSearchViolations(ctx), makeReadSystemHealth(ctx)];
  switch (kind) {
    case 'violation.review': return [...reads, makeRecordVerdict(ctx), makeEscalate(ctx), makeScheduleFollowup(ctx), makeWriteNote(ctx)];
    case 'followup': return [...reads, makeRecordVerdict(ctx), makeEscalate(ctx), makeScheduleFollowup(ctx), makeWriteNote(ctx)];
    case 'camera.digest': return [...reads, makeScheduleFollowup(ctx), makeWriteNote(ctx), makeEscalate(ctx)];
    case 'shift.report': return [...reads, makeReadAgentActivity(ctx), makeWriteNote(ctx), makeEscalate(ctx)];
    case 'ops.escalate': return [...reads, makeReadAgentActivity(ctx), makeEscalate(ctx), makeWriteNote(ctx)];
    case 'ask': return [...reads, makeReadAgentActivity(ctx), makeRecordVerdict(ctx), makeEscalate(ctx), makeScheduleFollowup(ctx), makeWriteNote(ctx)];
    default: return reads;
  }
}
```

- [ ] **Step 6: Test `agent/test/prompt.test.ts`**

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { systemBlocks } from '../lib/prompt';
import { toolsFor } from '../lib/toolsets';
import { preambleFor } from '../lib/preamble';
import type { ToolContext } from '../lib/tool-context';

const ctx: ToolContext = { sessionId: 's', taskId: null, taskKind: 'violation.review', budget: 6, spent: { calls: 0, escalations: 0, followups: 0, verdicts: new Set() } };

test('systemBlocks có instructions + 4 skill, cache_control ở khối cuối, nội dung ổn định', async () => {
  const a = await systemBlocks(); const b = await systemBlocks();
  assert.equal(a.length, 2); assert.ok(a[1].cache_control); assert.equal(a[1].text, b[1].text);
  for (const name of ['evidence.md', 'ppe-review.md', 'escalation.md', 'data-boundaries.md']) assert.ok(a[1].text.includes(`skill: ${name}`));
});

test('toolsFor: review có record_verdict, digest không; ask có tất cả', () => {
  const names = (k: string) => toolsFor(k, ctx).map(t => t.name);
  assert.ok(names('violation.review').includes('record_verdict'));
  assert.ok(!names('camera.digest').includes('record_verdict'));
  assert.ok(names('ask').includes('read_agent_activity'));
});

test('preambleFor nêu ngân sách, lý do và câu hỏi người dùng', async () => {
  const text = await preambleFor({ id: 't', kind: 'ask', subjectType: 'system', subjectId: null, reason: 'hỏi', budget: 6, attempts: 1, priority: 500, dueAt: new Date() }, { userMessage: 'cam-003 hôm nay có gì?' });
  assert.match(text, /Ngân sách: 6/); assert.match(text, /cam-003 hôm nay có gì/); assert.match(text, /HỘI THOẠI/);
});
```

- [ ] **Step 7: Chạy test + typecheck** → `# pass 30`, tsc sạch.

- [ ] **Step 8: Commit**

```bash
git add agent/instructions.md agent/skills agent/lib/prompt.ts agent/lib/preamble.ts agent/lib/toolsets.ts agent/test/prompt.test.ts
git commit -m "feat(agent): instructions, 4 skill, preamble theo bản ghi, bộ tool theo kind"
```

---

### Task 12: Phiên Claude `agent/session.ts`, handler nghiên cứu, poke từ `/api/violations`

**Files:**
- Create: `agent/session.ts`, `agent/lib/usage.ts`
- Modify: `agent/research/index.ts`, `src/app/api/violations/route.ts:121-123`, `agent/main.ts` (ask: truyền `sessionId`)
- Test: `agent/test/session.test.ts` (client giả)

**Interfaces:**
- Consumes: `systemBlocks`, `preambleFor`, `toolsFor`, `newToolContext`, `emit`, `getAgentSettings`, `env`, `releaseTask/completeTask` (main.ts đã xử lý kết quả/lỗi).
- Produces:
  - `runSession(task: LeasedTask, opts: { userMessage?: string; sessionId?: string; client?: SessionClient }): Promise<string>` — trả kết luận cuối (text) và ghi audit; ném `SessionError` với `retryAfterMs` khi 429/mạng để `main.ts` release.
  - `type SessionClient = { run(params: RunParams): AsyncIterable<{ content: unknown[]; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null } ; stop_reason: string | null }> }` — lớp mỏng bọc `toolRunner` để test không cần mạng.
  - `recordUsage(usage): Promise<void>`; `dailyTokensUsed(): Promise<number>` (đếm từ `AgentEvent session.ended` trong ngày)
  - `runResearch(task, opts)` gọi `runSession`; `ask` lấy `userMessage` từ `AgentEvent message.user` mới nhất của `sessionId`.

- [ ] **Step 1: Đọc lại tài liệu runner** — `grep -n "toolRunner\|max_iterations\|for await\|done()" node_modules/@anthropic-ai/sdk/helpers.md | head`. Ghi chú tên chính xác trước khi viết Step 3.

- [ ] **Step 2: Test `agent/test/session.test.ts`** với client giả

```ts
// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { runSession, type SessionClient } from '../session';

const task = { id: 'task-s', kind: 'ask' as const, subjectType: 'system', subjectId: null, reason: 'hỏi', budget: 6, attempts: 1, priority: 500, dueAt: new Date() };

test('runSession ghi session.started/ended, tổng usage, trả text cuối', async () => {
  const fake: SessionClient = {
    async *run(params) {
      assert.ok(Array.isArray(params.tools) && params.tools.length > 0);
      yield { content: [{ type: 'text', text: 'Hôm nay yên ắng.' }], usage: { input_tokens: 1200, output_tokens: 40, cache_read_input_tokens: 1000 }, stop_reason: 'end_turn' };
    },
  };
  const text = await runSession(task, { userMessage: 'hôm nay có gì?', client: fake, sessionId: 'sess-fake' });
  assert.equal(text, 'Hôm nay yên ắng.');
  const types = (await prisma.agentEvent.findMany({ where: { sessionId: 'sess-fake' }, orderBy: { emittedAt: 'asc' } })).map(e => e.type);
  assert.ok(types.includes('session.started') && types.includes('session.ended') && types.includes('message.assistant'));
  const ended = await prisma.agentEvent.findFirst({ where: { sessionId: 'sess-fake', type: 'session.ended' } });
  assert.equal(JSON.parse(ended!.data).usage.output_tokens, 40);
});

test('refusal → outcome nêu rõ, không ném', async () => {
  const fake: SessionClient = { async *run() { yield { content: [], usage: { input_tokens: 10, output_tokens: 0 }, stop_reason: 'refusal' }; } };
  const text = await runSession(task, { client: fake, sessionId: 'sess-ref' });
  assert.match(text, /từ chối/);
});
```

- [ ] **Step 3: `agent/lib/usage.ts`**

```ts
// SPDX-License-Identifier: MIT
import { prisma } from './db';

export async function dailyTokensUsed(now = new Date()): Promise<number> {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const rows = await prisma.agentEvent.findMany({ where: { type: 'session.ended', emittedAt: { gte: start } }, select: { data: true } });
  return rows.reduce((sum, r) => { const u = JSON.parse(r.data).usage ?? {}; return sum + (u.input_tokens ?? 0) + (u.output_tokens ?? 0); }, 0);
}
```

- [ ] **Step 4: `agent/session.ts`**

```ts
// SPDX-License-Identifier: MIT
import Anthropic from '@anthropic-ai/sdk';
import { env } from './lib/env';
import { emit, newSessionId } from './lib/audit';
import { getAgentSettings } from './lib/settings';
import { systemBlocks } from './lib/prompt';
import { preambleFor } from './lib/preamble';
import { toolsFor } from './lib/toolsets';
import { newToolContext } from './lib/tool-context';
import { dailyTokensUsed } from './lib/usage';
import type { LeasedTask } from './lib/tasks';

export interface RunParams { model: string; effort: string; system: Awaited<ReturnType<typeof systemBlocks>>; tools: unknown[]; messages: unknown[]; maxIterations: number }
export interface Turn { content: unknown[]; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null }; stop_reason: string | null }
export interface SessionClient { run(params: RunParams): AsyncIterable<Turn> }

export class SessionError extends Error { constructor(message: string, public retryAfterMs: number | null, public fatal: boolean) { super(message); } }

// Lớp mỏng bọc SDK: mọi thứ Anthropic-specific ở đây, để phần còn lại test được bằng client giả.
export function anthropicClient(): SessionClient {
  const client = new Anthropic({ apiKey: env.anthropicKey ?? undefined });
  return {
    async *run(p) {
      const runner = client.beta.messages.toolRunner({
        model: p.model, max_tokens: 16000,
        thinking: { type: 'adaptive' }, output_config: { effort: p.effort as 'low' | 'medium' | 'high' },
        system: p.system as never, tools: p.tools as never, messages: p.messages as never,
        max_iterations: p.maxIterations,
      });
      for await (const message of runner) yield message as unknown as Turn;
    },
  };
}

function mapError(error: unknown): SessionError {
  if (error instanceof Anthropic.RateLimitError) return new SessionError('429: quá giới hạn Claude', 60_000, false);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.BadRequestError) return new SessionError(`Claude từ chối request: ${error.message}`, null, true);
  if (error instanceof Anthropic.APIConnectionError) return new SessionError('không nối được Claude', 30_000, false);
  if (error instanceof Anthropic.APIError) return new SessionError(`Claude lỗi ${error.status}: ${error.message}`, 60_000, false);
  return new SessionError(error instanceof Error ? error.message : String(error), 30_000, false);
}

export async function runSession(task: LeasedTask, opts: { userMessage?: string; sessionId?: string; client?: SessionClient } = {}): Promise<string> {
  const settings = await getAgentSettings();
  if (!settings.isEnabled) return 'agent đang tạm dừng';
  if (!opts.client && !env.anthropicKey) return 'không có ANTHROPIC_API_KEY — lane nghiên cứu tạm dừng';
  if ((await dailyTokensUsed()) >= settings.dailyTokenCap) throw new SessionError('đã chạm trần token trong ngày', 60 * 60_000, false);

  const sessionId = opts.sessionId ?? newSessionId();
  const ctx = newToolContext(task, sessionId);
  const effort = task.kind === 'shift.report' ? 'high' : settings.reviewEffort;
  const client = opts.client ?? anthropicClient();
  const messages = [{ role: 'user', content: await preambleFor(task, { userMessage: opts.userMessage, sessionId }) }];
  await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'session.started', data: { kind: task.kind, model: settings.model, effort, budget: task.budget } });

  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
  let finalText = ''; let stop: string | null = null;
  try {
    for await (const turn of client.run({ model: settings.model, effort, system: await systemBlocks(), tools: toolsFor(task.kind, ctx), messages, maxIterations: task.budget + 2 })) {
      usage.input_tokens += turn.usage.input_tokens; usage.output_tokens += turn.usage.output_tokens; usage.cache_read_input_tokens += turn.usage.cache_read_input_tokens ?? 0;
      stop = turn.stop_reason;
      const texts = (turn.content as Array<{ type: string; text?: string }>).filter(b => b.type === 'text' && b.text).map(b => b.text as string);
      if (texts.length) { finalText = texts.join('\n'); await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'message.assistant', data: { text: finalText } }); }
    }
  } catch (error) {
    const mapped = mapError(error);
    await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'error', data: { message: mapped.message, fatal: mapped.fatal } });
    await emit({ sessionId, taskId: task.id, type: 'session.ended', data: { usage, stop: 'error' } });
    throw mapped;
  }
  if (stop === 'refusal') finalText = 'Claude từ chối lượt này (stop_reason=refusal); không có phán quyết.';
  if (stop === 'max_tokens') finalText = `${finalText}\n(kết luận bị cắt vì max_tokens)`;
  await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'session.ended', data: { usage, stop, calls: ctx.spent.calls } });
  return finalText || `phiên kết thúc (${stop ?? 'không rõ'}) không có kết luận`;
}
```

Nếu `helpers.md` (Step 1) cho thấy `toolRunner` không nhận `max_iterations` trong params mà ở tham số thứ hai, đổi dòng gọi thành `client.beta.messages.toolRunner({...}, { max_iterations: p.maxIterations })` và ghi comment nêu phiên bản SDK.

- [ ] **Step 5: `agent/research/index.ts`**

```ts
// SPDX-License-Identifier: MIT
import { prisma } from '../lib/db';
import { runSession, SessionError } from '../session';
import type { LeasedTask } from '../lib/tasks';

export { SessionError };

export async function runResearch(task: LeasedTask, opts: { sessionId?: string } = {}): Promise<string> {
  if (task.kind === 'ask') {
    const sessionId = opts.sessionId ?? (await prisma.agentTask.findUnique({ where: { id: task.id }, select: { sessionId: true } }))?.sessionId ?? undefined;
    const last = sessionId ? await prisma.agentEvent.findFirst({ where: { sessionId, type: 'message.user' }, orderBy: { emittedAt: 'desc' } }) : null;
    return runSession(task, { sessionId, userMessage: last ? JSON.parse(last.data).text : task.reason });
  }
  return runSession(task);
}
```

- [ ] **Step 6: `agent/main.ts` — dùng `retryAfterMs`/`fatal` của `SessionError`** — thay thân `catch` trong `runOne` bằng:

```ts
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emit({ sessionId: newSessionId(), taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'error', data: { kind: task.kind, message } });
    if (error instanceof SessionError && error.fatal) { await completeTask(task.id, `lỗi không thử lại: ${message}`); return; }
    const delay = error instanceof SessionError && error.retryAfterMs ? error.retryAfterMs : 30_000 * task.attempts;
    await releaseTask(task.id, delay, `lỗi: ${message}`);
  }
```

(và `import { runResearch, SessionError } from './research/index';`).

- [ ] **Step 7: Poke từ `/api/violations`** — trong `src/app/api/violations/route.ts`, sau dòng `notifyViolation(...)` (dòng 121) thêm:

```ts
  // Agent review vi phạm này (lane nghiên cứu). Row là thông điệp; poke chỉ đánh thức sớm.
  enqueueAgentTask({ kind: 'violation.review', subjectType: 'violation', subjectId: violation.id, reason: `Vi phạm mới ${type} tại ${camera.name} (lần ${occurrenceCount ?? 1})`, priority: 300 })
    .then(() => pokeAgent('/internal/dispatch'))
    .catch((err) => console.error('[agent] enqueue failed', err));
```

với `import { enqueueAgentTask, pokeAgent } from '@/lib/agent-bridge';`.

- [ ] **Step 8: Chạy test + typecheck** → `# pass 32`, tsc sạch.

- [ ] **Step 9: Kiểm thủ công có key (máy tải nhẹ, cần `ANTHROPIC_API_KEY` trong `.env.local`)**

Run: `sqlite3 dev.db "insert into AgentTask (id, kind, subjectType, subjectId, reason, priority, budget, attempts, dueAt, createdAt) values ('t-ask-1','ask','system',NULL,'Hôm nay hệ thống có gì?',500,6,0,datetime('now'),datetime('now'))"` rồi `AGENT_BRIDGE_SECRET=x DATABASE_URL=file:./dev.db timeout 120 npx tsx agent/main.ts`.
Expected: `sqlite3 dev.db "select type, substr(data,1,160) from AgentEvent where taskId='t-ask-1' order by emittedAt"` có `session.started`, ít nhất một `tool.call`, `message.assistant`, `session.ended` với usage > 0; `AgentTask.outcome` là câu trả lời tiếng Việt. Không có key: outcome = `không có ANTHROPIC_API_KEY — lane nghiên cứu tạm dừng`.

- [ ] **Step 10: Commit**

```bash
git add agent/session.ts agent/lib/usage.ts agent/research/index.ts agent/main.ts agent/test/session.test.ts src/app/api/violations/route.ts
git commit -m "feat(agent): phiên Claude Tool Runner, handler nghiên cứu, poke review từ /api/violations"
```

---

## Pha 4 — Panel Agent trên dashboard

### Task 13: `DESIGN.md` (nguồn sự thật giao diện) từ token đang dùng

**Files:**
- Create: `DESIGN.md`

**Interfaces:**
- Produces: token màu/chữ/khoảng cách/bo góc/độ nổi lấy từ `src/app/globals.css` và component `src/components/settings/ui.tsx`; quy ước component "Agent" (băng band, dòng thời gian, ô hỏi đáp).

- [ ] **Step 1: Đọc token thật**

Run: `grep -n "^\s*--" src/app/globals.css | head -60 && sed -n 1,50p src/components/settings/ui.tsx`

- [ ] **Step 2: Viết `DESIGN.md`** (theo google-labs-code/design.md: YAML front matter + prose)

```markdown
---
name: SafeSight Dashboard
version: 1.0.0
description: Dashboard giám sát an toàn lao động, nền tối, mật độ thông tin cao, phản hồi realtime.
colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-light: "#3B82F6"
  primary-muted: "rgba(37, 99, 235, 0.15)"
  danger: "#DC2626"
  danger-muted: "rgba(220, 38, 38, 0.15)"
  warning: "#F59E0B"
  warning-muted: "rgba(245, 158, 11, 0.15)"
  success: "#16A34A"
  success-muted: "rgba(22, 163, 74, 0.15)"
  info: "#0EA5E9"
  info-muted: "rgba(14, 165, 233, 0.15)"
  severity-critical: "#DC2626"
  severity-high: "#EA580C"
  severity-medium: "#F59E0B"
  severity-low: "#0EA5E9"
  background: "#0F172A"
  background-secondary: "#0B1120"
  surface: "#1E293B"
  surface-hover: "#273548"
  surface-elevated: "#334155"
  border: "#334155"
  border-subtle: "#1E293B"
  text-primary: "#F8FAFC"
  text-secondary: "#94A3B8"
  text-muted: "#64748B"
typography:
  family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace"
  h1: "30px / 800"
  h2: "20px / 800"
  body: "14px / 400"
  label: "10px / 900 uppercase tracking-widest"
spacing:
  unit: 4px
  card: 20px
  section: 32px
radius:
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  card: 16px
elevation:
  sm: "0 1px 2px 0 rgba(0,0,0,0.3)"
  md: "0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.3)"
  glow-primary: "0 0 20px rgba(37,99,235,0.3)"
  glow-danger: "0 0 20px rgba(220,38,38,0.3)"
motion:
  fast: "150ms ease"
  base: "300ms ease"
  enter: "animate-fade-up (translateY 8px → 0, opacity 0 → 1, 300ms)"
---

# SafeSight Dashboard — DESIGN.md

## Vì sao trông như vậy
Dashboard chạy 24/7 trong phòng trực, nền tối để đỡ mỏi mắt và để khung đỏ vi phạm nổi bật.
Màu ngữ nghĩa cố định: đỏ = vi phạm/nguy hiểm, vàng = cảnh báo/chờ, xanh lá = an toàn/đã xử lý,
xanh dương = hành động chính. Không dùng màu khác cho các ý này.

## Thành phần dùng chung
- `SectionHeader`, `SettingCard`, `InputGroup`, `Switch` trong `src/components/settings/ui.tsx` — mọi
  form/cài đặt mới dùng lại, không tự vẽ.
- Card: nền `surface`, viền `border`, bo `radius.card`, đệm `spacing.card`.
- Nhãn nhỏ (`label`) chữ HOA, `text-muted`; số liệu lớn `font-black`.
- Nút chính: nền `primary`, chữ trắng, hover `primary-hover`, `glow-primary` khi là hành động quan trọng.

## Thành phần Agent (mới)
- **Băng band**: `VERIFIED` = `success` (báo oan) hoặc `danger` (vi phạm thật); `PROBABLE` = `warning`;
  `POSSIBLE` = `info`; chưa review = `text-muted` với chữ "Chưa review".
- **Observation chip**: viền `border`, chữ `text-secondary`, 10px, tiếng Việt từ `WEIGHTS[kind].label`.
- **Dòng thời gian AgentEvent**: mỗi dòng có icon theo `type` (tool.call = Terminal, verdict = ShieldCheck/ShieldAlert,
  action = Zap, health = Activity, error = AlertCircle, message = MessageSquare), giờ `HH:mm:ss` mono.
- **Ô hỏi đáp**: textarea + nút gửi; khi phiên đang chạy hiện "Agent đang trả lời…" và poll 2s; im lặng 90s coi là xong.
- **Trạng thái rỗng/tải/lỗi** bắt buộc cho mọi khối: "Chưa có gì", skeleton `surface-elevated`, thông báo lỗi `danger-muted`.

## Responsive
- Lưới `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` cho thẻ số; bảng/dòng thời gian cuộn ngang trong container `overflow-x-auto`.
- Không bao giờ để trang cuộn ngang; văn bản dài `break-words`.
- Ghi chú: layout hiện có sidebar cố định 260px chưa responsive (việc riêng, ngoài plan này).

## Trợ năng
- Mọi nút icon có `aria-label`; focus ring `ring-2 ring-[var(--primary)]`.
- Tương phản chữ trên `surface` ≥ 4.5:1 (đã đạt với `text-primary`/`text-secondary`).
```

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md
git commit -m "docs(design): DESIGN.md nguồn sự thật giao diện, thêm quy ước thành phần Agent"
```

---

### Task 14: API `/api/agent/*` và hook `use-agent.ts`

**Files:**
- Create: `src/app/api/agent/tasks/route.ts`, `src/app/api/agent/events/route.ts`, `src/app/api/agent/settings/route.ts`, `src/app/api/agent/ask/route.ts`, `src/hooks/use-agent.ts`, `src/types/agent.ts`

**Interfaces:**
- Produces:
  - `GET /api/agent/tasks?status=open|done&subjectType&subjectId&limit` → `AgentTaskView[]`
  - `GET /api/agent/events?sessionId|subjectType&subjectId&since&limit` → `AgentEventView[]`
  - `GET|PATCH /api/agent/settings` → `AgentSettingsView` (PATCH: `{ isEnabled?, model?, reviewEffort?, dailyTokenCap?, shiftReportAt? }`, chỉ SUPER_ADMIN/ORG_ADMIN)
  - `POST /api/agent/ask { message, subjectType?, subjectId?, sessionId? }` → `{ sessionId, taskId }`
  - Hooks: `useAgentTasks(filter)`, `useAgentEvents(filter, { live })`, `useAgentSettings()`, `useSaveAgentSettings()`, `useAskAgent()`
  - Types (`src/types/agent.ts`): `AgentTaskView`, `AgentEventView`, `AgentSettingsView`, `AgentReview`

- [ ] **Step 1: `src/types/agent.ts`**

```ts
// SPDX-License-Identifier: MIT

export interface AgentTaskView {
  id: string; kind: string; subjectType: string | null; subjectId: string | null; reason: string;
  priority: number; attempts: number; dueAt: string; startedAt: string | null; finishedAt: string | null; outcome: string | null; sessionId: string | null;
}

export interface AgentEventView {
  id: string; sessionId: string; taskId: string | null; subjectType: string | null; subjectId: string | null;
  type: string; data: Record<string, unknown>; emittedAt: string;
}

export interface AgentSettingsView {
  isEnabled: boolean; model: string; reviewEffort: string; dailyTokenCap: number; shiftReportAt: string;
}

export interface AgentReview {
  verdict: 'false_positive' | 'violation' | 'undecided'; band: 'VERIFIED' | 'PROBABLE' | 'POSSIBLE' | null;
  score: number; observations: string[]; note: string; rationale: string; sessionId: string; reviewedAt: string;
}

export const OBSERVATION_LABELS: Record<string, string> = {
  'snapshot.no-person': 'khung đỏ không có người',
  'snapshot.ppe-visible': 'món bị báo thiếu nhìn thấy rõ',
  'snapshot.ppe-clearly-missing': 'thấy rõ thiếu đồ bảo hộ',
  'track.confirmed-repeat': 'cùng người tái phạm',
  'history.camera-false-positive-prone': 'camera hay báo oan',
  'snapshot.occluded-or-backlit': 'che khuất / ngược sáng',
  'snapshot.person-outside-work-zone': 'người ngoài khu làm việc',
  'contradiction': 'bằng chứng mâu thuẫn',
};
```

- [ ] **Step 2: `src/app/api/agent/tasks/route.ts`**

```ts
// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { AgentTaskView } from '@/types/agent';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const status = q.get('status') ?? 'open';
  const rows = await prisma.agentTask.findMany({
    where: {
      finishedAt: status === 'done' ? { not: null } : null,
      subjectType: q.get('subjectType') ?? undefined,
      subjectId: q.get('subjectId') ?? undefined,
    },
    orderBy: status === 'done' ? { finishedAt: 'desc' } : [{ priority: 'desc' }, { dueAt: 'asc' }],
    take: Math.min(Number(q.get('limit') ?? 50), 200),
  });
  const view: AgentTaskView[] = rows.map(t => ({
    id: t.id, kind: t.kind, subjectType: t.subjectType, subjectId: t.subjectId, reason: t.reason, priority: t.priority, attempts: t.attempts,
    dueAt: t.dueAt.toISOString(), startedAt: t.startedAt?.toISOString() ?? null, finishedAt: t.finishedAt?.toISOString() ?? null, outcome: t.outcome, sessionId: t.sessionId,
  }));
  return NextResponse.json(view);
}
```

- [ ] **Step 3: `src/app/api/agent/events/route.ts`**

```ts
// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import type { AgentEventView } from '@/types/agent';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const since = q.get('since');
  const rows = await prisma.agentEvent.findMany({
    where: {
      sessionId: q.get('sessionId') ?? undefined,
      subjectType: q.get('subjectType') ?? undefined,
      subjectId: q.get('subjectId') ?? undefined,
      type: q.get('type') ?? undefined,
      emittedAt: since ? { gte: new Date(since) } : undefined,
    },
    orderBy: { emittedAt: q.get('sessionId') ? 'asc' : 'desc' },
    take: Math.min(Number(q.get('limit') ?? 100), 500),
  });
  const view: AgentEventView[] = rows.map(e => ({
    id: e.id, sessionId: e.sessionId, taskId: e.taskId, subjectType: e.subjectType, subjectId: e.subjectId, type: e.type,
    data: JSON.parse(e.data), emittedAt: e.emittedAt.toISOString(),
  }));
  return NextResponse.json(view);
}
```

- [ ] **Step 4: `src/app/api/agent/settings/route.ts`**

```ts
// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ORG_WIDE_ROLES } from '@/lib/auth/site-access';
import type { AgentSettingsView } from '@/types/agent';

async function getOrCreate() {
  return (await prisma.agentSettings.findFirst()) ?? prisma.agentSettings.create({ data: {} });
}
const toView = (s: Awaited<ReturnType<typeof getOrCreate>>): AgentSettingsView => ({ isEnabled: s.isEnabled, model: s.model, reviewEffort: s.reviewEffort, dailyTokenCap: s.dailyTokenCap, shiftReportAt: s.shiftReportAt });

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(toView(await getOrCreate()));
}

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  model: z.enum(['claude-opus-5', 'claude-sonnet-5']).optional(),
  reviewEffort: z.enum(['low', 'medium', 'high']).optional(),
  dailyTokenCap: z.number().int().min(100_000).max(50_000_000).optional(),
  shiftReportAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ORG_WIDE_ROLES.includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const current = await getOrCreate();
  const updated = await prisma.agentSettings.update({ where: { id: current.id }, data: parsed.data });
  return NextResponse.json(toView(updated));
}
```

- [ ] **Step 5: `src/app/api/agent/ask/route.ts`**

```ts
// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { pokeAgent } from '@/lib/agent-bridge';

const askSchema = z.object({
  message: z.string().min(1).max(2000),
  subjectType: z.enum(['violation', 'camera', 'site', 'system']).default('system'),
  subjectId: z.string().optional(),
  sessionId: z.string().uuid().optional(),
});

// Không gọi model ở đây: ghi message.user + task ask, agent tự trả lời; panel poll /api/agent/events?sessionId.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = askSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { message, subjectType, subjectId, sessionId: given } = parsed.data;
  const sessionId = given ?? randomUUID();
  await prisma.agentEvent.create({ data: { sessionId, subjectType, subjectId: subjectId ?? null, type: 'message.user', data: JSON.stringify({ text: message, userId: session.user.id, userName: session.user.name ?? '' }) } });
  const open = await prisma.agentTask.findFirst({ where: { kind: 'ask', sessionId, finishedAt: null }, select: { id: true } });
  const task = open
    ? await prisma.agentTask.update({ where: { id: open.id }, data: { reason: message.slice(0, 200), dueAt: new Date() }, select: { id: true } })
    : await prisma.agentTask.create({ data: { kind: 'ask', subjectType, subjectId: subjectId ?? null, reason: message.slice(0, 200), priority: 500, budget: 8, dueAt: new Date(), sessionId }, select: { id: true } });
  pokeAgent('/internal/ask', { taskId: task.id });
  return NextResponse.json({ sessionId, taskId: task.id }, { status: 202 });
}
```

Lưu ý: `agent/research/index.ts` (Task 12) đọc `AgentTask.sessionId` để nối thread; `preambleFor` (Task 11) đã nạp tối đa 10 lượt trao đổi trước của cùng `sessionId`, nên câu hỏi tiếp theo trong thread có ngữ cảnh.

- [ ] **Step 6: `src/hooks/use-agent.ts`**

```ts
// SPDX-License-Identifier: MIT
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AgentEventView, AgentSettingsView, AgentTaskView } from '@/types/agent';

const qs = (o: Record<string, string | number | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString();

export function useAgentTasks(filter: { status?: 'open' | 'done'; subjectType?: string; subjectId?: string; limit?: number } = {}) {
  return useQuery<AgentTaskView[]>({
    queryKey: ['agent-tasks', filter],
    queryFn: async () => { const r = await fetch(`/api/agent/tasks?${qs(filter)}`); if (!r.ok) throw new Error('Không tải được task agent'); return r.json(); },
    refetchInterval: 10_000,
  });
}

export function useAgentEvents(filter: { sessionId?: string; subjectType?: string; subjectId?: string; type?: string; limit?: number }, opts: { live?: boolean; enabled?: boolean } = {}) {
  return useQuery<AgentEventView[]>({
    queryKey: ['agent-events', filter],
    queryFn: async () => { const r = await fetch(`/api/agent/events?${qs(filter)}`); if (!r.ok) throw new Error('Không tải được nhật ký agent'); return r.json(); },
    refetchInterval: opts.live ? 2_000 : 15_000,
    enabled: opts.enabled ?? true,
  });
}

export function useAgentSettings() {
  return useQuery<AgentSettingsView>({ queryKey: ['agent-settings'], queryFn: async () => { const r = await fetch('/api/agent/settings'); if (!r.ok) throw new Error('Không tải được cài đặt agent'); return r.json(); } });
}

export function useSaveAgentSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<AgentSettingsView>) => { const r = await fetch('/api/agent/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error('Lưu cài đặt thất bại'); return r.json() as Promise<AgentSettingsView>; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['agent-settings'] }),
  });
}

export function useAskAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { message: string; subjectType?: string; subjectId?: string; sessionId?: string }) => { const r = await fetch('/api/agent/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); if (!r.ok) throw new Error('Gửi câu hỏi thất bại'); return r.json() as Promise<{ sessionId: string; taskId: string }>; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-events'] }); qc.invalidateQueries({ queryKey: ['agent-tasks'] }); },
  });
}
```

- [ ] **Step 7: Typecheck + kiểm nhanh route (máy tải nhẹ, cần `next dev` hoặc build+start)**

Run: `npx tsc --noEmit && npx eslint src/app/api/agent src/hooks/use-agent.ts src/types/agent.ts`
Expected: sạch. Với server chạy và đã đăng nhập (cookie), `curl -s -b cookies.txt localhost:3000/api/agent/settings` trả JSON có `isEnabled`. Không cookie → `401`.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/agent src/hooks/use-agent.ts src/types/agent.ts
git commit -m "feat(agent): API /api/agent/* (task, event, settings, ask) và hook React Query"
```

---

### Task 15: Trang `/agent`, menu, quyền

**Files:**
- Create: `src/app/(dashboard)/agent/page.tsx`, `src/components/agent/AgentTimeline.tsx`, `src/components/agent/AskAgentBox.tsx`, `src/components/agent/BandBadge.tsx`
- Modify: `src/lib/auth/permissions.ts` (thêm `'/agent'`), `src/components/layout/Sidebar.tsx:36-46` (thêm mục), `src/components/layout/Header.tsx` (tiêu đề trang, theo cách các route khác đang được map — đọc `getHeaderInfo`)

**Interfaces:**
- Consumes: hooks Task 14, `OBSERVATION_LABELS`, `AgentReview`.
- Produces: `<AgentTimeline events limit? />`, `<AskAgentBox subjectType subjectId />` (quản lý `sessionId` trong state, poll live tới `session.ended` hoặc im lặng 90s), `<BandBadge review />`.

- [ ] **Step 1: `permissions.ts`** — thêm vào `PAGE_ROLES`:

```ts
  '/agent': [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.SITE_MANAGER],
```

- [ ] **Step 2: `Sidebar.tsx`** — thêm sau mục "Phân tích": `{ label: 'Agent', href: '/agent', icon: Bot },` và import `Bot` từ `lucide-react`. Kiểm `Header.tsx`: nếu có bảng map route → tiêu đề, thêm `'/agent': { title: 'Agent giám sát', subtitle: 'Trực vận hành và cán bộ an toàn tự động' }` theo đúng shape đang dùng.

- [ ] **Step 3: `src/components/agent/BandBadge.tsx`**

```tsx
// SPDX-License-Identifier: MIT
import { cn } from '@/lib/utils';
import type { AgentReview } from '@/types/agent';

export function BandBadge({ review, className }: { review: AgentReview | null; className?: string }) {
  if (!review || !review.band) return <span className={cn('px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-white/5 text-[var(--text-muted)]', className)}>Chưa review</span>;
  const tone = review.band === 'VERIFIED' ? (review.verdict === 'false_positive' ? 'bg-[var(--success-muted)] text-[var(--success)]' : 'bg-[var(--danger-muted)] text-[var(--danger)]')
    : review.band === 'PROBABLE' ? 'bg-[var(--warning-muted)] text-[var(--warning)]' : 'bg-[var(--info-muted)] text-[var(--info)]';
  const text = `${review.band} · ${review.verdict === 'false_positive' ? 'báo oan' : review.verdict === 'violation' ? 'vi phạm thật' : 'chưa rõ'}`;
  return <span className={cn('px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest', tone, className)}>{text}</span>;
}
```

- [ ] **Step 4: `src/components/agent/AgentTimeline.tsx`**

```tsx
// SPDX-License-Identifier: MIT
import { Activity, AlertCircle, MessageSquare, ShieldAlert, ShieldCheck, Terminal, Zap, FileText } from 'lucide-react';
import type { AgentEventView } from '@/types/agent';

const ICON: Record<string, React.ElementType> = { 'tool.call': Terminal, verdict: ShieldCheck, action: Zap, health: Activity, error: AlertCircle, 'message.user': MessageSquare, 'message.assistant': MessageSquare, report: FileText };

function summary(e: AgentEventView): string {
  const d = e.data as Record<string, unknown>;
  switch (e.type) {
    case 'tool.call': return `gọi ${d.tool}`;
    case 'verdict': return `${d.band ?? '—'} · ${d.verdict} · ${d.note ?? ''}`;
    case 'action': return String(d.action ?? '');
    case 'health': return `${d.code}${e.subjectId ? ` (${e.subjectId})` : ''}`;
    case 'error': return String(d.message ?? '');
    case 'message.user': return `👤 ${d.text ?? ''}`;
    case 'message.assistant': return String(d.text ?? d.note ?? '');
    case 'session.started': return `bắt đầu phiên ${d.kind}`;
    case 'session.ended': return `kết thúc (${d.stop ?? ''})`;
    default: return e.type;
  }
}

export function AgentTimeline({ events, empty = 'Chưa có hoạt động nào.' }: { events: AgentEventView[]; empty?: string }) {
  if (events.length === 0) return <p className="text-sm text-[var(--text-muted)] py-6 text-center">{empty}</p>;
  return (
    <ol className="space-y-2">
      {events.map(e => {
        const Icon = e.type === 'verdict' && (e.data as { verdict?: string }).verdict === 'violation' ? ShieldAlert : ICON[e.type] ?? Activity;
        return (
          <li key={e.id} className="flex items-start gap-3 text-sm">
            <span className="font-mono text-[10px] text-[var(--text-muted)] pt-1 shrink-0">{new Date(e.emittedAt).toLocaleTimeString('vi-VN')}</span>
            <Icon className={e.type === 'error' ? 'w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5' : 'w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5'} aria-hidden />
            <span className="text-[var(--text-primary)] break-words">{summary(e)}</span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 5: `src/components/agent/AskAgentBox.tsx`**

```tsx
// SPDX-License-Identifier: MIT
'use client';
import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { useAgentEvents, useAskAgent } from '@/hooks/use-agent';
import { AgentTimeline } from './AgentTimeline';

const QUIET_MS = 90_000;

export function AskAgentBox({ subjectType = 'system', subjectId }: { subjectType?: 'violation' | 'camera' | 'site' | 'system'; subjectId?: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const ask = useAskAgent();
  const { data: events = [] } = useAgentEvents({ sessionId: sessionId ?? undefined, limit: 200 }, { live: sentAt !== null, enabled: !!sessionId });

  const ended = useMemo(() => events.some(e => e.type === 'session.ended' && sentAt !== null && new Date(e.emittedAt).getTime() > sentAt), [events, sentAt]);
  // "Đang trả lời" = đã gửi, chưa thấy session.ended, và chưa im lặng quá 90s. Tick 5s để hết hạn 90s cũng tự tắt poll.
  const [tick, setTick] = useState(0);
  useEffect(() => { if (sentAt === null) return; const t = setInterval(() => setTick(n => n + 1), 5_000); return () => clearInterval(t); }, [sentAt]);
  void tick;
  const working = sentAt !== null && !ended && Date.now() - sentAt < QUIET_MS;

  const submit = async () => {
    const message = text.trim(); if (!message) return;
    const r = await ask.mutateAsync({ message, subjectType, subjectId, sessionId: sessionId ?? undefined });
    setSessionId(r.sessionId); setSentAt(Date.now()); setText('');
  };

  const shown = events.filter(e => ['message.user', 'message.assistant', 'verdict', 'action', 'error'].includes(e.type));
  return (
    <div className="space-y-3">
      <AgentTimeline events={shown} empty="Hỏi agent về camera, vi phạm, hay tình trạng hệ thống." />
      {working && <p className="text-xs text-[var(--text-muted)]">Agent đang trả lời…</p>}
      <div className="flex gap-2">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Ví dụ: cam-003 hôm nay có gì bất thường?"
          className="flex-1 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
        <button onClick={submit} disabled={ask.isPending || !text.trim()} aria-label="Gửi câu hỏi cho agent"
          className="px-4 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
      {ask.isError && <p className="text-xs text-[var(--danger)]">Gửi thất bại, thử lại.</p>}
    </div>
  );
}
```

Ghi chú: poll 2s bật khi đã gửi (`live: sentAt !== null`); sau khi thấy `session.ended` hoặc im lặng 90s, thêm `useEffect(() => { if (sentAt !== null && !working) setSentAt(null); }, [working, sentAt]);` với comment `// eslint-disable-next-line react-hooks/set-state-in-effect -- tắt poll khi phiên đã xong` ngay trên dòng `setSentAt(null)` để quay về 15s. Thread (`sessionId`) vẫn giữ để hỏi tiếp.

- [ ] **Step 6: `src/app/(dashboard)/agent/page.tsx`**

```tsx
// SPDX-License-Identifier: MIT
'use client';
import { useState } from 'react';
import { Bot, Activity, ListTodo, Settings2 } from 'lucide-react';
import { SectionHeader, SettingCard, InputGroup, Switch } from '@/components/settings/ui';
import { AgentTimeline } from '@/components/agent/AgentTimeline';
import { AskAgentBox } from '@/components/agent/AskAgentBox';
import { useAgentEvents, useAgentSettings, useAgentTasks, useSaveAgentSettings } from '@/hooks/use-agent';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const FILTERS = [['', 'Tất cả'], ['verdict', 'Phán quyết'], ['action', 'Hành động'], ['health', 'Sức khoẻ'], ['error', 'Lỗi']] as const;

export default function AgentPage() {
  const [type, setType] = useState<string>('');
  const { data: events = [], isLoading, isError } = useAgentEvents({ type: type || undefined, limit: 150 });
  const { data: open = [] } = useAgentTasks({ status: 'open', limit: 30 });
  const { data: settings } = useAgentSettings();
  const save = useSaveAgentSettings();
  const sweep = events.find(e => e.type === 'health');

  const update = (data: Parameters<typeof save.mutate>[0]) => save.mutate(data, { onSuccess: () => toast('Đã lưu cài đặt agent', 'success'), onError: () => toast('Lưu thất bại', 'error') });

  return (
    <div className="space-y-8 pb-20 animate-fade-up">
      <SectionHeader title="Agent giám sát" description="Trực vận hành tất định + cán bộ an toàn tự động. Mọi hành động đều có lý do và được ghi lại." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Trạng thái</p><p className="text-2xl font-black mt-1">{settings ? (settings.isEnabled ? 'Đang chạy' : 'Tạm dừng') : '…'}</p></SettingCard>
        <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Task đang chờ</p><p className="text-2xl font-black mt-1">{open.length}</p></SettingCard>
        <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Sweep gần nhất</p><p className="text-sm font-bold mt-1">{sweep ? new Date(sweep.emittedAt).toLocaleTimeString('vi-VN') : 'chưa có'}</p></SettingCard>
        <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Model</p><p className="text-sm font-bold mt-1">{settings?.model ?? '…'}</p></SettingCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SettingCard className="lg:col-span-2">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <h3 className="font-black flex items-center gap-2"><Activity className="w-4 h-4" /> Dòng thời gian</h3>
            <div className="flex gap-1 overflow-x-auto">
              {FILTERS.map(([v, label]) => (
                <button key={v} onClick={() => setType(v)} className={cn('px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest', type === v ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]')}>{label}</button>
              ))}
            </div>
          </div>
          {isLoading ? <div className="h-24 rounded-xl bg-[var(--surface-elevated)] animate-pulse" /> : isError ? <p className="text-sm text-[var(--danger)]">Không tải được nhật ký.</p> : <div className="overflow-x-auto"><AgentTimeline events={events} /></div>}
        </SettingCard>

        <div className="space-y-6">
          <SettingCard>
            <h3 className="font-black flex items-center gap-2 mb-3"><ListTodo className="w-4 h-4" /> Hàng đợi</h3>
            {open.length === 0 ? <p className="text-sm text-[var(--text-muted)]">Không có task chờ.</p> : (
              <ul className="space-y-2 text-sm">
                {open.map(t => <li key={t.id} className="break-words"><span className="font-mono text-[10px] text-[var(--text-muted)]">{t.kind}</span> · {t.reason} <span className="text-[var(--text-muted)]">({new Date(t.dueAt).toLocaleTimeString('vi-VN')})</span></li>)}
              </ul>
            )}
          </SettingCard>

          <SettingCard>
            <h3 className="font-black flex items-center gap-2 mb-3"><Settings2 className="w-4 h-4" /> Cài đặt</h3>
            {settings && (
              <div className="space-y-4">
                <Switch enabled={settings.isEnabled} onChange={v => update({ isEnabled: v })} label="Bật agent" description="Tắt: chỉ ghi nhận, không hành động." />
                <InputGroup label="Model"><select value={settings.model} onChange={e => update({ model: e.target.value })} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm"><option value="claude-opus-5">claude-opus-5</option><option value="claude-sonnet-5">claude-sonnet-5</option></select></InputGroup>
                <InputGroup label="Độ kỹ khi review"><select value={settings.reviewEffort} onChange={e => update({ reviewEffort: e.target.value })} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select></InputGroup>
                <InputGroup label="Trần token / ngày"><input type="number" defaultValue={settings.dailyTokenCap} onBlur={e => update({ dailyTokenCap: Number(e.target.value) })} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm" /></InputGroup>
                <InputGroup label="Giờ báo cáo ca"><input type="time" defaultValue={settings.shiftReportAt} onBlur={e => update({ shiftReportAt: e.target.value })} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm" /></InputGroup>
              </div>
            )}
          </SettingCard>
        </div>
      </div>

      <SettingCard>
        <h3 className="font-black flex items-center gap-2 mb-3"><Bot className="w-4 h-4" /> Hỏi agent</h3>
        <AskAgentBox subjectType="system" />
      </SettingCard>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck + lint + kiểm UI (máy tải nhẹ)**

Run: `npx tsc --noEmit && npx eslint "src/app/(dashboard)/agent" src/components/agent src/components/layout src/lib/auth`
Expected: sạch. Chạy `npm run build && npx next start -p 3100` (env như đã dùng khi kiểm tra chuẩn hoá), đăng nhập `admin@safesight.ai`, mở `/agent`: 4 thẻ số, dòng thời gian có event health (từ Task 7), cài đặt đổi được (toast "Đã lưu"), ô hỏi gửi được (tạo task `ask`). Chụp desktop 1366px và mobile 390px bằng script CDP trong scratchpad (xem memory `safesight-ui-check-via-cdp`); không tràn ngang trong vùng nội dung, không chồng chữ.

- [ ] **Step 8: Commit**

```bash
git add "src/app/(dashboard)/agent" src/components/agent src/lib/auth/permissions.ts src/components/layout/Sidebar.tsx src/components/layout/Header.tsx
git commit -m "feat(agent): trang /agent — dòng thời gian, hàng đợi, cài đặt, hỏi đáp"
```

---

### Task 16: Tab Agent trong modal vi phạm, khối Agent trong modal camera và công trường

**Files:**
- Create: `src/components/agent/AgentReviewCard.tsx`, `src/components/agent/SubjectAgentPanel.tsx`
- Modify: `src/components/violations/ViolationDetailModal.tsx` (thêm tab), `src/app/(dashboard)/cameras/page.tsx` (`LiveEventModal`), `src/components/sites/SiteDetailModal.tsx`, `src/types/models.ts` (`Violation.agentReview?: AgentReview | null`), `src/app/api/violations/route.ts` + `[id]/route.ts` (trả `agentReview` đã parse)

**Interfaces:**
- Produces: `<AgentReviewCard review />` (band + chip observation + note + giờ); `<SubjectAgentPanel subjectType subjectId />` (nhận xét gần nhất, task chờ, dòng thời gian 20 event, ô hỏi).

- [ ] **Step 1: Trả `agentReview` từ API** — trong `getRealViolations()` (`src/app/api/violations/route.ts`) và GET của `[id]/route.ts`, thêm vào object map: `agentReview: v.agentReview ? JSON.parse(v.agentReview) : null,`. Trong `src/types/models.ts` `interface Violation` thêm `agentReview?: AgentReview | null;` với `import type { AgentReview } from './agent';`.

- [ ] **Step 2: `src/components/agent/AgentReviewCard.tsx`**

```tsx
// SPDX-License-Identifier: MIT
import { BandBadge } from './BandBadge';
import { OBSERVATION_LABELS, type AgentReview } from '@/types/agent';

export function AgentReviewCard({ review }: { review: AgentReview | null }) {
  if (!review) return <p className="text-sm text-[var(--text-muted)]">Agent chưa review vi phạm này. Nếu agent đang chạy, kết quả thường có trong 1–2 phút.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap"><BandBadge review={review} /><span className="text-[10px] text-[var(--text-muted)]">{new Date(review.reviewedAt).toLocaleString('vi-VN')}</span></div>
      <div className="flex flex-wrap gap-1">
        {review.observations.map(o => <span key={o} className="px-2 py-0.5 rounded-md border border-[var(--border)] text-[10px] text-[var(--text-secondary)]">{OBSERVATION_LABELS[o] ?? o}</span>)}
      </div>
      <p className="text-sm text-[var(--text-primary)] break-words">{review.note}</p>
    </div>
  );
}
```

- [ ] **Step 3: `src/components/agent/SubjectAgentPanel.tsx`**

```tsx
// SPDX-License-Identifier: MIT
'use client';
import { useAgentEvents, useAgentTasks } from '@/hooks/use-agent';
import { AgentTimeline } from './AgentTimeline';
import { AskAgentBox } from './AskAgentBox';

export function SubjectAgentPanel({ subjectType, subjectId }: { subjectType: 'violation' | 'camera' | 'site'; subjectId: string }) {
  const { data: events = [], isLoading } = useAgentEvents({ subjectType, subjectId, limit: 20 });
  const { data: tasks = [] } = useAgentTasks({ status: 'open', subjectType, subjectId });
  return (
    <div className="space-y-4">
      {tasks.length > 0 && <p className="text-xs text-[var(--warning)]">Đang chờ: {tasks.map(t => `${t.kind} — ${t.reason}`).join('; ')}</p>}
      {isLoading ? <div className="h-16 rounded-xl bg-[var(--surface-elevated)] animate-pulse" /> : <div className="overflow-x-auto"><AgentTimeline events={events} empty="Agent chưa có hoạt động nào với bản ghi này." /></div>}
      <AskAgentBox subjectType={subjectType} subjectId={subjectId} />
    </div>
  );
}
```

- [ ] **Step 4: Tab trong `ViolationDetailModal.tsx`** — thêm state `const [tab, setTab] = useState<'detail' | 'agent'>('detail');` cạnh `showTicket`; ngay dưới tiêu đề modal (trước khối nội dung chính) thêm hai nút tab:

```tsx
<div className="flex gap-1 mb-4">
  {(['detail', 'agent'] as const).map(t => (
    <button key={t} onClick={() => setTab(t)} className={cn('px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest', tab === t ? 'bg-[var(--primary)] text-white' : 'text-white/50 hover:text-white')}>{t === 'detail' ? 'Chi tiết' : 'Agent'}</button>
  ))}
</div>
```

và bọc nội dung hiện có trong `{tab === 'detail' && (...)}`; thêm `{tab === 'agent' && (<div className="space-y-4"><AgentReviewCard review={violation.agentReview ?? null} /><SubjectAgentPanel subjectType="violation" subjectId={violation.id} /></div>)}`. Import hai component. Kiểu `ViolationLike` đã là `Violation & {...}` nên có `agentReview`.

- [ ] **Step 5: Khối trong `LiveEventModal` (cameras/page.tsx) và `SiteDetailModal.tsx`** — ở cuối cột thông tin của mỗi modal thêm:

```tsx
<div className="mt-6 pt-4 border-t border-white/10">
  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Agent</h4>
  <SubjectAgentPanel subjectType="camera" subjectId={camera.id} />
</div>
```

(với `SiteDetailModal`: `subjectType="site" subjectId={site.id}`).

- [ ] **Step 6: Typecheck + lint + kiểm UI (máy tải nhẹ)**

Run: `npx tsc --noEmit && npx eslint src/components/agent src/components/violations src/components/sites "src/app/(dashboard)/cameras" src/app/api/violations`
Expected: sạch. Trên server chạy: mở `/violations`, bấm một vi phạm → tab "Agent" hiện band/nhận xét (hoặc "chưa review"), gửi câu hỏi tạo task `ask` với `subjectId` = id vi phạm. Chụp desktop/mobile modal.

- [ ] **Step 7: Commit**

```bash
git add src/components/agent src/components/violations/ViolationDetailModal.tsx "src/app/(dashboard)/cameras/page.tsx" src/components/sites/SiteDetailModal.tsx src/types/models.ts src/app/api/violations
git commit -m "feat(agent): tab Agent trong vi phạm, khối Agent trong camera và công trường"
```

---

## Pha 5 — Tài liệu và nghiệm thu

### Task 17: README, wiki, SPEC, hai vòng nghiệm thu

**Files:**
- Create: `wiki/09-agent.md`
- Modify: `README.md`, `wiki/README.md`, `wiki/02-kien-truc-he-thong.md`, `wiki/03-cai-dat-va-van-hanh.md`, `wiki/04-mo-hinh-du-lieu.md`, `wiki/05-giao-dien-va-api.md`, `wiki/07-lo-trinh-phat-trien.md`, `SPEC.md`

- [ ] **Step 1: `wiki/09-agent.md`** — nội dung theo spec, các mục: Vai trò; Hai lane và hàng đợi (bảng kinds/ưu tiên); Bằng chứng và band (bảng observation); Rào chắn (danh sách không-bao-giờ, tần suất, kill switch, trần token); Tool (bảng 10 tool); Skill; Panel; Env và chạy; Sự cố thường gặp (không có key → outcome "không có ANTHROPIC_API_KEY"; 401 khi poke → secret lệch; task mãi "chờ" → agent không chạy, xem `GET 127.0.0.1:4002/health`). Mỗi bảng sao từ spec, không viết lại khác spec.

- [ ] **Step 2: Cập nhật wiki khác + README + SPEC**
  - `wiki/02`: sơ đồ thêm khối `agent/ (4002)`, mục "4. Agent".
  - `wiki/03`: bảng tiến trình thêm Agent; env thêm `AGENT_BRIDGE_SECRET`, `ANTHROPIC_API_KEY`, `AGENT_PORT`, `SNAPSHOT_MAX_MB`; lệnh `npm run dev:agent`, `npm run test:agent`.
  - `wiki/04`: 3 model mới + `Violation.agentReview`.
  - `wiki/05`: 4 route `/api/agent/*`, trang `/agent` (quyền), hook `use-agent.ts`, component `agent/`.
  - `wiki/07`: chuyển "agent" sang mục đã xong; giữ mục còn lại.
  - `wiki/README.md`: thêm dòng 09 và tóm tắt "Agent".
  - `README.md`: mục "Agent giám sát tự động" ngắn (3 vai trò, cách bật, cách tắt) + cấu trúc thư mục thêm `agent/`.
  - `SPEC.md`: stack thêm `@anthropic-ai/sdk`, trang `/agent`, API `/api/agent/*`, mục 6 thêm agent, lịch sử thêm dòng.

- [ ] **Step 3: Kiểm link tài liệu**

Run: `python3 - <<'PY'
import re,os
bad=0
for f in ['README.md','SPEC.md']+['wiki/'+x for x in os.listdir('wiki') if x.endswith('.md')]:
    d=os.path.dirname(f)
    for m in re.finditer(r'\]\(([^)#]+\.md)(#[^)]*)?\)', open(f,encoding='utf-8').read()):
        t=os.path.normpath(os.path.join(d,m.group(1)))
        if not os.path.exists(t): print('BROKEN',f,m.group(1)); bad+=1
print('broken',bad)
PY`
Expected: `broken 0`.

- [ ] **Step 4: Nghiệm thu vòng 1 (máy tải nhẹ, có `.venv` + 4 file `.pt` + `ANTHROPIC_API_KEY`)**
  1. `npm run test:agent && npx tsc --noEmit && npx eslint . && npm run build` → tất cả sạch/exit 0.
  2. `npm run dev` → log có `[agent] on/off` 4 dòng, `✅ Agent HTTP nội bộ`, heartbeat file xuất hiện sau 5s: `cat public/snapshots/.heartbeat.json`.
  3. Chờ vi phạm đầu tiên từ video mẫu (≥ 3s thiếu PPE): `sqlite3 dev.db "select kind, outcome from AgentTask order by createdAt desc limit 5"` → có `violation.review` finished với outcome tiếng Việt; `select agentReview from Violation where agentReview is not null limit 1` → JSON có `band`.
  4. Dashboard: `/agent` hiển thị verdict trong dòng thời gian; `/violations` → tab Agent hiện band; hỏi "cam-001 hôm nay có gì?" → trả lời trong < 90s.
  5. Tắt agent ở `/agent` → sweep tiếp theo ghi `health` nhưng outcome có "(đang tạm dừng...)"; bật lại.
  6. Kill AI engine (`pkill -f yolo_inference.py`): trong ≤ 2 phút có event `engine.stalled`? (dev-all.sh tự chạy lại nên có thể chỉ thấy heartbeat mới; ghi nhận kết quả thật).
  7. Chụp desktop 1366 / mobile 390: `/agent`, modal vi phạm tab Agent, modal camera. Không tràn ngang trong vùng nội dung, không chồng chữ, dark theme nhất quán.

- [ ] **Step 5: Nghiệm thu vòng 2** — lặp bước 4.1, 4.3, 4.4 sau khi khởi động lại toàn bộ (`Ctrl+C` rồi `npm run dev`), kiểm thêm: task `health.sweep` cũ không bị nhân đôi (`select count(*) from AgentTask where kind='health.sweep' and finishedAt is null` = 1), thread `ask` cũ nối tiếp được (câu hỏi thứ 2 cùng `sessionId` có ngữ cảnh câu 1). Kiểm không regression: `/cameras` vẫn vẽ khung, `/settings` Telegram vẫn lưu, `POST /api/violations` từ Python vẫn 201.

- [ ] **Step 6: Commit**

```bash
git add README.md SPEC.md wiki
git commit -m "docs(agent): wiki 09-agent, cập nhật README/wiki/SPEC cho tiến trình agent"
```

---

## Tự rà soát (đã làm khi viết plan)

- **Phủ spec:** hàng đợi/lane (T3, T5), capabilities/kill switch/ngân sách (T2, T4, T12), trực vận hành 5 phát hiện + hành động + escalate (T6, T7), bằng chứng/band/toàn quyền theo band (T8, T10), 10 tool (T9, T10), 4 skill + preamble + tool set cố định (T11), phiên Claude + lỗi + usage (T12), poke từ API (T7, T12, T14), panel + API + hook (T13–T16), tài liệu + nghiệm thu 2 vòng (T17). Không có mục spec thiếu task.
- **Nhất quán tên:** `scheduleTask/claimDue/completeTask/releaseTask/retireExhausted` (T3) dùng ở T5, T7, T10, T12; `emit/newSessionId` (T2) ở mọi tool; `checkPaused/rateLimit/LIMITS` (T4) ở T7, T10; `newToolContext/ToolContext` (T9) ở T10–T12; `scoreEvidence/OBSERVATION_KINDS` (T8) ở T10; `enqueueAgentTask/pokeAgent` (T7) ở T12, T14; `runSession/SessionError` (T12) ở `research/index.ts` và `main.ts`; `preambleFor(task, { userMessage, sessionId })` sau bổ sung ở T14.
- **Điểm cần xác nhận theo SDK đã cài (ghi rõ trong T9 Step 1, T12 Step 1):** kiểu trả về của `run` với mảng content block, vị trí tham số `max_iterations`. Plan chỉ dẫn cách chỉnh nếu tài liệu khác.
