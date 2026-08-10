// SPDX-License-Identifier: MIT

import { z } from 'zod';
import { AlertChannel } from '@/types/enums';

export const chatIdSchema = z
  .string()
  .regex(/^-?\d+$/, 'chat_id không hợp lệ (chỉ gồm số, có thể có dấu - ở đầu cho group)');

export const alertRuleObjectSchema = z.object({
  siteId: z.string().min(1),
  name: z.string().min(1),
  violationTypes: z.array(z.string()),
  channels: z.array(z.nativeEnum(AlertChannel)),
  recipients: z.array(chatIdSchema),
  threshold: z.number().int().min(1),
  cooldownSec: z.number().int().min(0),
  isActive: z.boolean(),
});

export const alertRuleSchema = alertRuleObjectSchema.superRefine((data, ctx) => {
  if (data.channels.includes(AlertChannel.TELEGRAM) && data.recipients.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['recipients'],
      message: 'Cần ít nhất 1 người nhận khi bật kênh Telegram',
    });
  }
});

export type AlertRuleInput = z.infer<typeof alertRuleSchema>;
