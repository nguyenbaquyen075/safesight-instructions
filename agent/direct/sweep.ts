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

// probe = quét xen kẽ theo yêu cầu. Ngưỡng leo thang (streak bridge, số lần lặp) được định nghĩa
// theo NHỊP quét định kỳ 60s, nên probe chỉ đọc chúng, không được cộng dồn vào — nếu không, đổi
// nguồn camera vài lần liên tiếp là đủ chạm ngưỡng leo thang mà chưa có 3 vòng quét thật.
export async function runSweep(task: LeasedTask, probe = false): Promise<string> {
  const sessionId = newSessionId();
  const signals = await collectSignals();
  if (!probe) bridgeFailStreak = signals.bridge ? 0 : bridgeFailStreak + 1;
  const findings = decide(signals, { snapshotMaxMb: env.snapshotMaxMb, bridgeFailStreak });
  const paused = await checkPaused();
  const actions = await applyFindings(findings, { sessionId, taskId: task.id, repeats: probe ? new Map() : repeats, paused: paused !== null });
  // Lặp: task mới, không cron. Chỉ sweep định kỳ mới tự hẹn lần sau — probe (task.kind ===
  // 'health.probe') chạy xen giữa hai vòng sweep, không được đẩy lùi lần hẹn định kỳ đang chờ.
  if (task.kind === 'health.sweep') {
    await scheduleTask({ kind: 'health.sweep', subjectType: 'system', reason: 'Quét sức khoẻ định kỳ', dueAt: new Date(Date.now() + SWEEP_EVERY_MS) }, { excludeId: task.id });
  }
  return `${findings.length} phát hiện, ${actions.length} hành động${paused ? ' (đang tạm dừng, chỉ ghi nhận)' : ''}`;
}

// Kiểm một camera vừa đổi nguồn/trạng thái: sweep ngay, không chờ 60s.
export async function runProbe(task: LeasedTask): Promise<string> {
  return runSweep(task, true);
}
