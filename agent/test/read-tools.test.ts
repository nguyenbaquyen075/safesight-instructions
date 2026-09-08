// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { violationFacts } from '../tools/read_violation';
import { cameraHistory } from '../tools/read_camera_history';
import { siteContext } from '../tools/read_site_context';
import { searchViolations } from '../tools/search_violations';
import { safeRun } from '../lib/tool-context';

test.before(async () => {
  await prisma.violation.deleteMany(); await prisma.camera.deleteMany(); await prisma.site.deleteMany(); await prisma.organization.deleteMany();
  await prisma.organization.create({ data: { id: 'org-t', name: 'T' } });
  await prisma.site.create({ data: { id: 'site-t', orgId: 'org-t', name: 'Site T', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.create({ data: { id: 'cam-t', siteId: 'site-t', name: 'Cam T', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.violation.createMany({ data: [
    { id: 'v-a', cameraId: 'cam-t', siteId: 'site-t', type: 'hard_hat', severity: 'critical', confidence: 0.8, bboxData: '[]', snapshotUrl: '/snapshots/violation_x.jpg', clipUrl: '/snapshots/clip_x.mp4', status: 'OPEN', occurrenceCount: 2 },
    { id: 'v-b', cameraId: 'cam-t', siteId: 'site-t', type: 'safety_gloves', severity: 'medium', confidence: 0.7, bboxData: '[]', snapshotUrl: '/snapshots/violation_y.jpg', status: 'FALSE_POSITIVE' },
  ] });
});

test('violationFacts returns neighboring ids and a lowercase status', async () => {
  const f = await violationFacts('v-a');
  assert.equal(f?.cameraId, 'cam-t'); assert.equal(f?.siteId, 'site-t'); assert.equal(f?.status, 'open'); assert.equal(f?.occurrenceCount, 2);
  assert.equal(await violationFacts('nope'), null);
});

// Agent không xem được video (chưa có ffmpeg) nhưng phải biết clip tồn tại để nhắc người quản lý mở modal.
test('violationFacts exposes the evidence clip url, or null when the violation has none', async () => {
  assert.equal((await violationFacts('v-a'))?.clipUrl, '/snapshots/clip_x.mp4');
  assert.equal((await violationFacts('v-b'))?.clipUrl, null);
});

test('cameraHistory computes the false-positive rate and returns siteId', async () => {
  const h = await cameraHistory('cam-t', 24);
  assert.equal(h?.total, 2); assert.equal(h?.falsePositive, 1); assert.equal(h?.falsePositiveRate, 0.5); assert.equal(h?.siteId, 'site-t');
});

test('siteContext lists cameras with their id; searchViolations filters by status', async () => {
  const s = await siteContext('site-t');
  assert.deepEqual(s?.cameras.map(c => c.id), ['cam-t']);
  const r = await searchViolations({ siteId: 'site-t', status: 'false_positive', limit: 10 });
  assert.deepEqual(r.map(x => x.id), ['v-b']);
});

test('safeRun turns an unexpected error into JSON {error} and logs an error event without throwing', async () => {
  const ctx = { sessionId: 's-saferun', taskId: null, taskKind: 'ask', budget: 6, cameraId: null, spent: { calls: 0, escalations: 0, followups: 0, remembers: 0, announces: 0, verdicts: new Set<string>() } };
  const out = await safeRun(ctx, 'read_violation', async () => { throw new Error('DB rớt'); });
  assert.match(String(out), /DB rớt/);
  const ev = await prisma.agentEvent.findFirst({ where: { sessionId: 's-saferun', type: 'error' } });
  assert.ok(ev && JSON.parse(ev.data).tool === 'read_violation');
  assert.equal(await safeRun(ctx, 'x', async () => 'ok'), 'ok');
});
