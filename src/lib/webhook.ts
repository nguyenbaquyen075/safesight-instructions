// SPDX-License-Identifier: MIT

import { createHmac } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export interface WebhookResult {
  ok: boolean;
  error?: string;
}

/** Chữ ký gửi kèm header `X-SafeSight-Signature`; bên nhận tính lại HMAC-SHA256
 * trên đúng chuỗi body thô để xác thực. */
export function signWebhookBody(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

// SSRF: người tạo quy tắc cảnh báo chọn URL webhook, nên máy chủ không được POST
// vào mạng nội bộ (metadata cloud 169.254.169.254, dịch vụ chỉ nghe localhost...).
const BLOCKED_RANGES = new BlockList();
BLOCKED_RANGES.addSubnet('0.0.0.0', 8);
BLOCKED_RANGES.addSubnet('10.0.0.0', 8);
BLOCKED_RANGES.addSubnet('100.64.0.0', 10); // CGNAT
BLOCKED_RANGES.addSubnet('127.0.0.0', 8);
BLOCKED_RANGES.addSubnet('169.254.0.0', 16); // link-local + metadata
BLOCKED_RANGES.addSubnet('172.16.0.0', 12);
BLOCKED_RANGES.addSubnet('192.168.0.0', 16);
BLOCKED_RANGES.addSubnet('::1', 128, 'ipv6');
BLOCKED_RANGES.addSubnet('fc00::', 7, 'ipv6'); // unique local
BLOCKED_RANGES.addSubnet('fe80::', 10, 'ipv6'); // link-local

/** true = IP thuộc dải nội bộ / loopback / link-local. Chuỗi không phải IP cũng
 * trả true (fail closed: không xác định được thì không gửi). */
export function isPrivateAddress(ip: string): boolean {
  // ::ffff:127.0.0.1 là địa chỉ IPv4 khoác áo IPv6 -> so theo luật IPv4.
  const plain = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1] ?? ip;
  const family = isIP(plain);
  if (family === 0) return true;
  return BLOCKED_RANGES.check(plain, family === 4 ? 'ipv4' : 'ipv6');
}

export async function postWebhook(
  url: string,
  payload: unknown,
  opts: {
    secret?: string;
    fetchImpl?: typeof fetch;
    lookupImpl?: (hostname: string) => Promise<{ address: string }>;
  } = {},
): Promise<WebhookResult> {
  const secret = opts.secret ?? process.env.WEBHOOK_SECRET;
  if (!secret) return { ok: false, error: 'WEBHOOK_SECRET chưa được cấu hình' };

  const doLookup = opts.lookupImpl ?? ((hostname: string) => lookup(hostname));
  try {
    const { address } = await doLookup(new URL(url).hostname);
    if (isPrivateAddress(address)) return { ok: false, error: 'URL webhook trỏ vào dải mạng nội bộ' };
  } catch {
    return { ok: false, error: 'Không phân giải được tên miền webhook' };
  }

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
      // Không đi theo 3xx: đích https hợp lệ vẫn có thể chuyển hướng về địa chỉ
      // nội bộ, và lúc đó kiểm tra dải mạng ở trên là vô nghĩa.
      redirect: 'manual',
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return { ok: false, error: `Webhook HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
