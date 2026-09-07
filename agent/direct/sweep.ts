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
  const actions = await applyFindings(findings, { sessionId, taskId: task.id, repeats, paused: paused !== null });
  // Lặp: task mới, không cron.
  await scheduleTask({ kind: 'health.sweep', subjectType: 'system', reason: 'Quét sức khoẻ định kỳ', dueAt: new Date(Date.now() + SWEEP_EVERY_MS) }, { excludeId: task.id });
  return `${findings.length} phát hiện, ${actions.length} hành động${paused ? ' (đang tạm dừng, chỉ ghi nhận)' : ''}`;
}

// Kiểm một camera vừa đổi nguồn/trạng thái: sweep ngay, không chờ 60s.
export async function runProbe(task: LeasedTask): Promise<string> {
  return runSweep(task);
}
