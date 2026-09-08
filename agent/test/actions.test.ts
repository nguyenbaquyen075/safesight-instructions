// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyFindings, type ActionContext } from '../direct/actions';
import { pickCleanup } from '../direct/cleanup';
import type { Finding } from '../direct/health';
import { runProbe, runSweep } from '../direct/sweep';
import { prisma } from '../lib/db';
import { resetRateLimits } from '../lib/guard';
import { escapeHtml } from '../lib/notify';
import type { LeasedTask } from '../lib/tasks';

const DAY = 86_400_000;
const now = Date.parse('2026-09-07T10:00:00Z');

test('pickCleanup deletes oldest files first, skips files under 24h or files with no referencing Violation', () => {
  const files = [
    { name: 'violation_b.jpg', mtimeMs: now - 35 * DAY, referenced: true },
    { name: 'violation_a.jpg', mtimeMs: now - 40 * DAY, referenced: true },
    { name: 'violation_c.jpg', mtimeMs: now - 2 * DAY, referenced: true },
    { name: 'violation_d.jpg', mtimeMs: now - 50 * DAY, referenced: false },
    { name: 'violation_e.jpg', mtimeMs: now - 1000, referenced: true },
  ];
  const sizes = { 'violation_a.jpg': 100, 'violation_b.jpg': 100, 'violation_c.jpg': 100, 'violation_d.jpg': 100, 'violation_e.jpg': 100 };
  assert.deepEqual(pickCleanup(files, now, 150, sizes), ['violation_a.jpg', 'violation_b.jpg']);
  // Không còn luật giữ 30 ngày (yolo_inference.py xoá sạch ảnh mỗi lần khởi động nên ảnh không
  // bao giờ sống đủ 30 ngày) — chỉ còn luật giữ 24h, nên violation_c.jpg (2 ngày) cũng bị chọn.
  assert.deepEqual(pickCleanup(files, now, 1000, sizes), ['violation_a.jpg', 'violation_b.jpg', 'violation_c.jpg']);
});

test('pickCleanup selects a referenced file that is only 2 days old', () => {
  const files = [{ name: 'violation_c.jpg', mtimeMs: now - 2 * DAY, referenced: true }];
  assert.deepEqual(pickCleanup(files, now, 1, { 'violation_c.jpg': 100 }), ['violation_c.jpg']);
});

test('escapeHtml blocks HTML tags in model-generated text', () => {
  assert.equal(escapeHtml('cam <b>1</b> & 2'), 'cam &lt;b&gt;1&lt;/b&gt; &amp; 2');
  assert.equal(escapeHtml('không có gì đặc biệt'), 'không có gì đặc biệt');
});

test('applyFindings does not SIGTERM a stale/foreign engine.stalled pid, and does not spend the engine-restart rate limit doing so', async () => {
  resetRateLimits();
  const originalKill = process.kill;
  const killed: number[] = [];
  process.kill = ((pid: number) => { killed.push(pid); return true; }) as typeof process.kill;
  try {
    const ctx: ActionContext = { sessionId: 'test-engine-stalled', taskId: 'test-task', repeats: new Map(), paused: false };
    const foreignPid: Finding = { code: 'engine.stalled', subjectType: 'system', subjectId: null, detail: { pid: 55555, heartbeatAgeMs: 999_999, pidAlive: false } };
    await applyFindings([foreignPid], ctx);
    assert.deepEqual(killed, [], 'pidAlive:false (chết hoặc không phải engine) thì không được SIGTERM');

    // Nếu lần trên đã tiêu mất suất rate-limit thì lần này (pid thật, còn hạn) sẽ bị chặn oan.
    const realEnginePid: Finding = { code: 'engine.stalled', subjectType: 'system', subjectId: null, detail: { pid: 55556, heartbeatAgeMs: 40_000, pidAlive: true } };
    await applyFindings([realEnginePid], ctx);
    assert.deepEqual(killed, [55556], 'engine treo thật (pidAlive:true) vẫn phải bị SIGTERM và vẫn còn nguyên hạn ngạch');
  } finally {
    process.kill = originalKill;
  }
});

test('runProbe does not create or merge a health.sweep task; runSweep still reschedules itself', async () => {
  await prisma.agentTask.deleteMany({ where: { kind: 'health.sweep' } });
  const probeTask: LeasedTask = { id: 'probe-test-1', kind: 'health.probe', subjectType: 'camera', subjectId: 'cam-probe', reason: 'đổi nguồn camera', budget: 0, attempts: 1, priority: 800, dueAt: new Date() };
  await runProbe(probeTask);
  assert.equal(await prisma.agentTask.count({ where: { kind: 'health.sweep' } }), 0, 'health.probe không được tự hẹn/gộp health.sweep');

  const sweepTask: LeasedTask = { id: 'sweep-test-1', kind: 'health.sweep', subjectType: 'system', subjectId: null, reason: 'quét định kỳ', budget: 0, attempts: 1, priority: 900, dueAt: new Date() };
  await runSweep(sweepTask);
  assert.equal(await prisma.agentTask.count({ where: { kind: 'health.sweep' } }), 1, 'health.sweep vẫn tự hẹn lần kế tiếp như cũ');
});
