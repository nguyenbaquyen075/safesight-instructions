// SPDX-License-Identifier: MIT
import { prisma } from './db';
import { ensureTask } from './tasks';
import { getAgentSettings } from './settings';

// Bằng @default của CameraAgent.digestEveryMin trong schema: dùng khi camera chưa có dòng subagent.
const DEFAULT_DIGEST_EVERY_MIN = 30;

// Lịch tuần đơn giản kiểu "MON 08:00" (thứ viết tắt tiếng Anh + giờ 24h, giờ địa phương).
// Thuần và tách riêng để test được: trả về mốc kế tiếp SAU now, đúng bằng now thì lùi sang tuần sau.
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function nextWeekly(spec: string, now: Date): Date {
  // Chuỗi hỏng (sửa tay trong DB) không được làm chết vòng lặp: rơi về mặc định MON 08:00.
  const [, day, hh, mm] = /^(SUN|MON|TUE|WED|THU|FRI|SAT) ([01]\d|2[0-3]):([0-5]\d)$/i.exec(spec.trim()) ?? ['', 'MON', '08', '00'];
  const target = WEEKDAYS.indexOf(day.toUpperCase());
  const due = new Date(now);
  due.setDate(due.getDate() + ((target - now.getDay() + 7) % 7));
  due.setHours(Number(hh), Number(mm), 0, 0);
  if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 7);
  return due;
}

// Lưới an toàn mỗi vòng: nếu vì lý do gì (crash giữa chừng, task bị retire) không còn sweep/báo cáo/digest
// đang chờ thì tạo lại. ensureTask không đổi dueAt của task đang chờ, nên không làm nhịp dày hơn.
export async function ensureRecurring(now = new Date()): Promise<void> {
  await ensureTask({ kind: 'health.sweep', subjectType: 'system', reason: 'Quét sức khoẻ định kỳ', dueAt: new Date(now.getTime() + 60_000) });
  const settings = await getAgentSettings();
  const [hh, mm] = settings.shiftReportAt.split(':').map(Number);
  const due = new Date(now); due.setHours(hh, mm, 0, 0);
  if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
  await ensureTask({ kind: 'shift.report', subjectType: 'system', reason: `Báo cáo ca lúc ${settings.shiftReportAt}`, dueAt: due });
  await ensureTask({ kind: 'weekly.report', subjectType: 'system', reason: `Báo cáo tuần lúc ${settings.weeklyReportAt}`, dueAt: nextWeekly(settings.weeklyReportAt, now) });

  // Mỗi camera ONLINE có subagent bật được hẹn một lượt tổng hợp; mốc tính từ digest gần nhất.
  // CHỈ ĐỌC: camera chưa có dòng CameraAgent thì dùng mặc định của schema — dòng đó do runSession
  // tạo lười khi phiên đầu tiên chạy. ensureRecurring chạy mỗi 20s nên không được ghi gì ở đây.
  const cameras = await prisma.camera.findMany({ where: { status: 'ONLINE' }, select: { id: true } });
  for (const camera of cameras) {
    const cameraAgent = await prisma.cameraAgent.findUnique({ where: { id: camera.id } });
    if (cameraAgent && !cameraAgent.isEnabled) continue;
    const from = cameraAgent?.lastDigestAt ?? now;
    await ensureTask({
      kind: 'camera.digest', subjectType: 'camera', subjectId: camera.id,
      reason: 'Tổng hợp định kỳ camera',
      dueAt: new Date(from.getTime() + (cameraAgent?.digestEveryMin ?? DEFAULT_DIGEST_EVERY_MIN) * 60_000),
    });
  }
}
