// SPDX-License-Identifier: MIT

import { announce } from '@/lib/announce';
import { announcementFor } from '@/lib/announce-shape';
import type { AlertSender } from './index';

/** Loa công trường: người nhận là id camera đặt loa, bridge phát câu tới thiết bị đang mở /site-speaker. */
export const speakerSender: AlertSender = {
  async send({ violation, camera, recipient }) {
    // Cảnh báo vận hành (sendOpsAlert) không có vi phạm để đọc lên loa — bỏ qua im lặng.
    if (!violation || !camera) return { ok: false, skipped: true };
    const result = await announce(recipient, announcementFor(violation, camera));
    if (!result.ok) return { ok: false, error: result.error };
    // Gửi được nhưng không ai nghe = chưa báo được cho ai: trả lỗi để cooldown không bị khoá.
    if (!result.listeners) return { ok: false, error: 'không có loa nào đang nghe' };
    return { ok: true };
  },
};
