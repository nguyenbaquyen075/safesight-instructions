// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { claimDue, completeTask, ensureTask, laneOf, MAX_ATTEMPTS, releaseTask, retireExhausted, scheduleTask } from '../lib/tasks';

test.beforeEach(async () => { await prisma.agentTask.deleteMany(); });

test('laneOf splits into the correct two lanes', () => {
  assert.equal(laneOf('health.sweep'), 'direct');
  assert.equal(laneOf('violation.review'), 'research');
});

test('scheduleTask merges a duplicate unfinished task for the same kind and subject', async () => {
  const past = new Date(Date.now() - 1000);
  const a = await scheduleTask({ kind: 'violation.review', subjectType: 'violation', subjectId: 'v1', reason: 'lần 1', dueAt: past });
  const b = await scheduleTask({ kind: 'violation.review', subjectType: 'violation', subjectId: 'v1', reason: 'lần 2', dueAt: past });
  assert.equal(a.id, b.id);
  assert.equal(b.merged, true);
  const row = await prisma.agentTask.findUnique({ where: { id: a.id } });
  assert.equal(row?.reason, 'lần 2');
});

test('claimDue only takes tasks from the right lane, higher priority first, and locks the lease', async () => {
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

test('claimDue orders equal-priority tasks by earlier dueAt first', async () => {
  const older = new Date(Date.now() - 60_000);
  const newer = new Date(Date.now() - 1_000);
  await scheduleTask({ kind: 'followup', subjectType: 'camera', subjectId: 'cam-late', reason: 'muộn', dueAt: newer, priority: 0 });
  await scheduleTask({ kind: 'followup', subjectType: 'camera', subjectId: 'cam-early', reason: 'sớm', dueAt: older, priority: 0 });
  const claimed = await claimDue(10, 'research');
  assert.deepEqual(claimed.map(t => t.subjectId), ['cam-early', 'cam-late']);
});

test('releaseTask pushes back dueAt and clears the lease; completeTask closes the task', async () => {
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

test('releaseTask with refundAttempt returns the attempt spent on claim', async () => {
  const past = new Date(Date.now() - 1000);
  const { id } = await scheduleTask({ kind: 'ask', subjectType: 'system', reason: 'q', dueAt: past });
  const before = (await prisma.agentTask.findUnique({ where: { id } }))!.attempts;
  const [claimed] = await claimDue(1, 'research');
  assert.equal(claimed.attempts, before + 1);
  await releaseTask(id, 1000, 'đã chạm trần token trong ngày', { refundAttempt: true });
  const row = await prisma.agentTask.findUnique({ where: { id } });
  assert.equal(row?.attempts, before, 'trần token không được tiêu lần thử của task');
});

test('scheduleTask with excludeId does not merge into a running task', async () => {
  const past = new Date(Date.now() - 1000);
  const { id: running } = await scheduleTask({ kind: 'health.sweep', subjectType: 'system', reason: 'sweep', dueAt: past });
  await claimDue(1, 'direct');
  const next = await scheduleTask({ kind: 'health.sweep', subjectType: 'system', reason: 'sweep tiếp', dueAt: new Date(Date.now() + 60_000) }, { excludeId: running });
  assert.notEqual(next.id, running); assert.equal(next.merged, false);
  await completeTask(running, 'xong');
  const pending = await prisma.agentTask.findMany({ where: { kind: 'health.sweep', finishedAt: null } });
  assert.equal(pending.length, 1); assert.equal(pending[0].id, next.id);
});

test('scheduleTask does not merge into a running task even without excludeId', async () => {
  const past = new Date(Date.now() - 1000);
  const { id: running } = await scheduleTask({ kind: 'followup', subjectType: 'camera', subjectId: 'cam-x', reason: 'lần 1', dueAt: past });
  const [claimed] = await claimDue(1, 'research');
  assert.equal(claimed.id, running);
  const next = await scheduleTask({ kind: 'followup', subjectType: 'camera', subjectId: 'cam-x', reason: 'lần 2', dueAt: new Date(Date.now() + 60_000) });
  assert.equal(next.merged, false); assert.notEqual(next.id, running);
  await completeTask(running, 'xong');
  const pending = await prisma.agentTask.findMany({ where: { kind: 'followup', finishedAt: null } });
  assert.equal(pending.length, 1); assert.equal(pending[0].id, next.id);
});

test('ensureTask leaves dueAt unchanged for a pending task and creates a new one when none exists', async () => {
  const later = new Date(Date.now() + 60_000);
  const a = await ensureTask({ kind: 'shift.report', subjectType: 'system', reason: 'ca', dueAt: later });
  assert.equal(a.created, true);
  const b = await ensureTask({ kind: 'shift.report', subjectType: 'system', reason: 'ca lại', dueAt: new Date() });
  assert.equal(b.created, false); assert.equal(b.id, a.id);
  const row = await prisma.agentTask.findUnique({ where: { id: a.id } });
  assert.equal(row!.dueAt.getTime(), later.getTime()); assert.equal(row!.reason, 'ca');
});

test('retireExhausted closes tasks that exceed MAX_ATTEMPTS', async () => {
  const past = new Date(Date.now() - 1000);
  const { id } = await scheduleTask({ kind: 'ask', subjectType: 'system', reason: 'q', dueAt: past });
  await prisma.agentTask.update({ where: { id }, data: { attempts: MAX_ATTEMPTS } });
  assert.equal(await retireExhausted(), 1);
  const row = await prisma.agentTask.findUnique({ where: { id } });
  assert.ok(row?.finishedAt);
  assert.match(row!.outcome ?? '', /3 lần/);
});
