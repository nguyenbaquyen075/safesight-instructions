// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/db';
import { opsTargets, sendOpsAlert } from '../lib/notify';
import { AlertChannel } from '../../src/types/enums';
import type { AlertSender } from '../../src/lib/alert-channels';

// G5: leo thang vận hành (sendOpsAlert, không gắn violationId) phải gửi qua MỌI
// kênh đã cấu hình trong AlertRule, không chỉ Telegram như trước.

function rule(overrides: {
  id?: string;
  channels?: string[];
  recipients?: string[];
  violationTypes?: string[];
}) {
  return {
    id: overrides.id ?? 'rule-1',
    channels: JSON.stringify(overrides.channels ?? [AlertChannel.TELEGRAM]),
    recipients: JSON.stringify(overrides.recipients ?? ['123']),
    violationTypes: JSON.stringify(overrides.violationTypes ?? []),
  };
}

/* ===== opsTargets (thuần, không DB) ===== */

test('opsTargets picks the active rule without violationTypes and expands every sendable channel/recipient', () => {
  const rules = [
    rule({ id: 'r-typed', violationTypes: ['hard_hat'] }),
    rule({
      id: 'r-all',
      channels: [AlertChannel.TELEGRAM, AlertChannel.ZALO, AlertChannel.WEBHOOK],
      recipients: ['111', 'zalo:222', 'webhook:https://hooks.example.com/x'],
    }),
  ];
  assert.deepEqual(opsTargets(rules), [
    { ruleId: 'r-all', channel: AlertChannel.TELEGRAM, recipient: '111' },
    { ruleId: 'r-all', channel: AlertChannel.ZALO, recipient: '222' },
    { ruleId: 'r-all', channel: AlertChannel.WEBHOOK, recipient: 'https://hooks.example.com/x' },
  ]);
});

test('opsTargets falls back to the first active rule when none has an empty violationTypes', () => {
  const rules = [rule({ id: 'r-typed-1', violationTypes: ['hard_hat'] }), rule({ id: 'r-typed-2', violationTypes: ['no_vest'] })];
  assert.deepEqual(opsTargets(rules), [{ ruleId: 'r-typed-1', channel: AlertChannel.TELEGRAM, recipient: '123' }]);
});

test('opsTargets drops channels that have no wired sender', () => {
  const rules = [rule({ channels: [AlertChannel.TELEGRAM, AlertChannel.SMS], recipients: ['123'] })];
  assert.deepEqual(opsTargets(rules), [{ ruleId: 'rule-1', channel: AlertChannel.TELEGRAM, recipient: '123' }]);
});

test('opsTargets returns nothing when there are no active rules', () => {
  assert.deepEqual(opsTargets([]), []);
});

/* ===== sendOpsAlert (đọc AlertRule thật từ DB, sender giả không đụng mạng) ===== */

test.before(async () => {
  await prisma.organization.upsert({ where: { id: 'org-ops' }, update: {}, create: { id: 'org-ops', name: 'Ops Org' } });
  await prisma.site.upsert({ where: { id: 'site-ops' }, update: {}, create: { id: 'site-ops', orgId: 'org-ops', name: 'Site Ops', address: 'x', lat: 0, lng: 0 } });
});

test.after(async () => {
  await prisma.alertRule.deleteMany({ where: { siteId: 'site-ops' } });
});

test('sendOpsAlert sends through every configured channel and reports sent when at least one succeeds', async () => {
  await prisma.alertRule.deleteMany({ where: { siteId: 'site-ops' } });
  await prisma.alertRule.create({
    data: {
      siteId: 'site-ops',
      name: 'Ops multi-channel',
      isActive: true,
      violationTypes: '[]',
      channels: JSON.stringify([AlertChannel.TELEGRAM, AlertChannel.ZALO]),
      recipients: JSON.stringify(['111', 'zalo:222']),
    },
  });

  const senders = (channel: string): AlertSender | undefined => {
    if (channel === AlertChannel.TELEGRAM) return { send: async () => ({ ok: false, error: 'no telegram settings' }) };
    if (channel === AlertChannel.ZALO) return { send: async () => ({ ok: true }) };
    return undefined;
  };

  const result = await sendOpsAlert('Vận hành: camera cổng mất kết nối 10 phút.', senders);
  assert.equal(result.sent, true);
  assert.deepEqual(
    result.perChannel.map((p) => [p.channel, p.ok]),
    [
      [AlertChannel.TELEGRAM, false],
      [AlertChannel.ZALO, true],
    ],
  );
});

test('sendOpsAlert reports not sent when every channel fails', async () => {
  await prisma.alertRule.deleteMany({ where: { siteId: 'site-ops' } });
  await prisma.alertRule.create({
    data: {
      siteId: 'site-ops',
      name: 'Ops telegram only',
      isActive: true,
      violationTypes: '[]',
      channels: JSON.stringify([AlertChannel.TELEGRAM]),
      recipients: JSON.stringify(['111']),
    },
  });

  const senders = (): AlertSender => ({ send: async () => ({ ok: false, error: 'boom' }) });
  const result = await sendOpsAlert('Vận hành: test', senders);
  assert.equal(result.sent, false);
  assert.ok(result.reason);
});

test('sendOpsAlert reports not sent when no AlertRule is active', async () => {
  await prisma.alertRule.deleteMany({ where: { siteId: 'site-ops' } });
  const result = await sendOpsAlert('Vận hành: test', () => ({ send: async () => ({ ok: true }) }));
  assert.equal(result.sent, false);
  assert.match(result.reason ?? '', /AlertRule/);
});

test('sendOpsAlert HTML-escapes the caption before handing it to a sender', async () => {
  await prisma.alertRule.deleteMany({ where: { siteId: 'site-ops' } });
  await prisma.alertRule.create({
    data: {
      siteId: 'site-ops',
      name: 'Ops escape',
      isActive: true,
      violationTypes: '[]',
      channels: JSON.stringify([AlertChannel.TELEGRAM]),
      recipients: JSON.stringify(['111']),
    },
  });

  let captured = '';
  const senders = (): AlertSender => ({
    send: async (input) => {
      captured = input.caption;
      return { ok: true };
    },
  });
  await sendOpsAlert('a < b & c', senders);
  assert.equal(captured, 'a &lt; b &amp; c');
});
