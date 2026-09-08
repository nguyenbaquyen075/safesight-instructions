// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { makeEscalate } from '../tools/escalate';
import { LIMITS } from '../lib/guard';
import { AGENT_SETTINGS_ID } from '../lib/settings';
import type { ToolContext } from '../lib/tool-context';

const ctx = (): ToolContext => ({ sessionId: 's-esc', taskId: null, taskKind: 'violation.review', budget: 6, cameraId: null, spent: { calls: 0, escalations: 0, followups: 0, remembers: 0, verdicts: new Set() } });

const run = async (input: { violationId?: string; caption: string }, c: ToolContext = ctx()) =>
  JSON.parse((await makeEscalate(c).run(input)) as string);

const reviewOf = (band: string, verdict = 'violation') => JSON.stringify({ band, verdict });

test.before(async () => {
  await prisma.agentEvent.deleteMany({ where: { sessionId: 's-esc' } });
  await prisma.organization.upsert({ where: { id: 'org-esc' }, update: {}, create: { id: 'org-esc', name: 'Esc Org' } });
  await prisma.site.upsert({ where: { id: 'site-esc' }, update: {}, create: { id: 'site-esc', orgId: 'org-esc', name: 'Site Esc', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: 'cam-esc' }, update: {}, create: { id: 'cam-esc', siteId: 'site-esc', name: 'Cam Esc', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
  await prisma.violation.deleteMany({ where: { id: { in: ['v-esc-probable', 'v-esc-medium', 'v-esc-critical'] } } });
  await prisma.violation.createMany({ data: [
    { id: 'v-esc-probable', cameraId: 'cam-esc', siteId: 'site-esc', type: 'hard_hat', severity: 'medium', confidence: 0.6, bboxData: '[]', snapshotUrl: '/snapshots/a.jpg', occurrenceCount: 1, agentReview: reviewOf('PROBABLE') },
    { id: 'v-esc-medium', cameraId: 'cam-esc', siteId: 'site-esc', type: 'hard_hat', severity: 'medium', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/b.jpg', occurrenceCount: 1, agentReview: reviewOf('VERIFIED') },
    { id: 'v-esc-critical', cameraId: 'cam-esc', siteId: 'site-esc', type: 'hard_hat', severity: 'critical', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/c.jpg', occurrenceCount: 1, agentReview: reviewOf('VERIFIED') },
  ] });
});

test('a PROBABLE (not VERIFIED) review blocks escalation', async () => {
  const out = await run({ violationId: 'v-esc-probable', caption: 'Cam Esc: mũ bảo hộ, lần 1, cần nhắc nhở.' });
  assert.equal(out.sent, false);
  assert.match(out.blockedReason, /VERIFIED/);
});

test('VERIFIED but occurrenceCount 1 and severity medium is not serious enough', async () => {
  const out = await run({ violationId: 'v-esc-medium', caption: 'Cam Esc: mũ bảo hộ, lần 1, cần nhắc nhở.' });
  assert.equal(out.sent, false);
});

test('VERIFIED + critical passes the gate; no Telegram configured so nothing sends, but the attempt is spent', async () => {
  const c = ctx();
  const out = await run({ violationId: 'v-esc-critical', caption: 'Cam Esc: mũ bảo hộ nghiêm trọng, cần xử lý ngay.' }, c);
  assert.equal(out.sent, false);
  assert.match(out.blockedReason, /AlertRule|cooldown|Telegram/);
  assert.equal(c.spent.escalations, 1);
});

test('escalatePerSession limit blocks further escalations without spending another attempt', async () => {
  const c = ctx();
  c.spent.escalations = LIMITS.escalatePerSession;
  const out = await run({ violationId: 'v-esc-critical', caption: 'Cam Esc: mũ bảo hộ nghiêm trọng, cần xử lý ngay.' }, c);
  assert.equal(out.sent, false);
  assert.match(out.blockedReason, /đủ số lần/);
  assert.equal(c.spent.escalations, LIMITS.escalatePerSession);
});

test('a paused agent blocks escalation', async () => {
  await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { isEnabled: false } });
  const out = await run({ violationId: 'v-esc-critical', caption: 'Cam Esc: mũ bảo hộ nghiêm trọng, cần xử lý ngay.' });
  await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { isEnabled: true } });
  assert.equal(out.sent, false);
  assert.match(out.blockedReason, /tạm dừng/);
});

test('no violationId takes the ops path: sendOpsAlert, spends an attempt, and emits escalate.ops', async () => {
  const c = ctx();
  const out = await run({ caption: 'Vận hành: camera cổng mất kết nối 10 phút.' }, c);
  assert.equal(out.sent, false); // không có TelegramSettings trong DB test
  assert.equal(c.spent.escalations, 1);
  const ev = await prisma.agentEvent.findFirst({ where: { sessionId: c.sessionId, type: 'action', subjectType: 'system' }, orderBy: { emittedAt: 'desc' } });
  assert.ok(ev);
  assert.equal(JSON.parse(ev!.data).action, 'escalate.ops');
});
