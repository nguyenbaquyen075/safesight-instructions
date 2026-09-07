// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { emit, newSessionId } from '../lib/audit';
import { getAgentSettings, isPaused, AGENT_SETTINGS_ID } from '../lib/settings';

test('emit writes an AgentEvent with JSON data', async () => {
  const sessionId = newSessionId();
  await emit({ sessionId, type: 'health', data: { code: 'camera.stalled', cameraId: 'cam-001' } });
  const row = await prisma.agentEvent.findFirst({ where: { sessionId } });
  assert.ok(row);
  assert.equal(row.type, 'health');
  assert.equal(JSON.parse(row.data).code, 'camera.stalled');
});

test('getAgentSettings creates exactly one row and isPaused follows isEnabled', async () => {
  const a = await getAgentSettings();
  const b = await getAgentSettings();
  assert.equal(a.id, b.id);
  assert.equal(a.id, AGENT_SETTINGS_ID);
  assert.equal(await prisma.agentSettings.count(), 1);
  assert.equal(await isPaused(), false);
  await prisma.agentSettings.update({ where: { id: a.id }, data: { isEnabled: false } });
  assert.equal(await isPaused(), true);
  await prisma.agentSettings.update({ where: { id: a.id }, data: { isEnabled: true } });
});
