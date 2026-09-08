// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { dailyTokensUsed } from '../lib/usage';

const ids = ['usage-t1', 'usage-t2', 'usage-t3', 'usage-t4', 'usage-t5', 'usage-t6', 'usage-t7'];

test.before(async () => { await prisma.agentEvent.deleteMany({ where: { sessionId: { in: ids } } }); });

// dailyTokensUsed() quét toàn bộ session.ended trong ngày, không lọc theo sessionId —
// các test khác cũng có thể ghi session.ended "hôm nay" nên đo bằng độ lệch (before/after)
// thay vì so bằng tổng tuyệt đối.
test('dailyTokensUsed sums input_tokens + output_tokens across today\'s session.ended rows', async () => {
  const before = await dailyTokensUsed();
  await prisma.agentEvent.createMany({ data: [
    { sessionId: 'usage-t1', type: 'session.ended', data: JSON.stringify({ usage: { input_tokens: 100, output_tokens: 50 } }) },
    { sessionId: 'usage-t2', type: 'session.ended', data: JSON.stringify({ usage: { input_tokens: 20, output_tokens: 5 } }) },
  ] });
  assert.equal(await dailyTokensUsed() - before, 175);
});

test('dailyTokensUsed ignores malformed data, rows without usage, other event types, and yesterday\'s rows', async () => {
  const before = await dailyTokensUsed();
  const yesterday = new Date(); yesterday.setHours(0, 0, 0, 0); yesterday.setMilliseconds(-1); // 23:59:59.999 hôm qua, trước nửa đêm hôm nay
  await prisma.agentEvent.createMany({ data: [
    { sessionId: 'usage-t3', type: 'session.ended', data: '{not-json' }, // JSON hỏng
    { sessionId: 'usage-t4', type: 'session.ended', data: JSON.stringify({ note: 'không có usage' }) }, // thiếu usage
    { sessionId: 'usage-t5', type: 'tool.call', data: JSON.stringify({ usage: { input_tokens: 500, output_tokens: 500 } }) }, // sai type
    { sessionId: 'usage-t6', type: 'session.ended', data: JSON.stringify({ usage: { input_tokens: 999, output_tokens: 999 } }), emittedAt: yesterday }, // hôm qua
    { sessionId: 'usage-t7', type: 'session.ended', data: JSON.stringify({ usage: { input_tokens: 7, output_tokens: 3 } }) }, // dòng hợp lệ duy nhất
  ] });
  assert.equal(await dailyTokensUsed() - before, 10);
});
