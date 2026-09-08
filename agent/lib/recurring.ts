// SPDX-License-Identifier: MIT
import { prisma } from './db';
import { ensureTask } from './tasks';
import { getAgentSettings } from './settings';
import { getCameraAgent } from './camera-agent';

// Lưới an toàn mỗi vòng: nếu vì lý do gì (crash giữa chừng, task bị retire) không còn sweep/báo cáo/digest
// đang chờ thì tạo lại. ensureTask không đổi dueAt của task đang chờ, nên không làm nhịp dày hơn.
export async function ensureRecurring(now = new Date()): Promise<void> {
  await ensureTask({ kind: 'health.sweep', subjectType: 'system', reason: 'Quét sức khoẻ định kỳ', dueAt: new Date(now.getTime() + 60_000) });
  const settings = await getAgentSettings();
  const [hh, mm] = settings.shiftReportAt.split(':').map(Number);
  const due = new Date(now); due.setHours(hh, mm, 0, 0);
  if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
  await ensureTask({ kind: 'shift.report', subjectType: 'system', reason: `Báo cáo ca lúc ${settings.shiftReportAt}`, dueAt: due });

  // Mỗi camera ONLINE có subagent bật được hẹn một lượt tổng hợp; mốc tính từ digest gần nhất.
  const cameras = await prisma.camera.findMany({ where: { status: 'ONLINE' }, select: { id: true } });
  for (const camera of cameras) {
    const cameraAgent = await getCameraAgent(camera.id, now);
    if (!cameraAgent.isEnabled) continue;
    const from = cameraAgent.lastDigestAt ?? now;
    await ensureTask({
      kind: 'camera.digest', subjectType: 'camera', subjectId: camera.id,
      reason: 'Tổng hợp định kỳ camera',
      dueAt: new Date(from.getTime() + cameraAgent.digestEveryMin * 60_000),
    });
  }
}
