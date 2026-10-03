// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { senderFor, recipientsForChannel } from '../../src/lib/alert-channels';
import { alertRuleSchema, recipientSchema } from '../../src/lib/validation/alert-rule';
import { AlertChannel } from '../../src/types/enums';

// Kênh loa công trường (AlertChannel.PA_SYSTEM): người nhận là id camera đặt loa,
// ghi trong AlertRule.recipients dưới dạng "pa_system:<cameraId>".

const violation = { id: 'v1', type: 'hard_hat', occurrenceCount: 1 } as never;
const camera = { id: 'cam-a', name: 'Cổng chính', location: 'Cổng A' } as never;

type FetchCall = { url: string; body: { cameraId: string; text: string } };

// Giả bridge: ghi lại request, trả listeners/status theo kịch bản.
function fakeBridge(reply: { status?: number; listeners?: number } | 'throw') {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: { body: string }) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    if (reply === 'throw') throw new Error('ECONNREFUSED');
    const status = reply.status ?? 200;
    return new Response(JSON.stringify({ ok: status === 200, listeners: reply.listeners ?? 0 }), { status });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

/* ===== người nhận / validation ===== */

test('recipientsForChannel extracts only pa_system recipients', () => {
  assert.deepEqual(
    recipientsForChannel(AlertChannel.PA_SYSTEM, ['111', 'pa_system:cam-1', 'zalo:222', 'pa_system:cam-2']),
    ['cam-1', 'cam-2'],
  );
});

test('recipientSchema accepts a camera id and rejects empty or malformed ones', () => {
  assert.equal(recipientSchema.safeParse('pa_system:cam-001').success, true);
  assert.equal(recipientSchema.safeParse('pa_system:').success, false);
  assert.equal(recipientSchema.safeParse('pa_system:cam 1').success, false);
});

test('alertRuleSchema requires at least one speaker when the pa_system channel is on', () => {
  const base = { siteId: 's', name: 'r', violationTypes: [], threshold: 1, cooldownSec: 300, isActive: true };
  const missing = alertRuleSchema.safeParse({ ...base, channels: [AlertChannel.PA_SYSTEM], recipients: [] });
  assert.equal(missing.success, false);
  const ok = alertRuleSchema.safeParse({ ...base, channels: [AlertChannel.PA_SYSTEM], recipients: ['pa_system:cam-a'] });
  assert.equal(ok.success, true);
});

test('unprefixed recipients stay Telegram chat ids (no regression for existing rules)', () => {
  assert.deepEqual(recipientsForChannel(AlertChannel.TELEGRAM, ['111', 'pa_system:cam-a']), ['111']);
});

/* ===== sender ===== */

test('senderFor wires a sender for pa_system', () => {
  assert.ok(senderFor(AlertChannel.PA_SYSTEM));
});

test('speaker sender announces to the recipient camera with a sentence built from the violation', async () => {
  const bridge = fakeBridge({ listeners: 2 });
  try {
    const result = await senderFor(AlertChannel.PA_SYSTEM)!.send({ violation, camera, recipient: 'cam-speaker', caption: '<b>x</b>' });
    assert.equal(result.ok, true);
    assert.equal(bridge.calls.length, 1);
    assert.match(bridge.calls[0].url, /\/announce$/);
    assert.equal(bridge.calls[0].body.cameraId, 'cam-speaker'); // loa của người nhận, không phải camera vi phạm
    assert.match(bridge.calls[0].body.text, /Cổng A/);
    assert.match(bridge.calls[0].body.text, /đội mũ bảo hộ/);
  } finally { bridge.restore(); }
});

test('speaker sender reports failure (so cooldown is not consumed) when no device is listening', async () => {
  const bridge = fakeBridge({ listeners: 0 });
  try {
    const result = await senderFor(AlertChannel.PA_SYSTEM)!.send({ violation, camera, recipient: 'cam-speaker', caption: '' });
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /không có loa/);
  } finally { bridge.restore(); }
});

test('speaker sender reports failure when the bridge is down or rejects', async () => {
  for (const reply of ['throw', { status: 401 }] as const) {
    const bridge = fakeBridge(reply);
    try {
      const result = await senderFor(AlertChannel.PA_SYSTEM)!.send({ violation, camera, recipient: 'cam-speaker', caption: '' });
      assert.equal(result.ok, false);
      assert.ok(result.error);
    } finally { bridge.restore(); }
  }
});

test('speaker sender skips operational alerts: no violation means nothing to say aloud', async () => {
  const bridge = fakeBridge({ listeners: 1 });
  try {
    const result = await senderFor(AlertChannel.PA_SYSTEM)!.send({ recipient: 'cam-speaker', caption: 'Vận hành: camera mất kết nối' });
    assert.equal(result.skipped, true);
    assert.equal(bridge.calls.length, 0);
  } finally { bridge.restore(); }
});
