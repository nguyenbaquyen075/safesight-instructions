// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, checkPaused } from '../lib/guard';
import { prisma } from '../lib/db';
import { getAgentSettings } from '../lib/settings';

test('rateLimit allows exactly max calls within the window then blocks', () => {
  const t0 = 1_000_000;
  assert.equal(rateLimit('engine', 3, 3_600_000, t0), true);
  assert.equal(rateLimit('engine', 3, 3_600_000, t0 + 1), true);
  assert.equal(rateLimit('engine', 3, 3_600_000, t0 + 2), true);
  assert.equal(rateLimit('engine', 3, 3_600_000, t0 + 3), false);
  assert.equal(rateLimit('engine', 3, 3_600_000, t0 + 3_600_001), true, 'hết cửa sổ thì mở lại');
});

test('checkPaused reflects the kill switch', async () => {
  const s = await getAgentSettings();
  await prisma.agentSettings.update({ where: { id: s.id }, data: { isEnabled: false } });
  const blocked = await checkPaused();
  assert.ok(blocked && /tạm dừng/.test(blocked.reason));
  await prisma.agentSettings.update({ where: { id: s.id }, data: { isEnabled: true } });
  assert.equal(await checkPaused(), null);
});
