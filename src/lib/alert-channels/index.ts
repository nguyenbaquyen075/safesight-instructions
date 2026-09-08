// SPDX-License-Identifier: MIT

import type { Camera, Violation } from '@prisma/client';
import { telegramSender } from './telegram';
import { zaloSender } from './zalo';
import { webhookSender } from './webhook';
import { AlertChannel } from '@/types/enums';
import type { SendableChannel } from '@/lib/validation/alert-rule';

export interface AlertSendInput {
  violation: Violation;
  camera: Camera;
  /** Người nhận đã bỏ tiền tố kênh (chat_id, Zalo user id hoặc URL webhook). */
  recipient: string;
  /** Nội dung cảnh báo dạng HTML tối giản của Telegram; kênh khác tự chuyển đổi. */
  caption: string;
}

export interface AlertSendResult {
  ok: boolean;
  error?: string;
  /** Kênh chưa cấu hình/đang tắt: bỏ qua im lặng, KHÔNG ghi bản ghi Alert. */
  skipped?: boolean;
}

export interface AlertSender {
  send(input: AlertSendInput): Promise<AlertSendResult>;
}

const SENDERS: Record<SendableChannel, AlertSender> = {
  [AlertChannel.TELEGRAM]: telegramSender,
  [AlertChannel.ZALO]: zaloSender,
  [AlertChannel.WEBHOOK]: webhookSender,
};

export function senderFor(channel: string): AlertSender | undefined {
  return SENDERS[channel as SendableChannel];
}

export { SENDABLE_CHANNELS, recipientsForChannel } from '@/lib/validation/alert-rule';
