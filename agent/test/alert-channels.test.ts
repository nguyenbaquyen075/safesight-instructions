// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { AlertChannel } from '../../src/types/enums';
import { senderFor, SENDABLE_CHANNELS } from '../../src/lib/alert-channels';
import { stripHtml } from '../../src/lib/alert-channels/zalo';
import { signWebhookBody, postWebhook, isPrivateAddress } from '../../src/lib/webhook';
import {
  chatIdSchema,
  zaloUserIdSchema,
  webhookUrlSchema,
  recipientSchema,
  parseRecipient,
  formatRecipient,
  recipientsForChannel,
} from '../../src/lib/validation/alert-rule';

// Phần thuần của F5: chọn sender theo kênh, chữ ký webhook, tách người nhận
// theo kênh và escape caption. Không gọi mạng — postWebhook nhận fetch giả.

/* ===== senderFor ===== */

test('senderFor returns a sender for every sendable channel', () => {
  for (const channel of SENDABLE_CHANNELS) {
    assert.ok(senderFor(channel), `missing sender for ${channel}`);
  }
  assert.deepEqual([...SENDABLE_CHANNELS], [AlertChannel.TELEGRAM, AlertChannel.ZALO, AlertChannel.WEBHOOK]);
});

test('senderFor returns undefined for channels that are not wired yet', () => {
  assert.equal(senderFor(AlertChannel.SMS), undefined);
  assert.equal(senderFor(AlertChannel.EMAIL), undefined);
  assert.equal(senderFor('nonsense'), undefined);
});

/* ===== webhook signature ===== */

// postWebhook phân giải tên miền trước khi gửi; test không được đụng DNS thật.
const publicLookup = async () => ({ address: '93.184.216.34' });

test('signWebhookBody matches an HMAC-SHA256 computed independently', () => {
  const body = JSON.stringify({ event: 'violation', id: 'v-1' });
  const expected = 'sha256=' + createHmac('sha256', 'top-secret').update(body).digest('hex');
  assert.equal(signWebhookBody(body, 'top-secret'), expected);
});

test('signWebhookBody changes when the body or the secret changes', () => {
  const a = signWebhookBody('{"a":1}', 's1');
  assert.notEqual(a, signWebhookBody('{"a":2}', 's1'));
  assert.notEqual(a, signWebhookBody('{"a":1}', 's2'));
});

test('postWebhook sends signed JSON and reports success', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response('ok', { status: 200 });
  };

  const payload = { event: 'violation', id: 'v-1' };
  const result = await postWebhook('https://hooks.example.com/safesight', payload, {
    secret: 'top-secret',
    fetchImpl: fetchImpl as typeof fetch,
    lookupImpl: publicLookup,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://hooks.example.com/safesight');
  assert.equal(calls[0].init.method, 'POST');
  const headers = calls[0].init.headers as Record<string, string>;
  assert.equal(headers['Content-Type'], 'application/json');
  assert.equal(headers['X-SafeSight-Signature'], signWebhookBody(String(calls[0].init.body), 'top-secret'));
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), payload);
});

test('postWebhook reports the HTTP status when the endpoint rejects', async () => {
  const fetchImpl = async () => new Response('nope', { status: 500 });
  const result = await postWebhook('https://hooks.example.com/x', { a: 1 }, {
    secret: 's',
    fetchImpl: fetchImpl as typeof fetch,
    lookupImpl: publicLookup,
  });
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /500/);
});

test('postWebhook reports a thrown network error instead of throwing', async () => {
  const fetchImpl = async () => {
    throw new Error('boom');
  };
  const result = await postWebhook('https://hooks.example.com/x', { a: 1 }, {
    secret: 's',
    fetchImpl: fetchImpl as typeof fetch,
    lookupImpl: publicLookup,
  });
  assert.deepEqual(result, { ok: false, error: 'boom' });
});

test('postWebhook refuses to send unsigned when no secret is configured', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return new Response('ok');
  };
  const result = await postWebhook('https://hooks.example.com/x', { a: 1 }, {
    secret: undefined,
    fetchImpl: fetchImpl as typeof fetch,
    lookupImpl: publicLookup,
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

/* ===== SSRF: chặn dải mạng nội bộ ===== */

test('isPrivateAddress blocks loopback, private, link-local and CGNAT ranges', () => {
  for (const ip of [
    '127.0.0.1', '127.9.9.9', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.254',
    '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:192.168.0.1',
  ]) {
    assert.equal(isPrivateAddress(ip), true, `${ip} phải bị chặn`);
  }
});

test('isPrivateAddress allows public addresses', () => {
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '172.15.255.255', '11.0.0.1', '2606:4700::1111']) {
    assert.equal(isPrivateAddress(ip), false, `${ip} phải được đi qua`);
  }
});

test('isPrivateAddress fails closed on anything that is not an IP', () => {
  assert.equal(isPrivateAddress(''), true);
  assert.equal(isPrivateAddress('localhost'), true);
  assert.equal(isPrivateAddress('999.1.1.1'), true);
});

