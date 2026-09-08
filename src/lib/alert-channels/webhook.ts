// SPDX-License-Identifier: MIT

import type { Camera, Violation } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { postWebhook } from '@/lib/webhook';
import { stripHtml } from './zalo';
import type { AlertSender } from './index';

/** Body gửi đi. Chỉ đưa trường mô tả vi phạm — KHÔNG gửi `camera.rtspUrl` vì
 * chuỗi này chứa tài khoản/mật khẩu camera và bên nhận là hệ thống ngoài. */
export function buildWebhookPayload(
  { violation, camera }: { violation: Violation; camera: Camera },
  site: { id: string; name: string } | null,
) {
  return {
    event: 'violation' as const,
    violation: {
      id: violation.id,
      type: violation.type,
      severity: violation.severity,
      status: violation.status,
      confidence: violation.confidence,
      occurrenceCount: violation.occurrenceCount,
      detectedAt: violation.detectedAt.toISOString(),
    },
    camera: { id: camera.id, name: camera.name, location: camera.location },
    site: site ?? { id: camera.siteId, name: '' },
    snapshotUrl: absoluteUrl(violation.snapshotUrl),
  };
}

function absoluteUrl(snapshotUrl: string): string {
  const base = process.env.PUBLIC_BASE_URL;
  return base ? new URL(snapshotUrl, base).toString() : snapshotUrl;
}

export const webhookSender: AlertSender = {
  async send(input) {
    if (!process.env.WEBHOOK_SECRET) {
      console.warn('[webhook] bỏ qua: WEBHOOK_SECRET chưa được cấu hình');
      return { ok: false, skipped: true };
    }
    // Cảnh báo vận hành (sendOpsAlert) không gắn Violation/Camera nên gửi payload rút gọn.
    if (!input.violation || !input.camera) {
      return postWebhook(input.recipient, { event: 'ops' as const, caption: stripHtml(input.caption) });
    }
    const site = await prisma.site.findUnique({
      where: { id: input.camera.siteId },
      select: { id: true, name: true },
    });
    return postWebhook(input.recipient, buildWebhookPayload({ violation: input.violation, camera: input.camera }, site));
  },
};
