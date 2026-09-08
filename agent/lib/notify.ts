// SPDX-License-Identifier: MIT
import { prisma } from './db';
import { senderFor, recipientsForChannel } from '@/lib/alert-channels';
import type { AlertSender } from '@/lib/alert-channels';

// Telegram gửi với parse_mode=HTML: '<' trong chữ do model sinh sẽ làm Telegram trả lỗi parse (hoặc nuốt mất đoạn văn).
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseArray(value: string): string[] {
  try { const v = JSON.parse(value); return Array.isArray(v) ? v : []; } catch { return []; }
}

interface OpsRule {
  id: string;
  channels: string; // JSON array
  recipients: string; // JSON array, mục kênh không Telegram mang tiền tố "zalo:"/"webhook:"
  violationTypes: string; // JSON array
}

export interface OpsTarget {
  ruleId: string;
  channel: string;
  recipient: string;
}

// Rule vận hành: rule đang bật có violationTypes rỗng (= mọi loại), không có thì rule bật đầu tiên.
// Mọi kênh của rule đó đã nối sender (senderFor) -> mỗi người nhận của kênh đó thành một đích gửi.
export function opsTargets(rules: OpsRule[]): OpsTarget[] {
  const pick = rules.find((r) => parseArray(r.violationTypes).length === 0) ?? rules[0];
  if (!pick) return [];
  const recipients = parseArray(pick.recipients);
  return parseArray(pick.channels)
    .filter((channel) => senderFor(channel))
    .flatMap((channel) =>
      recipientsForChannel(channel, recipients).map((recipient) => ({ ruleId: pick.id, channel, recipient })),
    );
}

export interface OpsAlertResult {
  sent: boolean;
  reason?: string;
  perChannel: Array<{ ruleId: string; channel: string; recipient: string; ok: boolean; error?: string }>;
}

// senders: tra sender theo kênh, mặc định là senderFor thật (Telegram/Zalo/Webhook). Tham số
// này tồn tại để test tiêm sender giả, không đụng mạng thật.
export async function sendOpsAlert(
  text: string,
  senders: (channel: string) => AlertSender | undefined = senderFor,
): Promise<OpsAlertResult> {
  const rules = await prisma.alertRule.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  const targets = opsTargets(rules);
  if (targets.length === 0) return { sent: false, reason: 'chưa có AlertRule nào đang bật kênh nào', perChannel: [] };

  const caption = escapeHtml(text);
  const perChannel: OpsAlertResult['perChannel'] = [];
  for (const target of targets) {
    const sender = senders(target.channel);
    if (!sender) continue;
    const result = await sender.send({ recipient: target.recipient, caption });
    perChannel.push({ ruleId: target.ruleId, channel: target.channel, recipient: target.recipient, ok: result.ok, error: result.error });
  }
  const sent = perChannel.some((p) => p.ok);
  return sent ? { sent: true, perChannel } : { sent: false, reason: 'không kênh nào gửi được', perChannel };
}
