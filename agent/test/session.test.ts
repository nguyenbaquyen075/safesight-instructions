// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/db';
import { runSession, mapError, SessionError, type SessionClient } from '../session';
import { AGENT_SETTINGS_ID } from '../lib/settings';
import { preambleFor } from '../lib/preamble';
import { getCameraAgent, localDay } from '../lib/camera-agent';

const task = { id: 'task-s', kind: 'ask' as const, subjectType: 'system', subjectId: null, reason: 'hỏi', budget: 6, attempts: 1, priority: 500, dueAt: new Date() };

test.before(async () => { await prisma.agentEvent.deleteMany({ where: { sessionId: { in: ['sess-fake', 'sess-ref'] } } }); });

test('runSession logs session.started/ended, totals usage, and returns the final text', async () => {
  const fake: SessionClient = {
    async *run(params) {
      assert.ok(Array.isArray(params.tools) && params.tools.length > 0);
      yield { content: [{ type: 'text', text: 'Hôm nay yên ắng.' }], usage: { input_tokens: 1200, output_tokens: 40, cache_read_input_tokens: 1000 }, stop_reason: 'end_turn' };
    },
  };
  const text = await runSession(task, { userMessage: 'hôm nay có gì?', client: fake, sessionId: 'sess-fake' });
  assert.equal(text, 'Hôm nay yên ắng.');
  const types = (await prisma.agentEvent.findMany({ where: { sessionId: 'sess-fake' }, orderBy: { emittedAt: 'asc' } })).map(e => e.type);
  assert.ok(types.includes('session.started') && types.includes('session.ended') && types.includes('message.assistant'));
  const ended = await prisma.agentEvent.findFirst({ where: { sessionId: 'sess-fake', type: 'session.ended' } });
  assert.equal(JSON.parse(ended!.data).usage.output_tokens, 40);
});

test('a refusal yields an explicit outcome without throwing', async () => {
  const fake: SessionClient = { async *run() { yield { content: [], usage: { input_tokens: 10, output_tokens: 0 }, stop_reason: 'refusal' }; } };
  const text = await runSession(task, { client: fake, sessionId: 'sess-ref' });
  assert.match(text, /từ chối/);
});

test('daily token cap: emits session.ended (skipped) before throwing, and never calls the client', async () => {
  const sessionId = 'sess-cap';
  await prisma.agentEvent.deleteMany({ where: { sessionId: { in: [sessionId, 'sess-cap-seed'] } } });
  const before = await prisma.agentSettings.upsert({ where: { id: AGENT_SETTINGS_ID }, update: {}, create: { id: AGENT_SETTINGS_ID } });
  try {
    // Seed một session.ended hôm nay tiêu 1000 token, rồi hạ trần xuống dưới mức đó để chạm trần ngay.
    await prisma.agentEvent.create({ data: { sessionId: 'sess-cap-seed', type: 'session.ended', data: JSON.stringify({ usage: { input_tokens: 1000, output_tokens: 0 } }) } });
    await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { dailyTokenCap: 500 } });
    let called = false;
    const fake: SessionClient = { async *run() { called = true; yield { content: [], usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'end_turn' }; } };
    await assert.rejects(
      () => runSession(task, { client: fake, sessionId }),
      (err: unknown) => err instanceof SessionError && err.refundAttempt === true,
    );
    assert.equal(called, false);
    const ended = await prisma.agentEvent.findFirst({ where: { sessionId, type: 'session.ended' } });
    assert.ok(ended, 'session.ended phải tồn tại để panel hỏi-đáp dừng poll');
    assert.equal(JSON.parse(ended!.data).stop, 'skipped');
  } finally {
    await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { dailyTokenCap: before.dailyTokenCap } });
    await prisma.agentEvent.deleteMany({ where: { sessionId: { in: [sessionId, 'sess-cap-seed'] } } });
  }
});

const CAM = 'cam-sess-t';
const cameraTask = { id: 'task-cam-s', kind: 'camera.digest' as const, subjectType: 'camera', subjectId: CAM, reason: 'tổng hợp', budget: 6, attempts: 1, priority: 50, dueAt: new Date() };

async function seedCamera(): Promise<void> {
  await prisma.organization.upsert({ where: { id: 'org-sess-t' }, update: {}, create: { id: 'org-sess-t', name: 'Sess Org' } });
  await prisma.site.upsert({ where: { id: 'site-sess-t' }, update: {}, create: { id: 'site-sess-t', orgId: 'org-sess-t', name: 'Site Sess', address: 'x', lat: 0, lng: 0 } });
  await prisma.camera.upsert({ where: { id: CAM }, update: {}, create: { id: CAM, siteId: 'site-sess-t', name: 'Cam Sess', rtspUrl: 'video:samples1.mp4', location: 'gate', status: 'ONLINE' } });
}

