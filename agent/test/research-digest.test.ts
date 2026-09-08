// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { runResearch } from '../research/index';
import { getCameraAgent, localDay } from '../lib/camera-agent';
import type { SessionClient } from '../session';
import type { LeasedTask } from '../lib/tasks';

const CAM = 'cam-dig-t';
const task: LeasedTask = { id: 'task-dig-t', kind: 'camera.digest', subjectType: 'camera', subjectId: CAM, reason: 'tổng hợp', budget: 6, attempts: 1, priority: 50, dueAt: new Date() };

const fakeClient = (): SessionClient => ({
  async *run() { yield { content: [{ type: 'text', text: 'Camera có vi phạm mới.' }], usage: { input_tokens: 100, output_tokens: 10 }, stop_reason: 'end_turn' }; },
});

test.before(async () => {
  await prisma.organization.upsert({ where: { id: 'org-dig-t' }, update: {}, create: { id: 'org-dig-t', name: 'Dig Org' } });
  await prisma.site.upsert({ where: { id: 'site-dig-t' }, update: {}, create: { id: 'site-dig-t', orgId: 'org-dig-t', name: 'Site Dig', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: CAM }, update: {}, create: { id: CAM, siteId: 'site-dig-t', name: 'Cam Dig', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
});
test.beforeEach(async () => {
  await prisma.violation.deleteMany({ where: { cameraId: CAM } });
  await prisma.agentEvent.deleteMany({ where: { taskId: task.id } });
  await prisma.cameraAgent.deleteMany({ where: { id: CAM } });
  // Mốc cũ hơn hiện tại để khẳng định lastDigestAt được đẩy lên THỰC SỰ (không phải bằng nhau).
  await prisma.cameraAgent.create({ data: { id: CAM, usageDay: localDay(), lastDigestAt: new Date(Date.now() - 60_000) } });
});

test('a digest with no activity since the last one finishes without opening a session', async () => {
  const before = (await getCameraAgent(CAM)).lastDigestAt!;
  const outcome = await runResearch(task, { client: fakeClient() });
  assert.match(outcome, /không có hoạt động/);
  const after = (await getCameraAgent(CAM)).lastDigestAt!;
  assert.ok(after.getTime() > before.getTime(), 'lastDigestAt phải được đẩy lên mốc mới');
  assert.equal(await prisma.agentEvent.count({ where: { taskId: task.id, type: 'session.started' } }), 0);
  const skipped = await prisma.agentEvent.findFirst({ where: { taskId: task.id, type: 'action' } });
  assert.equal(JSON.parse(skipped!.data).action, 'camera.digest.skipped');
});

test('a digest with a new violation runs a session and moves lastDigestAt forward', async () => {
  const before = (await getCameraAgent(CAM)).lastDigestAt!;
  await prisma.violation.create({ data: { cameraId: CAM, siteId: 'site-dig-t', type: 'hard_hat', severity: 'critical', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/dig.jpg', detectedAt: new Date(before.getTime() + 1000) } });
  const outcome = await runResearch(task, { client: fakeClient() });
  assert.equal(outcome, 'Camera có vi phạm mới.');
  assert.equal(await prisma.agentEvent.count({ where: { taskId: task.id, type: 'session.started' } }), 1);
  assert.ok((await getCameraAgent(CAM)).lastDigestAt!.getTime() > before.getTime());
  await prisma.agentEvent.deleteMany({ where: { taskId: task.id } });
});
