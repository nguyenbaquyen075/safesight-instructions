// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/db';
import { runSession, mapError, SessionError, type SessionClient } from '../session';

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
