// SPDX-License-Identifier: MIT
import './lib/env';
import { logCapabilities } from './lib/capabilities';
import { claimDue, completeTask, ensureTask, releaseTask, retireExhausted, type LeasedTask } from './lib/tasks';
import { ensureRecurring } from './lib/recurring';
import { emit, newSessionId } from './lib/audit';
import { runDirect } from './direct/index';
import { runResearch, SessionError } from './research/index';
import { startHttp } from './channels/http';
import { applyModelDefault } from './lib/settings';
import { prisma } from './lib/db';

const TICK_MS = 20_000;
const DIRECT_BATCH = 20;
const RESEARCH_BATCH = 3;

let lastSweepAt: Date | null = null;
let stopping = false;

// Đánh thức sớm vòng lặp (poke từ Next). Mỗi lần sleep giữ timer RIÊNG và finish() clearTimeout,
// nên timer cũ không bao giờ đụng vào lần sleep sau; wake chỉ bị xoá nếu vẫn là của lần này.
let wake: (() => void) | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise<void>(resolve => {
    const finish = () => {
      clearTimeout(timer);
      if (wake === finish) wake = null;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    wake = finish;
  });
}

async function runOne(task: LeasedTask, run: (t: LeasedTask) => Promise<string>): Promise<void> {
  try {
    const outcome = await run(task);
    if (task.kind === 'health.sweep') lastSweepAt = new Date();
    await completeTask(task.id, outcome);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Ưu tiên phiên mà runSession vừa chạy (SessionError.sessionId); nếu không có thì task.sessionId
    // (task đã có thread, vd. 'ask' nối lại) — gắn lỗi vào đúng thread panel đang poll.
    const sessionId = (error instanceof SessionError ? error.sessionId : undefined) ?? task.sessionId ?? newSessionId();
    await emit({ sessionId, taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'error', data: { kind: task.kind, message } });
    if (error instanceof SessionError && error.fatal) { await completeTask(task.id, `lỗi không thử lại: ${message}`); return; }
    const delay = error instanceof SessionError && error.retryAfterMs ? error.retryAfterMs : 30_000 * task.attempts;
    await releaseTask(task.id, delay, `lỗi: ${message}`, { refundAttempt: error instanceof SessionError && error.refundAttempt });
  }
}

async function tick(): Promise<void> {
  await retireExhausted();
  for (const task of await claimDue(DIRECT_BATCH, 'direct')) await runOne(task, runDirect);
  // Mỗi camera nhiều nhất một task/lượt (onePerCamera) nên các phiên nghiên cứu chạy song song được.
  const research = await claimDue(RESEARCH_BATCH, 'research', new Date(), { onePerCamera: true });
  await Promise.allSettled(research.map(t => runOne(t, task => runResearch(task))));
  await ensureRecurring();
}

async function seed(): Promise<void> {
  // Row Violation cũ có thể ghi status chữ thường; SQLite phân biệt hoa/thường trên cột TEXT.
  // Nắn một lần lúc khởi động (idempotent) để mọi nơi so sánh bằng chữ HOA thẳng, không phải
  // rải idiom không-phân-biệt-hoa-thường ở từng chỗ gọi.
  const normalized = await prisma.$executeRawUnsafe('UPDATE "Violation" SET status = upper(status) WHERE status <> upper(status)');
  if (normalized) console.log(`[agent] chuẩn hoá ${normalized} dòng Violation.status về chữ HOA`);
  await applyModelDefault();
  await ensureTask({ kind: 'health.sweep', subjectType: 'system', reason: 'Quét sức khoẻ định kỳ', dueAt: new Date() });
  await ensureRecurring();
}

async function main(): Promise<void> {
  console.log('🤖 SafeSight Agent khởi động');
  await logCapabilities();
  await seed();
  startHttp({ drain: () => wake?.(), lastSweepAt: () => lastSweepAt });
  // Node giết tiến trình khi có promise rejection không bắt — trực vận hành phải sống sót và ghi log thay vì chết.
  process.on('unhandledRejection', (reason) => console.error('[agent] unhandledRejection', reason instanceof Error ? reason.message : String(reason)));
  process.on('SIGTERM', () => { stopping = true; wake?.(); });
  process.on('SIGINT', () => { stopping = true; wake?.(); });
  while (!stopping) {
    try { await tick(); } catch (error) { console.error('[agent] tick lỗi', error); }
    if (stopping) break; // SIGTERM/SIGINT trong lúc tick chạy: đừng ngủ hết 20s rồi mới thoát.
    await sleep(TICK_MS);
  }
  console.log('[agent] dừng');
  process.exit(0);
}

void main();
