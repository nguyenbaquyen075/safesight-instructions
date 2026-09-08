// SPDX-License-Identifier: MIT

import { createHmac } from 'node:crypto';

export interface WebhookResult {
  ok: boolean;
  error?: string;
}

/** Chữ ký gửi kèm header `X-SafeSight-Signature`; bên nhận tính lại HMAC-SHA256
 * trên đúng chuỗi body thô để xác thực. */
export function signWebhookBody(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

export async function postWebhook(
  url: string,
  payload: unknown,
  opts: { secret?: string; fetchImpl?: typeof fetch } = {},
): Promise<WebhookResult> {
  const secret = opts.secret ?? process.env.WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: 'WEBHOOK_SECRET chưa được cấu hình' };

  const body = JSON.stringify(payload);
  const doFetch = opts.fetchImpl ?? fetch;
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SafeSight-Signature': signWebhookBody(body, secret),
      },
      body,
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { ok: false, error: `Webhook HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