test('a disabled camera subagent skips the session without calling the client', async () => {
  await seedCamera();
  await prisma.agentEvent.deleteMany({ where: { sessionId: 'sess-cam-off' } });
  await prisma.cameraAgent.upsert({ where: { id: CAM }, update: { isEnabled: false }, create: { id: CAM, isEnabled: false, usageDay: localDay() } });
  let called = false;
  const fake: SessionClient = { async *run() { called = true; yield { content: [], usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'end_turn' }; } };
  const text = await runSession(cameraTask, { client: fake, sessionId: 'sess-cam-off' });
  assert.match(text, /đang tắt/);
  assert.equal(called, false);
  const ended = await prisma.agentEvent.findFirst({ where: { sessionId: 'sess-cam-off', type: 'session.ended' } });
  assert.equal(JSON.parse(ended!.data).stop, 'skipped');
  await prisma.agentEvent.deleteMany({ where: { sessionId: 'sess-cam-off' } });
});

test('a camera that hit its own daily token cap throws a refundable SessionError', async () => {
  await seedCamera();
  await prisma.agentEvent.deleteMany({ where: { sessionId: 'sess-cam-cap' } });
  await prisma.cameraAgent.upsert({
    where: { id: CAM },
    update: { isEnabled: true, dailyTokenCap: 100, tokensUsedToday: 100, usageDay: localDay() },
    create: { id: CAM, dailyTokenCap: 100, tokensUsedToday: 100, usageDay: localDay() },
  });
  let called = false;
  const fake: SessionClient = { async *run() { called = true; yield { content: [], usage: { input_tokens: 0, output_tokens: 0 }, stop_reason: 'end_turn' }; } };
  await assert.rejects(
    () => runSession(cameraTask, { client: fake, sessionId: 'sess-cam-cap' }),
    (err: unknown) => err instanceof SessionError && err.refundAttempt === true,
  );
  assert.equal(called, false);
  const ended = await prisma.agentEvent.findFirst({ where: { sessionId: 'sess-cam-cap', type: 'session.ended' } });
  assert.equal(JSON.parse(ended!.data).stop, 'skipped');
  await prisma.agentEvent.deleteMany({ where: { sessionId: 'sess-cam-cap' } });
});

test('a camera session records its cameraId and adds the tokens it spent to the camera', async () => {
  await seedCamera();
  await prisma.agentEvent.deleteMany({ where: { sessionId: 'sess-cam-ok' } });
  await prisma.cameraAgent.upsert({
    where: { id: CAM },
    update: { isEnabled: true, dailyTokenCap: 300000, tokensUsedToday: 0, usageDay: localDay() },
    create: { id: CAM, usageDay: localDay() },
  });
  const fake: SessionClient = {
    async *run() { yield { content: [{ type: 'text', text: 'Camera ổn.' }], usage: { input_tokens: 1200, output_tokens: 40 }, stop_reason: 'end_turn' }; },
  };
  const text = await runSession(cameraTask, { client: fake, sessionId: 'sess-cam-ok' });
  assert.equal(text, 'Camera ổn.');
  const started = await prisma.agentEvent.findFirst({ where: { sessionId: 'sess-cam-ok', type: 'session.started' } });
  assert.equal(JSON.parse(started!.data).cameraId, CAM);
  assert.equal((await getCameraAgent(CAM)).tokensUsedToday, 1240);
  await prisma.agentEvent.deleteMany({ where: { sessionId: 'sess-cam-ok' } });
  await prisma.cameraAgent.deleteMany({ where: { id: CAM } });
});

test('preambleFor lists the camera memory when the session belongs to a camera', async () => {
  await seedCamera();
  const memory = [
    { at: '2026-09-01T08:00:00.000Z', text: 'Ngược sáng 16-17h ở cổng chính', sessionId: 's1' },
    { at: '2026-09-02T08:00:00.000Z', text: 'Góc máy cắt mất nửa thân người ở mép trái', sessionId: 's2' },
  ];
  const text = await preambleFor(cameraTask, { cameraId: CAM, memory });
  assert.match(text, /## Trí nhớ camera/);
  assert.match(text, /subagent/);
  for (const note of memory) assert.ok(text.includes(note.text), `preamble phải chứa ghi chú: ${note.text}`);
  const empty = await preambleFor(cameraTask, { cameraId: CAM, memory: [] });
  assert.match(empty, /chưa có ghi chú/);
});

// Giữ ở CUỐI file: case 401 gọi latchClaudeOff() — tắt Claude cho cả tiến trình test, mọi runSession sau đó bị bỏ qua.
test('mapError: 429 retries after 60s, network errors after 30s, 401/400 are fatal, other errors after 30s', () => {
  const h = new Headers();
  assert.deepEqual([mapError(new Anthropic.RateLimitError(429, undefined, 'limit', h)).retryAfterMs, false], [60_000, false]);
  const conn = mapError(new Anthropic.APIConnectionError({ message: 'mạng' }));
  assert.equal(conn.retryAfterMs, 30_000); assert.equal(conn.fatal, false);
  assert.equal(mapError(new Anthropic.AuthenticationError(401, undefined, 'key', h)).fatal, true);
  assert.equal(mapError(new Anthropic.BadRequestError(400, undefined, 'bad', h)).fatal, true);
  const generic = mapError(new Error('lạ'));
  assert.ok(generic instanceof SessionError); assert.equal(generic.retryAfterMs, 30_000);
});
