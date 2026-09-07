// SPDX-License-Identifier: MIT
import './lib/env';
import { logCapabilities } from './lib/capabilities';
import { claimDue, completeTask, ensureTask, releaseTask, retireExhausted, type LeasedTask } from './lib/tasks';
import { emit, newSessionId } from './lib/audit';
import { runDirect } from './direct/index';
import { runResearch, SessionError } from './research/index';
import { startHttp } from './channels/http';
import { getAgentSettings } from './lib/settings';

const TICK_MS = 20_000;
const DIRECT_BATCH = 20;
const RESEARCH_BATCH = 2;

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
    await emit({ sessionId: newSessionId(), taskId: task.id, subjectType: task.subjectType, subjectId: task.subjectId, type: 'error', data: { kind: task.kind, message } });
    if (error instanceof SessionError && error.fatal) { await completeTask(task.id, `lỗi không thử lại: ${message}`); return; }
    const delay = error instanceof SessionError && error.retryAfterMs ? error.retryAfterMs : 30_000 * task.attempts;
    await releaseTask(task.id, delay, `lỗi: ${message}`, { refundAttempt: error instanceof SessionError && error.refundAttempt });
  }
}

async function tick(): Promise<void> {
  await retireExhausted();
  for (const task of await claimDue(DIRECT_BATCH, 'direct')) await runOne(task, runDirect);
  for (const task of await claimDue(RESEARCH_BATCH, 'research')) await runOne(task, t => runResearch(t));
  await ensureRecurring();
}

// Lưới an toàn mỗi vòng: nếu vì lý do gì (crash giữa chừng, task bị retire) không còn sweep/báo cáo đang chờ thì tạo lại.
// ensureTask không đổi dueAt của task đang chờ, nên không làm sweep chạy dày hơn 60s.
async function ensureRecurring(): Promise<void> {
  await ensureTask({ kind: 'health.sweep', subjectType: 'system', reason: 'Quét sức khoẻ định kỳ', dueAt: new Date(Date.now() + 60_000) });
  const settings = await getAgentSettings();
  const [hh, mm] = settings.shiftReportAt.split(':').map(Number);
  const due = new Date(); due.setHours(hh, mm, 0, 0);
  if (due.getTime() <= Date.now()) due.setDate(due.getDate() + 1);
  await ensureTask({ kind: 'shift.report', subjectType: 'system', reason: `Báo cáo ca lúc ${settings.shiftReportAt}`, dueAt: due });
}

async function seed(): Promise<void> {
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
    await sleep(TICK_MS);
  }
  console.log('[agent] dừng');
  process.exit(0);
}

void main();