test('postWebhook refuses to send when the hostname resolves to a private address', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return new Response('ok');
  };
  const result = await postWebhook('https://internal.example.com/x', { a: 1 }, {
    secret: 's',
    fetchImpl: fetchImpl as typeof fetch,
    lookupImpl: async () => ({ address: '169.254.169.254' }),
  });
  assert.equal(result.ok, false);
  assert.equal(called, false);
});

test('postWebhook does not follow redirects', async () => {
  let init: RequestInit = {};
  const fetchImpl = async (_url: string | URL | Request, got?: RequestInit) => {
    init = got ?? {};
    return new Response(null, { status: 302 });
  };
  const result = await postWebhook('https://hooks.example.com/x', { a: 1 }, {
    secret: 's',
    fetchImpl: fetchImpl as typeof fetch,
    lookupImpl: publicLookup,
  });
  assert.equal(init.redirect, 'manual');
  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /302/);
});

/* ===== recipient validators ===== */

test('telegram chat ids stay digits, with an optional leading minus for groups', () => {
  assert.equal(chatIdSchema.safeParse('123456789').success, true);
  assert.equal(chatIdSchema.safeParse('-1001234567890').success, true);
  assert.equal(chatIdSchema.safeParse('@channel').success, false);
});

test('zalo user ids are digits only', () => {
  assert.equal(zaloUserIdSchema.safeParse('1234567890123456').success, true);
  assert.equal(zaloUserIdSchema.safeParse('-123').success, false);
  assert.equal(zaloUserIdSchema.safeParse('user-1').success, false);
});

test('webhook recipients must be https URLs', () => {
  assert.equal(webhookUrlSchema.safeParse('https://hooks.example.com/safesight').success, true);
  assert.equal(webhookUrlSchema.safeParse('http://hooks.example.com/safesight').success, false);
  assert.equal(webhookUrlSchema.safeParse('hooks.example.com').success, false);
});

test('recipientSchema validates each entry against the channel of its prefix', () => {
  assert.equal(recipientSchema.safeParse('123456789').success, true);
  assert.equal(recipientSchema.safeParse('zalo:1234567890').success, true);
  assert.equal(recipientSchema.safeParse('webhook:https://hooks.example.com/x').success, true);
  assert.equal(recipientSchema.safeParse('zalo:not-a-number').success, false);
  assert.equal(recipientSchema.safeParse('webhook:http://insecure.example.com').success, false);
});

/* ===== recipient routing ===== */

test('an entry without a prefix stays a Telegram chat id (legacy rules)', () => {
  assert.deepEqual(parseRecipient('123456789'), { channel: AlertChannel.TELEGRAM, value: '123456789' });
});

test('parseRecipient reads the channel prefix and keeps the raw value', () => {
  assert.deepEqual(parseRecipient('zalo:987'), { channel: AlertChannel.ZALO, value: '987' });
  assert.deepEqual(parseRecipient('webhook:https://hooks.example.com/x'), {
    channel: AlertChannel.WEBHOOK,
    value: 'https://hooks.example.com/x',
  });
  assert.deepEqual(parseRecipient('telegram:-100123'), { channel: AlertChannel.TELEGRAM, value: '-100123' });
});

test('formatRecipient round-trips through parseRecipient', () => {
  for (const channel of SENDABLE_CHANNELS) {
    const entry = formatRecipient(channel, 'value-1');
    assert.deepEqual(parseRecipient(entry), { channel, value: 'value-1' });
  }
});

test('recipientsForChannel gives each channel only its own recipients', () => {
  const recipients = ['123456789', 'telegram:-100999', 'zalo:555', 'webhook:https://hooks.example.com/x'];
  assert.deepEqual(recipientsForChannel(AlertChannel.TELEGRAM, recipients), ['123456789', '-100999']);
  assert.deepEqual(recipientsForChannel(AlertChannel.ZALO, recipients), ['555']);
  assert.deepEqual(recipientsForChannel(AlertChannel.WEBHOOK, recipients), ['https://hooks.example.com/x']);
  assert.deepEqual(recipientsForChannel(AlertChannel.SMS, recipients), []);
});

/* ===== caption ===== */

test('stripHtml turns the Telegram caption into plain text for Zalo', () => {
  assert.equal(
    stripHtml('<b>🚨 Vi phạm ATLĐ</b>\nCamera: Cổng &amp; bãi xe'),
    '🚨 Vi phạm ATLĐ\nCamera: Cổng & bãi xe',
  );
});

test('stripHtml unescapes the entities escapeHtml produced, without re-injecting tags', () => {
  assert.equal(stripHtml('&lt;script&gt;alert(1)&lt;/script&gt;'), '<script>alert(1)</script>');
  assert.equal(stripHtml('a &quot;b&quot; &#39;c&#39;'), 'a "b" \'c\'');
});
