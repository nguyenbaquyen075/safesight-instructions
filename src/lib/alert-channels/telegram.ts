// SPDX-License-Identifier: MIT

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { TelegramClient, type TelegramResult } from '@/lib/telegram';
import type { AlertSender } from './index';

export const telegramSender: AlertSender = {
  async send({ violation, recipient, caption }) {
    const settings = await prisma.telegramSettings.findFirst();
    if (!settings?.isEnabled || !settings.botTokenEncrypted) return { ok: false, skipped: true };

    const client = new TelegramClient(decrypt(settings.botTokenEncrypted));
    let result: TelegramResult;
    try {
      result = await client.sendPhoto(recipient, violation.snapshotUrl, caption);
    } catch (err) {
      result = { ok: false, description: err instanceof Error ? err.message : String(err) };
    }
    return result.ok ? { ok: true } : { ok: false, error: result.description };
  },
};
