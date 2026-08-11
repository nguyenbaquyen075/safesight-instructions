// SPDX-License-Identifier: MIT

import type { Camera, Violation } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { TelegramClient, type TelegramResult } from '@/lib/telegram';
import { AlertChannel } from '@/types/enums';
import { getViolationTypeLabel } from '@/lib/utils';

interface MatchedRule {
  id: string;
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
    .filter((rule) => {
      const channels = parseJsonArray(rule.channels);
      if (!channels.includes(AlertChannel.TELEGRAM)) return false;
      const violationTypes = parseJsonArray(rule.violationTypes);
      return violationTypes.length === 0 || violationTypes.includes(violation.type);
    })
    .map((rule) => ({
      id: rule.id,
      recipients: parseJsonArray(rule.recipients),
      cooldownSec: rule.cooldownSec,
      threshold: rule.threshold,
    }));
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

async function sendToRecipients(rule: MatchedRule, violation: Violation, camera: Camera, botToken: string): Promise<void> {
  const client = new TelegramClient(botToken);
  const caption =
    `⚠️ <b>Cảnh báo vi phạm ATLĐ</b>\n` +
    `Loại vi phạm: ${getViolationTypeLabel(violation.type)}\n` +
    `Camera: ${camera.name}\n` +
    `Thời gian: ${violation.detectedAt.toISOString()}`;

  for (const chatId of rule.recipients) {
    let result: TelegramResult;
    try {
      result = await client.sendPhoto(chatId, violation.snapshotUrl, caption);
    } catch (err) {
      result = { ok: false, description: err instanceof Error ? err.message : String(err) };
    }
    // status không set -> dùng default "NEW" của Prisma, giống cách Violation.create() không set status
    await prisma.alert.create({
      data: {
        violationId: violation.id,
        ruleId: rule.id,
        channel: AlertChannel.TELEGRAM,
        recipient: chatId,
        errorMessage: result.ok ? null : result.description,
      },
    });
  }
}

export async function notifyViolation(violation: Violation, camera: Camera): Promise<void> {
  const settings = await prisma.telegramSettings.findFirst();
  if (!settings || !settings.isEnabled || !settings.botTokenEncrypted) return;

  const rules = await findMatchingRules(violation, camera);
  if (rules.length === 0) return;

  const botToken = decrypt(settings.botTokenEncrypted);

  for (const rule of rules) {
    if (await isBelowThreshold(rule, violation, camera)) continue;
    if (await isInCooldown(rule)) continue;
    await sendToRecipients(rule, violation, camera, botToken);
  }
}
