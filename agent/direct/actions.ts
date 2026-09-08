// SPDX-License-Identifier: MIT
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { LIMITS, rateLimit } from '../lib/guard';
import { PRIORITY, scheduleTask } from '../lib/tasks';
import { sendOpsAlert } from '../lib/notify';
import type { Finding } from './health';

export interface ActionContext { sessionId: string; taskId: string; repeats: Map<string, number>; paused: boolean }

const OPS_ALERT_AFTER = 3;

async function setCameraStatus(cameraId: string, status: 'ONLINE' | 'DEGRADED' | 'OFFLINE'): Promise<boolean> {
  // Đọc trước: camera đã đúng trạng thái thì không phải hành động, và không được tiêu suất rate-limit —
  // nếu không, một lần "đổi" vô ích sẽ chặn lần đổi thật trong 5 phút kế tiếp.
  const current = await prisma.camera.findUnique({ where: { id: cameraId }, select: { status: true } });
  if (!current || current.status === status) return false;
  if (!rateLimit(`camera-status:${cameraId}`, LIMITS.cameraStatusPerCamera5m, 5 * 60_000)) return false;
  const { count } = await prisma.camera.updateMany({ where: { id: cameraId, NOT: { status } }, data: { status } });
  return count > 0; // đã ở trạng thái đó rồi thì không tính là hành động
}

export async function applyFindings(findings: Finding[], ctx: ActionContext): Promise<string[]> {
  const done: string[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    const mine: string[] = [];
    const key = `${f.code}:${f.subjectId ?? 'system'}`;
    seen.add(key);
    const repeats = (ctx.repeats.get(key) ?? 0) + 1;
    ctx.repeats.set(key, repeats);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: f.subjectType, subjectId: f.subjectId, type: 'health', data: { ...f, repeats } });
    if (ctx.paused) continue;

    switch (f.code) {
      case 'camera.stalled': {
        const status = f.detail.offline ? 'OFFLINE' : 'DEGRADED';
        if (await setCameraStatus(f.subjectId!, status)) { done.push(`${f.subjectId} → ${status}`); mine.push(`${f.subjectId} → ${status}`); }
        break;
      }
      case 'camera.recovered': {
        if (await setCameraStatus(f.subjectId!, 'ONLINE')) { done.push(`${f.subjectId} → ONLINE`); mine.push(`${f.subjectId} → ONLINE`); }
        break;
      }
      case 'engine.stalled': {
        const pid = Number(f.detail.pid);
        // pid đã xác nhận không còn là tiến trình engine (chết, hoặc bị hệ điều hành tái sử
        // dụng cho tiến trình khác) -> không có gì để SIGTERM, và không được tiêu suất rate-limit.
        if (f.detail.pidAlive !== true || !Number.isFinite(pid) || pid <= 1) break;
        if (rateLimit('engine-restart', LIMITS.engineRestartPerHour, 3_600_000)) {
          try { process.kill(pid, 'SIGTERM'); done.push(`SIGTERM AI engine pid ${pid} (dev-all.sh tự chạy lại)`); mine.push(`SIGTERM AI engine pid ${pid} (dev-all.sh tự chạy lại)`); } catch { /* pid đã chết */ }
        }
        break;
      }
      case 'disk.pressure': {
        await scheduleTask({ kind: 'snapshot.cleanup', subjectType: 'system', reason: `Ảnh vi phạm ${Math.round(Number(f.detail.bytes) / 1048576)}MB vượt trần ${f.detail.maxMb}MB`, dueAt: new Date(), priority: PRIORITY['snapshot.cleanup'] });
        done.push('xếp lịch dọn ảnh'); mine.push('xếp lịch dọn ảnh');
        break;
      }
      case 'bridge.down':
      case 'model.missing': break; // chỉ leo thang khi lặp (bên dưới)
    }

    if (repeats === OPS_ALERT_AFTER || (f.code === 'model.missing' && repeats === 1)) {
      const text = `🛠 SafeSight agent: ${f.code}${f.subjectId ? ` (${f.subjectId})` : ''} lặp ${repeats} lần. ${JSON.stringify(f.detail)}`;
      const r = await sendOpsAlert(text);
      await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: f.subjectType, subjectId: f.subjectId, type: 'action', data: { action: 'ops.telegram', sent: r.sent, reason: r.reason } });
      await scheduleTask({ kind: 'ops.escalate', subjectType: f.subjectType, subjectId: f.subjectId, reason: `${f.code} lặp ${repeats} lần, không tự xử được`, dueAt: new Date(), priority: PRIORITY['ops.escalate'] });
      done.push(`leo thang ${f.code}`); mine.push(`leo thang ${f.code}`);
    }
    for (const a of mine) await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: f.subjectType, subjectId: f.subjectId, type: 'action', data: { action: a, code: f.code } });
  }
  for (const key of [...ctx.repeats.keys()]) if (!seen.has(key)) ctx.repeats.delete(key); // hết lỗi thì reset đếm
  return done;
}
