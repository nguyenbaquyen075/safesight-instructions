// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/db';
import { runSession, mapError, SessionError, type SessionClient } from '../session';
import { AGENT_SETTINGS_ID } from '../lib/settings';

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
