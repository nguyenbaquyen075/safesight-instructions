// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { announce } from '../../src/lib/announce';
import { announcementFor } from '../../src/lib/announce-shape';
import { autoAnnounce } from '../../src/lib/auto-announce';

// Tự phát loa khi engine chốt vi phạm (~3s): lần đầu nhắc nhẹ, tái phạm nói mạnh,
// không cần AlertRule; AUTO_ANNOUNCE=false là công tắc tắt khẩn.

const camera = { id: 'cam-a', name: 'Cổng chính', location: 'Cổng A' } as never;
const violation = (over: Record<string, unknown> = {}) => ({ id: 'v1', type: 'hard_hat', occurrenceCount: 1, ...over }) as never;

type Call = { url: string; body: Record<string, unknown> };
function fakeBridge(reply: { status?: number; listeners?: number } | 'throw' = {}) {
  const calls: Call[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (reply === 'throw') throw new Error('ECONNREFUSED');
    const status = reply.status ?? 200;
    return new Response(JSON.stringify({ ok: status === 200, listeners: reply.listeners ?? 1 }), { status });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/* ===== announcementFor: nhắc nhẹ vs nói mạnh ===== */

test('first occurrence is a gentle reminder, identical to the existing sentence', () => {
  assert.equal(announcementFor({ type: 'hard_hat' }, { name: 'x', location: 'Cổng A' }), 'Khu vực Cổng A, vui lòng đội mũ bảo hộ');
  assert.equal(announcementFor({ type: 'hard_hat', occurrenceCount: 1 }, { name: 'x', location: 'Cổng A' }), 'Khu vực Cổng A, vui lòng đội mũ bảo hộ');
});

test('a repeat occurrence is firmer and never doubles the word "ngay"', () => {
  const cam = { name: 'x', location: 'Cổng A' };
  assert.equal(announcementFor({ type: 'hard_hat', occurrenceCount: 2 }, cam), 'Cảnh báo, khu vực Cổng A, yêu cầu đội mũ bảo hộ ngay');
  assert.equal(announcementFor({ type: 'zone_intrusion', occurrenceCount: 3 }, cam), 'Cảnh báo, khu vực Cổng A, yêu cầu rời khỏi khu vực cấm ngay');
});

/* ===== announce(): force + throttled ===== */

test('announce adds force to the body only when asked, so the agent request keeps its shape', async () => {
  const bridge = fakeBridge();
  try {
    await announce('cam-a', 'Câu thử nghiệm một');
    await announce('cam-a', 'Câu thử nghiệm hai', { force: true });
    assert.deepEqual(bridge.calls[0].body, { cameraId: 'cam-a', text: 'Câu thử nghiệm một' });
    assert.deepEqual(bridge.calls[1].body, { cameraId: 'cam-a', text: 'Câu thử nghiệm hai', force: true });
  } finally { bridge.restore(); }
});

test('announce reports a 429 from the bridge as throttled, not as an outage', async () => {
  const bridge = fakeBridge({ status: 429 });
  try {
    const r = await announce('cam-a', 'Câu thử nghiệm');
    assert.equal(r.ok, false);
    assert.equal(r.throttled, true);
  } finally { bridge.restore(); }
});

/* ===== autoAnnounce ===== */

test('autoAnnounce speaks to the violating camera own speaker with the gentle sentence', async () => {
  const bridge = fakeBridge();
  try {
    const r = await autoAnnounce(violation(), camera);
    assert.equal(r?.ok, true);
    assert.equal(bridge.calls.length, 1);
    assert.deepEqual(bridge.calls[0].body, { cameraId: 'cam-a', text: 'Khu vực Cổng A, vui lòng đội mũ bảo hộ' });
  } finally { bridge.restore(); }
});

test('autoAnnounce uses the firm sentence for a repeat violation', async () => {
  const bridge = fakeBridge();
  try {
    await autoAnnounce(violation({ occurrenceCount: 2 }), camera);
    assert.match(String(bridge.calls[0].body.text), /^Cảnh báo, khu vực Cổng A, yêu cầu đội mũ bảo hộ ngay$/);
  } finally { bridge.restore(); }
});

test('AUTO_ANNOUNCE=false is the kill switch: nothing is sent', async () => {
  const bridge = fakeBridge();
  const before = process.env.AUTO_ANNOUNCE;
  process.env.AUTO_ANNOUNCE = 'false';
  try {
    assert.equal(await autoAnnounce(violation(), camera), null);
    assert.equal(bridge.calls.length, 0);
  } finally {
    if (before === undefined) delete process.env.AUTO_ANNOUNCE; else process.env.AUTO_ANNOUNCE = before;
    bridge.restore();
  }
});

test('autoAnnounce never throws when the bridge is down', async () => {
  const bridge = fakeBridge('throw');
  try {
    const r = await autoAnnounce(violation(), camera);
    assert.equal(r?.ok, false);
  } finally { bridge.restore(); }
});
