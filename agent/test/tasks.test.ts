// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { claimDue, completeTask, ensureTask, laneOf, MAX_ATTEMPTS, releaseTask, retireExhausted, scheduleTask } from '../lib/tasks';
import { ensureRecurring } from '../lib/recurring';

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

// Hai case dưới tự tạo camera/site/org riêng (tiền tố -one / -rec): dọn đúng phần của mình,
// không đụng dữ liệu của file test khác.
const OWN_CAMERAS = ['cam-one-a', 'cam-one-b', 'cam-rec-on', 'cam-rec-off'];
test.after(async () => {
  await prisma.agentTask.deleteMany({ where: { subjectId: { in: OWN_CAMERAS } } });
  await prisma.violation.deleteMany({ where: { cameraId: { in: OWN_CAMERAS } } });
  await prisma.cameraAgent.deleteMany({ where: { id: { in: OWN_CAMERAS } } });
  await prisma.camera.deleteMany({ where: { id: { in: OWN_CAMERAS } } });
  await prisma.site.deleteMany({ where: { id: { in: ['site-one', 'site-rec'] } } });
  await prisma.organization.deleteMany({ where: { id: { in: ['org-one', 'org-rec'] } } });
});

test('claimDue with onePerCamera leases at most one research task per camera', async () => {
  await prisma.organization.upsert({ where: { id: 'org-one' }, update: {}, create: { id: 'org-one', name: 'One Org' } });
  await prisma.site.upsert({ where: { id: 'site-one' }, update: {}, create: { id: 'site-one', orgId: 'org-one', name: 'Site One', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: 'cam-one-a' }, update: {}, create: { id: 'cam-one-a', siteId: 'site-one', name: 'Cam A', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.camera.upsert({ where: { id: 'cam-one-b' }, update: {}, create: { id: 'cam-one-b', siteId: 'site-one', name: 'Cam B', rtspUrl: 'video:samples1.mp4', location: 'yard', status: 'ONLINE' } });
  await prisma.violation.deleteMany({ where: { id: { in: ['v-one-a1', 'v-one-a2', 'v-one-b1'] } } });
  await prisma.violation.createMany({ data: [
    { id: 'v-one-a1', cameraId: 'cam-one-a', siteId: 'site-one', type: 'hard_hat', severity: 'critical', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/a1.jpg' },
    { id: 'v-one-a2', cameraId: 'cam-one-a', siteId: 'site-one', type: 'hard_hat', severity: 'critical', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/a2.jpg' },
    { id: 'v-one-b1', cameraId: 'cam-one-b', siteId: 'site-one', type: 'hard_hat', severity: 'critical', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/b1.jpg' },
  ] });
  const now = new Date();
  const past = new Date(now.getTime() - 1000);
  for (const id of ['v-one-a1', 'v-one-a2', 'v-one-b1']) {
    await scheduleTask({ kind: 'violation.review', subjectType: 'violation', subjectId: id, reason: 'review', dueAt: past });
  }
  const claimed = await claimDue(3, 'research', now, { onePerCamera: true });
  assert.equal(claimed.length, 2, 'hai task cùng camera thì chỉ một cái được nhận trong lượt này');
  const cameras = await Promise.all(claimed.map(async t => (await prisma.violation.findUnique({ where: { id: t.subjectId! }, select: { cameraId: true } }))!.cameraId));
  assert.deepEqual([...cameras].sort(), ['cam-one-a', 'cam-one-b']);
  const pending = await prisma.agentTask.findMany({ where: { leasedUntil: null, finishedAt: null } });
  assert.equal(pending.length, 1, 'task còn lại vẫn chờ lượt sau');
});

test('ensureRecurring queues one digest per ONLINE camera whose subagent is enabled', async () => {
  await prisma.organization.upsert({ where: { id: 'org-rec' }, update: {}, create: { id: 'org-rec', name: 'Rec Org' } });
  await prisma.site.upsert({ where: { id: 'site-rec' }, update: {}, create: { id: 'site-rec', orgId: 'org-rec', name: 'Site Rec', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: 'cam-rec-on' }, update: { status: 'ONLINE' }, create: { id: 'cam-rec-on', siteId: 'site-rec', name: 'Cam On', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.camera.upsert({ where: { id: 'cam-rec-off' }, update: { status: 'ONLINE' }, create: { id: 'cam-rec-off', siteId: 'site-rec', name: 'Cam Off', rtspUrl: 'video:samples1.mp4', location: 'yard', status: 'ONLINE' } });
  await prisma.cameraAgent.deleteMany({ where: { id: { in: ['cam-rec-on', 'cam-rec-off'] } } });
  await prisma.cameraAgent.create({ data: { id: 'cam-rec-off', isEnabled: false } });

  const now = new Date();
  await ensureRecurring(now);

  const digest = await prisma.agentTask.findFirst({ where: { kind: 'camera.digest', subjectId: 'cam-rec-on', finishedAt: null } });
  assert.ok(digest, 'camera ONLINE có subagent bật phải có task camera.digest');
  const expected = now.getTime() + 30 * 60_000;
  assert.ok(Math.abs(digest!.dueAt.getTime() - expected) < 60_000, `dueAt phải quanh now + 30 phút, nhận ${digest!.dueAt.toISOString()}`);
  assert.equal(await prisma.agentTask.count({ where: { kind: 'camera.digest', subjectId: 'cam-rec-off', finishedAt: null } }), 0, 'subagent tắt thì không tạo digest');
});
