// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { addCameraTokens, cameraIdOf, getCameraAgent, hasActivitySince, localDay, parseMemory, pushMemory, rememberCamera, MEMORY_MAX } from '../lib/camera-agent';

const CAM = 'cam-agent-t';

test.before(async () => {
  await prisma.organization.upsert({ where: { id: 'org-agent-t' }, update: {}, create: { id: 'org-agent-t', name: 'Agent T Org' } });
  await prisma.site.upsert({ where: { id: 'site-agent-t' }, update: {}, create: { id: 'site-agent-t', orgId: 'org-agent-t', name: 'Site T', address: 'x', lat: 0, lng: 0, status: 'ACTIVE' } });
  await prisma.camera.upsert({ where: { id: CAM }, update: {}, create: { id: CAM, siteId: 'site-agent-t', name: 'Cam T', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
});
test.beforeEach(async () => {
  await prisma.cameraAgent.deleteMany({ where: { id: CAM } });
  await prisma.violation.deleteMany({ where: { cameraId: CAM } });
});

test('cameraIdOf resolves camera and violation subjects, null otherwise', async () => {
  assert.equal(await cameraIdOf({ subjectType: 'camera', subjectId: CAM }), CAM);
  const v = await prisma.violation.create({ data: { cameraId: CAM, siteId: 'site-agent-t', type: 'hard_hat', severity: 'critical', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/x.jpg' } });
  assert.equal(await cameraIdOf({ subjectType: 'violation', subjectId: v.id }), CAM);
  assert.equal(await cameraIdOf({ subjectType: 'system', subjectId: null }), null);
  assert.equal(await cameraIdOf({ subjectType: 'violation', subjectId: 'missing' }), null);
});

test('getCameraAgent creates the row lazily and resets usage on a new day', async () => {
  const a = await getCameraAgent(CAM, new Date('2026-09-08T10:00:00'));
  assert.equal(a.isEnabled, true);
  assert.equal(a.usageDay, localDay(new Date('2026-09-08T10:00:00')));
  await addCameraTokens(CAM, 500, new Date('2026-09-08T10:05:00'));
  assert.equal((await getCameraAgent(CAM, new Date('2026-09-08T11:00:00'))).tokensUsedToday, 500);
  assert.equal((await getCameraAgent(CAM, new Date('2026-09-09T00:01:00'))).tokensUsedToday, 0);
});

test('pushMemory caps at 20 notes and 300 chars, replaceIndex edits in place', () => {
  let notes = [] as ReturnType<typeof parseMemory>;
  for (let i = 0; i < MEMORY_MAX + 3; i++) notes = pushMemory(notes, { at: 'a', text: `n${i}`, sessionId: 's' });
  assert.equal(notes.length, MEMORY_MAX);
  assert.equal(notes[0].text, 'n3');
  notes = pushMemory(notes, { at: 'b', text: 'x'.repeat(400), sessionId: 's' }, 0);
  assert.equal(notes[0].text.length, 300);
  assert.equal(notes.length, MEMORY_MAX);
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
