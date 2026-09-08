// SPDX-License-Identifier: MIT

// Phía máy chủ (route Next + worker agent): đẩy một câu loa qua YOLO Bridge, bridge
// phát sự kiện 'voice-announce' cho các thiết bị đang mở /site-speaker của camera đó.
// Không dùng ở trình duyệt: AI_ENGINE_SECRET không được lộ ra client.

export interface AnnounceResult {
  ok: boolean;
  /** Số thiết bị loa đang nghe camera này (0 = gửi được nhưng không ai nghe). */
  listeners?: number;
  error?: string;
}

// YOLO_BRIDGE_URL cho phía máy chủ (mạng nội bộ / container), NEXT_PUBLIC_YOLO_SERVER_URL
// là địa chỉ trình duyệt dùng — chấp cả hai để dev một máy không phải khai báo thêm biến.
function bridgeUrl(): string {
  return process.env.YOLO_BRIDGE_URL?.trim()
    || process.env.NEXT_PUBLIC_YOLO_SERVER_URL?.trim()
    || 'http://127.0.0.1:4001';
}

export async function announce(cameraId: string, text: string): Promise<AnnounceResult> {
  const secret = process.env.AI_ENGINE_SECRET?.trim();
  try {
    const res = await fetch(`${bridgeUrl()}/announce`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(secret ? { 'x-ai-engine-secret': secret } : {}) },
      body: JSON.stringify({ cameraId, text }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, error: `bridge trả mã ${res.status}` };
    const data = await res.json().catch(() => ({}));
    return { ok: true, listeners: Number(data?.listeners ?? 0) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
