// SPDX-License-Identifier: MIT

export interface ZaloResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

const BASE_URL = 'https://openapi.zalo.me';

// Zalo trả { error: 0, message: 'Success', data: … }; error khác 0 là thất bại.
interface ZaloApiResponse {
  error?: number;
  message?: string;
  data?: unknown;
}

async function callZalo(accessToken: string, path: string, init: RequestInit): Promise<ZaloResult> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { ...init.headers, access_token: accessToken },
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json()) as ZaloApiResponse;
    if (body.error && body.error !== 0) {
      return { ok: false, error: `Zalo error ${body.error}: ${body.message ?? 'không rõ'}` };
    }
    if (!res.ok) return { ok: false, error: `Zalo HTTP ${res.status}` };
    return { ok: true, data: body.data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export class ZaloClient {
  constructor(private accessToken: string) {}

  /** Kiểm tra access token: thông tin Official Account đang gắn với token. */
  getOa(): Promise<ZaloResult> {
    return callZalo(this.accessToken, '/v2.0/oa/getoa', { method: 'GET' });
  }

  sendText(userId: string, text: string): Promise<ZaloResult> {
    return this.sendMessage(userId, { text });
  }

  /** `imageUrl` phải là URL công khai (Zalo tự tải ảnh), xem PUBLIC_BASE_URL. */
  sendImage(userId: string, imageUrl: string, caption: string): Promise<ZaloResult> {
    return this.sendMessage(userId, {
      text: caption,
      attachment: {
        type: 'template',
        payload: { template_type: 'media', elements: [{ media_type: 'image', url: imageUrl }] },
      },
    });
  }

  private sendMessage(userId: string, message: Record<string, unknown>): Promise<ZaloResult> {
    return callZalo(this.accessToken, '/v3.0/oa/message/cs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { user_id: userId }, message }),
    });
  }
}
