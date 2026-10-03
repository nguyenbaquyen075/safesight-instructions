// SPDX-License-Identifier: MIT

import type { Camera, Violation } from '@prisma/client';
import { announce, type AnnounceResult } from '@/lib/announce';
import { announcementFor } from '@/lib/announce-shape';

/**
 * Engine vừa chốt một vi phạm (thiếu liên tục ≥ 3s) -> loa của chính camera đó tự đọc.
 * Mặc định bật, không cần AlertRule; AUTO_ANNOUNCE=false là công tắc tắt khẩn.
 * Cooldown theo camera nằm ở bridge (xem yolo_bridge.js), không phải ở đây.
 * Không bao giờ ném lỗi: loa hỏng không được làm hỏng việc ghi vi phạm.
 */
export async function autoAnnounce(violation: Violation, camera: Camera): Promise<AnnounceResult | null> {
  if (process.env.AUTO_ANNOUNCE?.trim().toLowerCase() === 'false') return null;
  const result = await announce(camera.id, announcementFor(violation, camera));
  // Cooldown là chuyện bình thường; chỉ ồn khi hạ tầng loa thật sự trục trặc.
  if (!result.ok && !result.throttled) console.warn(`[loa] không phát được tại ${camera.id}: ${result.error}`);
  return result;
}
