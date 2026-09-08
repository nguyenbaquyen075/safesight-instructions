// SPDX-License-Identifier: MIT

import { z } from 'zod';
import { AlertChannel } from '@/types/enums';

/** Các kênh đã nối thật (có sender). Enum còn SMS/Email/… nhưng chưa gửi được. */
export const SENDABLE_CHANNELS = [AlertChannel.TELEGRAM, AlertChannel.ZALO, AlertChannel.WEBHOOK] as const;
export type SendableChannel = (typeof SENDABLE_CHANNELS)[number];

export const chatIdSchema = z
  .string()
  .regex(/^-?\d+$/, 'chat_id không hợp lệ (chỉ gồm số, có thể có dấu - ở đầu cho group)');

export const zaloUserIdSchema = z
  .string()
  .regex(/^\d+$/, 'Zalo user id không hợp lệ (chỉ gồm số)');

export const webhookUrlSchema = z
  .string()
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'Webhook phải là URL https hợp lệ');

const RECIPIENT_SCHEMAS: Record<SendableChannel, z.ZodType<string>> = {
  [AlertChannel.TELEGRAM]: chatIdSchema,
  [AlertChannel.ZALO]: zaloUserIdSchema,
  [AlertChannel.WEBHOOK]: webhookUrlSchema,
};

// AlertRule.recipients là MỘT mảng JSON dùng chung cho mọi kênh, nên mỗi mục
// mang tiền tố kênh: "zalo:123", "webhook:https://…". Mục không tiền tố là
// chat_id Telegram — giữ nguyên dữ liệu của các quy tắc đã tạo trước v0.9.
const PREFIX_RE = new RegExp(`^(${SENDABLE_CHANNELS.join('|')}):(.+)$`, 's');

export function parseRecipient(entry: string): { channel: SendableChannel; value: string } {
  const matched = PREFIX_RE.exec(entry);
  if (!matched) return { channel: AlertChannel.TELEGRAM, value: entry };
  return { channel: matched[1] as SendableChannel, value: matched[2] };
}

export function formatRecipient(channel: SendableChannel, value: string): string {
  return `${channel}:${value}`;
}

export function recipientsForChannel(channel: string, recipients: string[]): string[] {
  return recipients.flatMap((entry) => {
    const parsed = parseRecipient(entry);
    return parsed.channel === channel ? [parsed.value] : [];
  });
}

export const recipientSchema = z.string().superRefine((entry, ctx) => {
  const { channel, value } = parseRecipient(entry);
  const parsed = RECIPIENT_SCHEMAS[channel].safeParse(value);
  if (!parsed.success) {
    ctx.addIssue({ code: 'custom', message: parsed.error.issues[0].message });
  }
});

export const alertRuleObjectSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  violationTypes: z.array(z.string()),
  channels: z.array(z.nativeEnum(AlertChannel)),
  recipients: z.array(recipientSchema),
  threshold: z.number().int().min(1),
  cooldownSec: z.number().int().min(0),
  isActive: z.boolean(),
});

const CHANNEL_LABELS: Record<SendableChannel, string> = {
  [AlertChannel.TELEGRAM]: 'Telegram',
  [AlertChannel.ZALO]: 'Zalo OA',
  [AlertChannel.WEBHOOK]: 'Webhook',
};

export const alertRuleSchema = alertRuleObjectSchema.superRefine((data, ctx) => {
  for (const channel of SENDABLE_CHANNELS) {
    if (data.channels.includes(channel) && recipientsForChannel(channel, data.recipients).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['recipients'],
        message: `Cần ít nhất 1 người nhận khi bật kênh ${CHANNEL_LABELS[channel]}`,
      });
    }
  }
});

export type AlertRuleInput = z.infer<typeof alertRuleSchema>;
