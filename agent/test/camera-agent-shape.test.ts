// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMemory, toCameraAgentView } from '@/lib/camera-agent-shape';

// Phần thuần của GET /api/agent/cameras (route handler cần ngữ cảnh Next request +
// auth() nên không test trực tiếp được, giống violation-where.test.ts).

const CAMERA = { id: 'cam-shape-t', name: 'Cổng chính', siteId: 'site-shape-t', status: 'ONLINE', site: { name: 'Công trường A' } };
const STATS = { openViolations: 3, reviewed24h: 5, falsePositiveRate24h: 0.4 };

test('a camera without a CameraAgent row gets the default view, not an upsert', () => {
  const view = toCameraAgentView(CAMERA, null, STATS);
  assert.equal(view.exists, false);
  assert.equal(view.isEnabled, true);
  assert.equal(view.digestEveryMin, 30);
  assert.equal(view.dailyTokenCap, 300_000);
  assert.equal(view.tokensUsedToday, 0);
  assert.equal(view.lastDigestAt, null);
  assert.deepEqual(view.memory, []);
  assert.equal(view.openViolations, 3);
  assert.equal(view.reviewed24h, 5);
  assert.equal(view.falsePositiveRate24h, 0.4);
});

test('an existing row wins and camera status is lowercased for the frontend enum', () => {
  const view = toCameraAgentView(CAMERA, {
    isEnabled: false,
    memory: JSON.stringify([{ at: '2026-09-08T10:00:00.000Z', text: 'ngược sáng 16-17h', sessionId: 's1' }]),
    digestEveryMin: 60,
    dailyTokenCap: 100,
    tokensUsedToday: 42,
    lastDigestAt: new Date('2026-09-08T10:00:00.000Z'),
  }, STATS);
  assert.equal(view.exists, true);
  assert.equal(view.isEnabled, false);
  assert.equal(view.digestEveryMin, 60);
  assert.equal(view.dailyTokenCap, 100);
  assert.equal(view.tokensUsedToday, 42);
  assert.equal(view.lastDigestAt, '2026-09-08T10:00:00.000Z');
  assert.equal(view.memory.length, 1);
  assert.equal(view.memory[0].text, 'ngược sáng 16-17h');
  assert.equal(view.cameraId, 'cam-shape-t');
  assert.equal(view.cameraStatus, 'online');
  assert.equal(view.siteName, 'Công trường A');
});

test('broken memory JSON degrades to an empty list instead of throwing', () => {
  assert.deepEqual(parseMemory('not json'), []);
  assert.deepEqual(parseMemory('{"a":1}'), []);
  assert.deepEqual(toCameraAgentView(CAMERA, { isEnabled: true, memory: 'not json', digestEveryMin: 30, dailyTokenCap: 1, tokensUsedToday: 0, lastDigestAt: null }, STATS).memory, []);
});
