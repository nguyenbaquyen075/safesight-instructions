// SPDX-License-Identifier: MIT
import { prisma } from './db';
import { decrypt } from '@/lib/crypto';
import { TelegramClient } from '@/lib/telegram';
import { AlertChannel } from '@/types/enums';

// Telegram gửi với parse_mode=HTML: '<' trong chữ do model sinh sẽ làm Telegram trả lỗi parse (hoặc nuốt mất đoạn văn).
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function parseArray(value: string): string[] {
  try { const v = JSON.parse(value); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Người nhận vận hành: rule Telegram đang bật có violationTypes rỗng (= mọi loại), không có thì rule Telegram bật đầu tiên.
export async function opsRecipients(): Promise<{ ruleId: string; chatIds: string[] } | null> {
  const rules = await prisma.alertRule.findMany({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  const telegram = rules.filter(r => parseArray(r.channels).includes(AlertChannel.TELEGRAM));
  const pick = telegram.find(r => parseArray(r.violationTypes).length === 0) ?? telegram[0];
  if (!pick) return null;
  return { ruleId: pick.id, chatIds: parseArray(pick.recipients) };
}

export async function sendOpsAlert(text: string): Promise<{ sent: boolean; reason?: string }> {
  const settings = await prisma.telegramSettings.findFirst();
  if (!settings?.isEnabled || !settings.botTokenEncrypted) return { sent: false, reason: 'Telegram chưa bật' };
  const to = await opsRecipients();
  if (!to || to.chatIds.length === 0) return { sent: false, reason: 'chưa có AlertRule Telegram nào' };
  const client = new TelegramClient(decrypt(settings.botTokenEncrypted));
  let ok = false;
  for (const chatId of to.chatIds) {
    const r = await client.sendMessage(chatId, escapeHtml(text));
    ok = ok || r.ok;
  }
  return ok ? { sent: true } : { sent: false, reason: 'Telegram trả lỗi' };
}
