// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { makeRememberCamera } from '../tools/remember_camera';
import { getCameraAgent, parseMemory } from '../lib/camera-agent';
import { LIMITS } from '../lib/guard';
import type { ToolContext } from '../lib/tool-context';

const CAM = 'cam-rem-t';
const SESSION = 's-remember';

const ctx = (cameraId: string | null = CAM): ToolContext => ({
  sessionId: SESSION, taskId: null, taskKind: 'camera.digest', budget: 6, cameraId,
  spent: { calls: 0, escalations: 0, followups: 0, remembers: 0, announces: 0, verdicts: new Set() },
});

const run = async (input: { text: string; replaceIndex?: number }, c: ToolContext) =>
  JSON.parse((await makeRememberCamera(c).run(input)) as string);

test.before(async () => {
  await prisma.organization.upsert({ where: { id: 'org-rem-t' }, update: {}, create: { id: 'org-rem-t', name: 'Rem Org' } });
  await prisma.site.upsert({ where: { id: 'site-rem-t' }, update: {}, create: { id: 'site-rem-t', orgId: 'org-rem-t', name: 'Site Rem', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: CAM }, update: {}, create: { id: CAM, siteId: 'site-rem-t', name: 'Cam Rem', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
});
test.beforeEach(async () => {
  await prisma.cameraAgent.deleteMany({ where: { id: CAM } });
  await prisma.agentEvent.deleteMany({ where: { sessionId: SESSION } });
});

test('remember_camera writes notes, logs an action event and stops after the per-session limit', async () => {
  const c = ctx();
  for (let i = 0; i < LIMITS.rememberPerSession; i++) {
    const ok = await run({ text: `ghi chú bền số ${i}` }, c);
    assert.equal(ok.ok, true);
    assert.equal(ok.total, i + 1);
  }
  const blocked = await run({ text: 'ghi chú bền thứ tư' }, c);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.blockedReason);

  const notes = parseMemory((await getCameraAgent(CAM)).memory);
  assert.equal(notes.length, LIMITS.rememberPerSession);
  assert.equal(notes[0].text, 'ghi chú bền số 0');

  const events = await prisma.agentEvent.findMany({ where: { sessionId: SESSION, type: 'action' } });
  assert.equal(events.length, LIMITS.rememberPerSession);
  assert.equal(JSON.parse(events[0].data).action, 'remember_camera');
});

test('remember_camera refuses a session that does not belong to a camera', async () => {
  const out = await run({ text: 'ghi chú không thuộc camera nào' }, ctx(null));
  assert.equal(out.ok, false);
  assert.match(out.blockedReason, /camera/);
});
