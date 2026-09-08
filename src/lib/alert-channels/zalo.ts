// SPDX-License-Identifier: MIT

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/crypto';
import { ZaloClient } from '@/lib/zalo';
import type { AlertSender } from './index';

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/** Caption gửi Telegram là HTML tối giản (`<b>`, escape `& < > " '`); tin nhắn
 * Zalo là văn bản thuần nên bỏ thẻ và trả lại ký tự gốc. */
export function stripHtml(caption: string): string {
  return caption
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (entity) => ENTITIES[entity]);
}

export const zaloSender: AlertSender = {
  async send({ violation, recipient, caption }) {
    const settings = await prisma.zaloSettings.findFirst();
    if (!settings?.isEnabled || !settings.accessTokenEncrypted) return { ok: false, skipped: true };

    const client = new ZaloClient(decrypt(settings.accessTokenEncrypted));
    const text = stripHtml(caption);
    // Zalo tự tải ảnh nên chỉ gửi kèm được khi có Violation gắn ảnh và hệ thống có URL công khai;
    // cảnh báo vận hành (sendOpsAlert) không có Violation nên luôn là văn bản.
    const base = process.env.PUBLIC_BASE_URL;
    const result = violation && base
      ? await client.sendImage(recipient, new URL(violation.snapshotUrl, base).toString(), text)
      : await client.sendText(recipient, text);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  },
};
