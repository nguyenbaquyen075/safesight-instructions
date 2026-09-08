// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { applyVerdict } from '../tools/record_verdict';
import { AGENT_SETTINGS_ID } from '../lib/settings';
import type { ToolContext } from '../lib/tool-context';

const ctx = (): ToolContext => ({ sessionId: 's-test', taskId: null, taskKind: 'violation.review', budget: 6, cameraId: null, spent: { calls: 0, escalations: 0, followups: 0, remembers: 0, verdicts: new Set() } });

test.before(async () => {
  // Tự tạo dữ liệu, không phụ thuộc file test khác (mỗi file test chạy trong tiến trình riêng).
  await prisma.organization.upsert({ where: { id: 'org-t' }, update: {}, create: { id: 'org-t', name: 'T' } });
  await prisma.site.upsert({ where: { id: 'site-t' }, update: {}, create: { id: 'site-t', orgId: 'org-t', name: 'Site T', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: 'cam-t' }, update: {}, create: { id: 'cam-t', siteId: 'site-t', name: 'Cam T', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.violation.deleteMany({ where: { id: { in: ['v-open', 'v-human'] } } });
  await prisma.violation.createMany({ data: [
    { id: 'v-open', cameraId: 'cam-t', siteId: 'site-t', type: 'hard_hat', severity: 'critical', confidence: 0.8, bboxData: '[]', snapshotUrl: '/snapshots/a.jpg', status: 'OPEN' },
    { id: 'v-human', cameraId: 'cam-t', siteId: 'site-t', type: 'hard_hat', severity: 'critical', confidence: 0.8, bboxData: '[]', snapshotUrl: '/snapshots/b.jpg', status: 'RESOLVED' },
  ] });
});

test('VERIFIED false positive changes status to false_positive and writes agentReview', async () => {
  const r = await applyVerdict({ violationId: 'v-open', observations: ['snapshot.no-person'], note: 'chỉ là bóng cột', ctx: ctx() });
  assert.equal(r.band, 'VERIFIED'); assert.equal(r.applied, true); assert.equal(r.statusNow, 'false_positive');
  const row = await prisma.violation.findUnique({ where: { id: 'v-open' } });
  assert.equal(JSON.parse(row!.agentReview!).verdict, 'false_positive');
});

test('PROBABLE only writes agentReview without changing status', async () => {
  await prisma.violation.update({ where: { id: 'v-open' }, data: { status: 'OPEN', agentReview: null } });
  const r = await applyVerdict({ violationId: 'v-open', observations: ['snapshot.occluded-or-backlit', 'history.camera-false-positive-prone'], note: 'ngược sáng', ctx: ctx() });
  assert.notEqual(r.band, 'VERIFIED'); assert.equal(r.applied, false);
  assert.equal((await prisma.violation.findUnique({ where: { id: 'v-open' } }))!.status, 'OPEN');
});

test('does not override a status set by a human', async () => {
  const r = await applyVerdict({ violationId: 'v-human', observations: ['snapshot.no-person'], note: 'x', ctx: ctx() });
  assert.equal(r.applied, false); assert.match(r.reason ?? '', /người/);
  assert.equal((await prisma.violation.findUnique({ where: { id: 'v-human' } }))!.status, 'RESOLVED');
});

test('each session allows only one verdict per violation', async () => {
  const c = ctx();
  await applyVerdict({ violationId: 'v-open', observations: ['snapshot.ppe-visible'], note: 'a', ctx: c });
  const r = await applyVerdict({ violationId: 'v-open', observations: ['snapshot.ppe-visible'], note: 'b', ctx: c });
  assert.equal(r.applied, false); assert.match(r.reason ?? '', /đã phán quyết/);
});

test('applyVerdict is blocked when the agent is paused and does not mark a verdict as recorded', async () => {
  await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { isEnabled: false } });
  const c = ctx();
  const r = await applyVerdict({ violationId: 'v-open', observations: ['snapshot.no-person'], note: 'tạm dừng', ctx: c });
  await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { isEnabled: true } });
  assert.equal(r.applied, false); assert.match(r.reason ?? '', /tạm dừng/);
  assert.equal(c.spent.verdicts.has('v-open'), false);
});
