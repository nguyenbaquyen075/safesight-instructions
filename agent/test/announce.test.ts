// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { makeAnnounce } from '../tools/announce';
import { LIMITS, resetRateLimits } from '../lib/guard';
import { AGENT_SETTINGS_ID } from '../lib/settings';
import type { ToolContext } from '../lib/tool-context';
import { ANNOUNCE_MAX, announcementFor } from '@/lib/announce-shape';

const ORG = 'org-ann-t';
const SITE = 'site-ann-t';
const CAM = 'cam-ann-t';
const OTHER_CAM = 'cam-ann-t2';
const SESSION = 's-announce';
const VERIFIED = 'v-ann-verified';
const PROBABLE = 'v-ann-probable';

const ctx = (taskKind = 'violation.review'): ToolContext => ({
  sessionId: SESSION, taskId: null, taskKind, budget: 6, cameraId: CAM,
  spent: { calls: 0, escalations: 0, followups: 0, remembers: 0, announces: 0, verdicts: new Set() },
});

const run = async (input: { cameraId: string; text: string }, c: ToolContext) =>
  JSON.parse((await makeAnnounce(c).run(input)) as string);

const reviewOf = (band: string, verdict = 'violation') => JSON.stringify({ band, verdict, reviewedAt: new Date().toISOString() });

const TEXT = 'Khu vực cổng chính, vui lòng đội mũ bảo hộ';

// fetch giả thay cho bridge: ghi lại lời gọi để kiểm tra URL/thân yêu cầu.
let calls: Array<{ url: string; body: unknown }> = [];
const realFetch = globalThis.fetch;

test.before(async () => {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    return { ok: true, status: 200, json: async () => ({ ok: true, listeners: 2 }) };
  }) as unknown as typeof fetch;

  await prisma.agentSettings.upsert({ where: { id: AGENT_SETTINGS_ID }, update: { isEnabled: true }, create: { id: AGENT_SETTINGS_ID, isEnabled: true } });
  await prisma.organization.upsert({ where: { id: ORG }, update: {}, create: { id: ORG, name: 'Ann Org' } });
  await prisma.site.upsert({ where: { id: SITE }, update: {}, create: { id: SITE, orgId: ORG, name: 'Site Ann', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: CAM }, update: {}, create: { id: CAM, siteId: SITE, name: 'Cam Ann', rtspUrl: 'video:samples1.mp4', location: 'cổng chính', status: 'ONLINE' } });
  await prisma.camera.upsert({ where: { id: OTHER_CAM }, update: {}, create: { id: OTHER_CAM, siteId: SITE, name: 'Cam Ann 2', rtspUrl: 'video:samples1.mp4', location: 'bãi vật liệu', status: 'ONLINE' } });
  await prisma.violation.deleteMany({ where: { id: { in: [VERIFIED, PROBABLE] } } });
  await prisma.violation.createMany({ data: [
    { id: VERIFIED, cameraId: CAM, siteId: SITE, type: 'hard_hat', severity: 'high', confidence: 0.9, bboxData: '[]', snapshotUrl: '/snapshots/a.jpg', agentReview: reviewOf('VERIFIED') },
    { id: PROBABLE, cameraId: CAM, siteId: SITE, type: 'hard_hat', severity: 'high', confidence: 0.6, bboxData: '[]', snapshotUrl: '/snapshots/b.jpg', agentReview: reviewOf('PROBABLE') },
  ] });
});

test.beforeEach(async () => {
  calls = [];
  resetRateLimits();
  await prisma.agentEvent.deleteMany({ where: { sessionId: SESSION } });
});

test.after(async () => {
  globalThis.fetch = realFetch;
});

