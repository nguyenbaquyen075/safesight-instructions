// SPDX-License-Identifier: MIT

/** Câu loa dài hơn thế này thì người nghe không kịp nhớ, và speechSynthesis đọc lê thê. */
export const ANNOUNCE_MAX = 200;

// Hành động cần làm theo loại vi phạm — câu mệnh lệnh ngắn, đọc lên loa nghe rõ.
const ACTION_BY_TYPE: Record<string, string> = {
  hard_hat: 'đội mũ bảo hộ',
  safety_vest: 'mặc áo phản quang',
  safety_gloves: 'đeo găng tay',
  safety_footwear: 'mang giày bảo hộ',
  zone_intrusion: 'rời khỏi khu vực cấm ngay',
  suspended_load: 'rời khỏi vùng dưới tải treo ngay',
};

const DEFAULT_ACTION = 'tuân thủ quy định an toàn';

/**
 * Câu thông báo mặc định cho một vi phạm — hàm thuần, dùng cho cả API và agent.
 * Lần đầu (occurrenceCount ≤ 1 hoặc không có) là nhắc nhẹ; tái phạm (≥ 2) nói mạnh hơn.
 */
export function announcementFor(
  violation: { type: string; occurrenceCount?: number },
  camera: { name: string; location?: string | null },
): string {
  const place = camera.location?.trim() || camera.name;
  const action = ACTION_BY_TYPE[violation.type] ?? DEFAULT_ACTION;
  if ((violation.occurrenceCount ?? 1) >= 2) {
    const now = action.endsWith(' ngay') ? action : `${action} ngay`; // vùng cấm đã có sẵn "ngay"
    return `Cảnh báo, khu vực ${place}, yêu cầu ${now}`.slice(0, ANNOUNCE_MAX);
  }
  return `Khu vực ${place}, vui lòng ${action}`.slice(0, ANNOUNCE_MAX);
}
