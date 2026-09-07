// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { systemBlocks } from '../lib/prompt';
import { toolsFor } from '../lib/toolsets';
import { preambleFor } from '../lib/preamble';
import type { ToolContext } from '../lib/tool-context';
import { prisma } from '../lib/db';

const ctx: ToolContext = { sessionId: 's', taskId: null, taskKind: 'violation.review', budget: 6, spent: { calls: 0, escalations: 0, followups: 0, verdicts: new Set() } };

test('systemBlocks has instructions plus 4 skills, cache_control on the last block, stable content', async () => {
  const a = await systemBlocks(); const b = await systemBlocks();
  assert.equal(a.length, 2); assert.ok(a[1].cache_control); assert.equal(a[1].text, b[1].text);
  for (const name of ['evidence.md', 'ppe-review.md', 'escalation.md', 'data-boundaries.md']) assert.ok(a[1].text.includes(`skill: ${name}`));
});

test('toolsFor: review includes record_verdict, digest does not; ask includes everything', () => {
  const names = (k: string) => toolsFor(k, ctx).map(t => t.name);
  assert.ok(names('violation.review').includes('record_verdict'));
  assert.ok(!names('camera.digest').includes('record_verdict'));
  assert.ok(names('ask').includes('read_agent_activity'));
});

test('preambleFor states the budget, reason, and the user question', async () => {
  const text = await preambleFor({ id: 't', kind: 'ask', subjectType: 'system', subjectId: null, reason: 'hỏi', budget: 6, attempts: 1, priority: 500, dueAt: new Date() }, { userMessage: 'cam-003 hôm nay có gì?' });
  assert.match(text, /Ngân sách: 6/); assert.match(text, /cam-003 hôm nay có gì/); assert.match(text, /HỘI THOẠI/);
});

test('preambleFor(ask) loads thread history oldest to newest and excludes the current question', async () => {
  const sessionId = 'sess-preamble-history';
  await prisma.agentEvent.deleteMany({ where: { sessionId } });
  const mk = (type: 'message.user' | 'message.assistant', text: string, msAgo: number) =>
    prisma.agentEvent.create({ data: { sessionId, type, data: JSON.stringify({ text }), emittedAt: new Date(Date.now() - msAgo) } });
  await mk('message.user', 'câu hỏi một', 3000);
  await mk('message.assistant', 'trả lời một', 2000);
  await mk('message.user', 'câu hỏi hai (hiện tại)', 1000);
  const task = { id: 't', kind: 'ask', subjectType: 'system', subjectId: null, reason: 'hỏi', budget: 6, attempts: 1, priority: 500, dueAt: new Date() };
  const text = await preambleFor(task, { userMessage: 'câu hỏi hai (hiện tại)', sessionId });
  const history = text.split('## Đã trao đổi trước đó')[1].split('## Câu hỏi của người dùng')[0];
  assert.match(history, /Người dùng: câu hỏi một/);
  assert.match(history, /Agent: trả lời một/);
  assert.ok(!history.includes('câu hỏi hai'), 'câu hỏi hiện tại không được lặp trong lịch sử');
  assert.ok(history.indexOf('câu hỏi một') < history.indexOf('trả lời một'), 'thứ tự cũ → mới');
});
