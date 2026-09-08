// SPDX-License-Identifier: MIT

import type { Camera, Violation } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { senderFor, recipientsForChannel } from '@/lib/alert-channels';
import { getViolationTypeLabel } from '@/lib/utils';

interface MatchedRule {
  id: string;
  channels: string[];
  recipients: string[];
  cooldownSec: number;
  threshold: number;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function findMatchingRules(violation: Violation, camera: Camera): Promise<MatchedRule[]> {
  const rules = await prisma.alertRule.findMany({
    where: { siteId: camera.siteId, isActive: true },
  });

  return rules
    .map((rule) => ({
      id: rule.id,
      // Chỉ giữ kênh đã nối sender (telegram/zalo/webhook); SMS, email… trong
      // enum vẫn chưa gửi được nên bỏ qua.
      channels: parseJsonArray(rule.channels).filter((channel) => senderFor(channel)),
      recipients: parseJsonArray(rule.recipients),
      cooldownSec: rule.cooldownSec,
      threshold: rule.threshold,
      violationTypes: parseJsonArray(rule.violationTypes),
    }))
    .filter((rule) => {
      if (rule.channels.length === 0) return false;
      return rule.violationTypes.length === 0 || rule.violationTypes.includes(violation.type);
    });
}

// threshold<=1 (mặc định) = báo ngay vi phạm đầu tiên, bỏ qua bước đếm.
// threshold>1 = đếm số Violation cùng site+loại trong cooldownSec gần nhất,
// dùng chung cooldownSec làm cửa sổ đếm (không tách field riêng, xem Global Constraints spec).
async function isBelowThreshold(rule: MatchedRule, violation: Violation, camera: Camera): Promise<boolean> {
  if (rule.threshold <= 1) return false;
  const since = new Date(Date.now() - rule.cooldownSec * 1000);
  const count = await prisma.violation.count({
    where: { siteId: camera.siteId, type: violation.type, detectedAt: { gte: since } },
  });
  return count < rule.threshold;
}

async function isInCooldown(rule: MatchedRule): Promise<boolean> {
  // Only a successful send (errorMessage: null, per sendToRecipients' Alert.create
  // below) starts the cooldown clock — a failed send must not block retrying on
  // the next violation.
  const lastAlert = await prisma.alert.findFirst({
    where: { ruleId: rule.id, errorMessage: null },
    orderBy: { sentAt: 'desc' },
  });
  if (!lastAlert) return false;
  const elapsedSec = (Date.now() - lastAlert.sentAt.getTime()) / 1000;
  return elapsedSec < rule.cooldownSec;
}

function buildCaption(violation: Violation, camera: Camera): string {
  // Lần đầu chỉ là nhắc nhở; còn tái phạm (occurrenceCount >= 2) mới tính là vi phạm chính thức.
  const title =
    violation.occurrenceCount <= 1
      ? '⚠️ Nhắc nhở vi phạm ATLĐ'
      : `🚨 Vi phạm ATLĐ (lần ${violation.occurrenceCount})`;
  return (
    `<b>${title}</b>\n` +
    `Loại vi phạm: ${getViolationTypeLabel(violation.type)}\n` +
    `Camera: ${camera.name}\n` +
    `Thời gian: ${violation.detectedAt.toISOString()}`
  );
}

async function sendToRecipients(rule: MatchedRule, violation: Violation, camera: Camera, caption: string): Promise<void> {
  for (const channel of rule.channels) {
    const sender = senderFor(channel);
    if (!sender) continue;
    for (const recipient of recipientsForChannel(channel, rule.recipients)) {
      const result = await sender.send({ violation, camera, recipient, caption });
      // Kênh chưa cấu hình / đang tắt: không ghi Alert, để cooldown không bị
      // khoá bởi một lần "gửi" chưa từng xảy ra.
      if (result.skipped) continue;
      // status không set -> dùng default "NEW" của Prisma, giống cách Violation.create() không set status
      await prisma.alert.create({
        data: {
          violationId: violation.id,
          ruleId: rule.id,
          channel,
          recipient,
          errorMessage: result.ok ? null : (result.error ?? 'Gửi thất bại'),
        },
      });
    }
  }
}

export async function notifyViolation(violation: Violation, camera: Camera, opts: { caption?: string } = {}): Promise<void> {
  const rules = await findMatchingRules(violation, camera);
  if (rules.length === 0) return;

  const caption = opts.caption ?? buildCaption(violation, camera);

  for (const rule of rules) {
    if (await isBelowThreshold(rule, violation, camera)) continue;
    if (await isInCooldown(rule)) continue;
    await sendToRecipients(rule, violation, camera, caption);
  }
}
