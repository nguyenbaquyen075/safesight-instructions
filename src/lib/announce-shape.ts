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

/** Câu thông báo mặc định cho một vi phạm — hàm thuần, dùng cho cả API và agent. */
export function announcementFor(
  violation: { type: string },
  camera: { name: string; location?: string | null },
): string {
  const place = camera.location?.trim() || camera.name;
  const action = ACTION_BY_TYPE[violation.type] ?? DEFAULT_ACTION;
  return `Khu vực ${place}, vui lòng ${action}`.slice(0, ANNOUNCE_MAX);
}