test('announcementFor maps each violation type to its Vietnamese action', () => {
  const camera = { name: 'Cam Ann', location: 'cổng chính' };
  const say = (type: string) => announcementFor({ type }, camera);
  assert.equal(say('hard_hat'), 'Khu vực cổng chính, vui lòng đội mũ bảo hộ');
  assert.equal(say('safety_vest'), 'Khu vực cổng chính, vui lòng mặc áo phản quang');
  assert.equal(say('safety_gloves'), 'Khu vực cổng chính, vui lòng đeo găng tay');
  assert.equal(say('safety_footwear'), 'Khu vực cổng chính, vui lòng mang giày bảo hộ');
  assert.equal(say('zone_intrusion'), 'Khu vực cổng chính, vui lòng rời khỏi khu vực cấm ngay');
  assert.equal(say('suspended_load'), 'Khu vực cổng chính, vui lòng rời khỏi vùng dưới tải treo ngay');
  assert.equal(say('unknown_type'), 'Khu vực cổng chính, vui lòng tuân thủ quy định an toàn');
});

test('announcementFor falls back to the camera name and caps the sentence length', () => {
  assert.equal(announcementFor({ type: 'hard_hat' }, { name: 'Cam Ann', location: null }), 'Khu vực Cam Ann, vui lòng đội mũ bảo hộ');
  const long = announcementFor({ type: 'hard_hat' }, { name: 'x'.repeat(500), location: '' });
  assert.equal(long.length, ANNOUNCE_MAX);
});

test('announce blocks a session that has not recorded a real VERIFIED verdict for the camera', async () => {
  const c = ctx();
  c.spent.verdicts.add(PROBABLE);
  const out = await run({ cameraId: CAM, text: TEXT }, c);
  assert.equal(out.ok, false);
  assert.match(out.blockedReason, /VERIFIED/);
  assert.equal(calls.length, 0);
});

test('announce blocks when the verified verdict belongs to another camera', async () => {
  const c = ctx();
  c.spent.verdicts.add(VERIFIED);
  const out = await run({ cameraId: OTHER_CAM, text: TEXT }, c);
  assert.equal(out.ok, false);
  assert.equal(calls.length, 0);
});

test('announce posts to the bridge and records an action event with the listener count', async () => {
  const c = ctx();
  c.spent.verdicts.add(VERIFIED);
  const out = await run({ cameraId: CAM, text: TEXT }, c);
  assert.equal(out.ok, true);
  assert.equal(out.listeners, 2);
  assert.equal(c.spent.announces, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/announce$/);
  assert.deepEqual(calls[0].body, { cameraId: CAM, text: TEXT });

  const events = await prisma.agentEvent.findMany({ where: { sessionId: SESSION, type: 'action' } });
  assert.equal(events.length, 1);
  const data = JSON.parse(events[0].data);
  assert.equal(data.action, 'announce');
  assert.equal(data.cameraId, CAM);
  assert.equal(data.listeners, 2);
});

test('announce is on cooldown for the same camera within 60 seconds', async () => {
  const c = ctx();
  c.spent.verdicts.add(VERIFIED);
  assert.equal((await run({ cameraId: CAM, text: TEXT }, c)).ok, true);
  const again = await run({ cameraId: CAM, text: TEXT }, c);
  assert.equal(again.ok, false);
  assert.match(again.blockedReason, /60 giây|chờ/);
  assert.equal(calls.length, 1);
});

test('announcePerSession limit blocks further announcements', async () => {
  const c = ctx();
  c.spent.verdicts.add(VERIFIED);
  c.spent.announces = LIMITS.announcePerSession;
  const out = await run({ cameraId: CAM, text: TEXT }, c);
  assert.equal(out.ok, false);
  assert.match(out.blockedReason, /đủ số lần/);
  assert.equal(calls.length, 0);
});

test('outside a review session the camera needs a recent VERIFIED review in the database', async () => {
  const allowed = await run({ cameraId: CAM, text: TEXT }, ctx('camera.instruction'));
  assert.equal(allowed.ok, true);

  const blocked = await run({ cameraId: OTHER_CAM, text: TEXT }, ctx('ask'));
  assert.equal(blocked.ok, false);
  assert.match(blocked.blockedReason, /VERIFIED/);
});

test('a paused agent blocks the loudspeaker', async () => {
  await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { isEnabled: false } });
  const c = ctx();
  c.spent.verdicts.add(VERIFIED);
  const out = await run({ cameraId: CAM, text: TEXT }, c);
  await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { isEnabled: true } });
  assert.equal(out.ok, false);
  assert.match(out.blockedReason, /tạm dừng/);
  assert.equal(calls.length, 0);
});
