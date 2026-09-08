// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { enqueueAgentTask } from '@/lib/agent-bridge';

// kind riêng cho file này: agent/test/tasks.test.ts xoá sạch bảng AgentTask trong beforeEach của nó,
// nhưng file đó chạy sau (thứ tự bảng chữ cái agent-bridge < tasks) nên không đụng vào các dòng ở đây.
const KIND = 'test.bridge';

test.before(async () => { await prisma.agentTask.deleteMany({ where: { kind: KIND } }); });

test('a matching unfinished, unleased task is merged: same id, reason/dueAt updated', async () => {
  const dueAt1 = new Date(Date.now() - 1000);
  const id1 = await enqueueAgentTask({ kind: KIND, subjectType: 'camera', subjectId: 'cam-merge', reason: 'lần 1', priority: 0, dueAt: dueAt1 });
  const dueAt2 = new Date(Date.now() + 5000);
  const id2 = await enqueueAgentTask({ kind: KIND, subjectType: 'camera', subjectId: 'cam-merge', reason: 'lần 2', priority: 0, dueAt: dueAt2 });
  assert.equal(id2, id1);
  const row = await prisma.agentTask.findUnique({ where: { id: id1 } });
  assert.equal(row?.reason, 'lần 2');
  assert.equal(row?.dueAt.getTime(), dueAt2.getTime());
});

test('a matching task currently leased is not merged: a new row is created', async () => {
  const id1 = await enqueueAgentTask({ kind: KIND, subjectType: 'camera', subjectId: 'cam-leased', reason: 'đang chạy', priority: 0, dueAt: new Date(Date.now() - 1000) });
  await prisma.agentTask.update({ where: { id: id1 }, data: { leasedUntil: new Date(Date.now() + 60_000) } });
  const id2 = await enqueueAgentTask({ kind: KIND, subjectType: 'camera', subjectId: 'cam-leased', reason: 'gọi tiếp', priority: 0, dueAt: new Date() });
  assert.notEqual(id2, id1);
  assert.equal(await prisma.agentTask.count({ where: { kind: KIND, subjectId: 'cam-leased' } }), 2);
});

test('a finished task is not merged: a new row is created', async () => {
  const id1 = await enqueueAgentTask({ kind: KIND, subjectType: 'camera', subjectId: 'cam-done', reason: 'đã xong', priority: 0, dueAt: new Date(Date.now() - 1000) });
  await prisma.agentTask.update({ where: { id: id1 }, data: { finishedAt: new Date() } });
  const id2 = await enqueueAgentTask({ kind: KIND, subjectType: 'camera', subjectId: 'cam-done', reason: 'lại nữa', priority: 0, dueAt: new Date() });
  assert.notEqual(id2, id1);
  assert.equal(await prisma.agentTask.count({ where: { kind: KIND, subjectId: 'cam-done' } }), 2);
});
