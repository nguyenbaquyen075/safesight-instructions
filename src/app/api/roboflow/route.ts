// SPDX-License-Identifier: MIT

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';

// Cùng workflow với ai-engine/roboflow_workflow.py — lấy từ Roboflow API, không đoán:
//   inputs : image (InferenceImage), KHÔNG có parameter nào khác
//   outputs: predictions (JsonField) -> {"image": {...}, "predictions": [...]}
// Route này tồn tại vì key KHÔNG được lộ ra client; trình duyệt không gọi thẳng Roboflow.
const WORKSPACE_NAME = 'les-workspace-puz7q';
const WORKFLOW_ID = 'detech-ppe-vdetech-ppe-7qydu-vnlwm-1-yolo26n-t2-logic';
const ENDPOINT = `https://serverless.roboflow.com/${WORKSPACE_NAME}/workflows/${WORKFLOW_ID}`;

// Tên output do chính workflow khai báo — đọc theo key này, không đoán tên khác.
const OUTPUT_NAME = 'predictions';

const TIMEOUT_MS = 30_000;
const RETRIES = 2;

// Ảnh base64 ~640px cạnh dài khoảng 60KB; chặn 8MB để một request hỏng không
// nuốt hết RAM server. Client đã thu nhỏ về 640 trước khi gửi.
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

const bodySchema = z.object({
  image: z.string().min(1).max(MAX_BASE64_LENGTH),
});

interface Detection {
  class: string;
  confidence: number;
  bbox: { left: string; top: string; width: string; height: string };
}

/** Bóc detection từ entry kết quả, parse phòng thủ theo key thật của workflow.
 *  bbox trả về dạng phần trăm giống _bbox_pct() trong ppe_tracker.py nên overlay
 *  của CameraCard dùng lại được ngay. Roboflow trả x,y là TÂM box (pixel). */
function parseDetections(entry: Record<string, unknown>): Detection[] {
  const block = (entry?.[OUTPUT_NAME] ?? {}) as Record<string, unknown>;
  const raw = (block.predictions ?? []) as Record<string, number | string>[];
  // Không detect được gì -> Roboflow trả image {"width": null, "height": null}.
  // Đây là ảnh TRẮNG hợp lệ, KHÔNG phải lỗi.
  if (!raw.length) return [];

  const size = (block.image ?? {}) as { width?: number; height?: number };
  const imgW = size.width || 0;
  const imgH = size.height || 0;
  if (!imgW || !imgH) {
    throw new Error('Kết quả thiếu kích thước ảnh, không quy đổi được bbox');
  }

  // Chỉ lấy đúng field cần dùng — bỏ detection_id/parent_id/points cho payload nhẹ.
  return raw.map((p) => {
    const x = Number(p.x ?? 0);
    const y = Number(p.y ?? 0);
    const w = Number(p.width ?? 0);
    const h = Number(p.height ?? 0);
    return {
      class: String(p.class ?? ''),
      confidence: Number(p.confidence ?? 0),
      bbox: {
        left: `${((x - w / 2) / imgW) * 100}%`,
        top: `${((y - h / 2) / imgH) * 100}%`,
        width: `${(w / imgW) * 100}%`,
        height: `${(h / imgH) * 100}%`,
      },
    };
  });
}

/** Gọi workflow 1 lần, thử lại khi lỗi mạng / 429 / 5xx (backoff 1s, 2s).
 *  4xx khác (sai key, ảnh hỏng) fail ngay — thử lại vô ích. */
async function runWorkflow(apiKey: string, base64: string): Promise<Detection[]> {
  const payload = {
    api_key: apiKey,
    inputs: { image: { type: 'base64', value: base64 } },
  };

  for (let attempt = 0; ; attempt++) {
    try {
      const resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (resp.status !== 200) {
        const retryable = resp.status === 429 || resp.status >= 500;
        if (retryable && attempt < RETRIES) {
          await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
          continue;
        }
        // Cắt ngắn body kẻo lộ/nặng log.
        const text = (await resp.text()).slice(0, 300);
        throw new Error(`Roboflow trả ${resp.status}: ${text}`);
      }

      const data = await resp.json();
      const entries = data?.outputs;
      if (!Array.isArray(entries) || !entries.length) {
        throw new Error("Kết quả không có 'outputs' hợp lệ");
      }
      // Gửi 1 ảnh -> lấy entry đầu tiên.
      return parseDetections(entries[0]);
    } catch (err) {
      // Lỗi mạng/timeout còn lượt thì thử lại; lỗi đã ném ở trên thì bay thẳng ra.
      const isNetwork = err instanceof Error && err.name !== 'Error';
      if (isNetwork && attempt < RETRIES) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 1000));
        continue;
      }
      throw err;
    }
  }
}

// Mỗi lần gọi TỐN 1 CREDIT Roboflow -> bắt buộc đăng nhập, không để endpoint mở toang.
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.ROBOFLOW_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Thiếu ROBOFLOW_API_KEY trong .env.local (lấy ở app.roboflow.com/settings/api)' },
      { status: 500 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  // Client gửi data URL ("data:image/jpeg;base64,....") -> Roboflow chỉ nhận phần sau dấu phẩy.
  const base64 = parsed.data.image.replace(/^data:[^;]+;base64,/, '');

  const started = Date.now();
  try {
    const detections = await runWorkflow(apiKey, base64);
    return NextResponse.json({ detections, latencyMs: Date.now() - started });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gọi Roboflow thất bại';
    console.error('[roboflow]', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
