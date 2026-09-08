// SPDX-License-Identifier: MIT
import { prisma } from '../lib/db';
import { emit, newSessionId } from '../lib/audit';
import { runSession, SessionError } from '../session';
import type { SessionClient } from '../session';
import { getCameraAgent, hasActivitySince } from '../lib/camera-agent';
import type { LeasedTask } from '../lib/tasks';

export { SessionError };

export async function runResearch(task: LeasedTask, opts: { sessionId?: string; client?: SessionClient } = {}): Promise<string> {
  if (task.kind === 'ask') {
    const sessionId = opts.sessionId ?? (await prisma.agentTask.findUnique({ where: { id: task.id }, select: { sessionId: true } }))?.sessionId ?? undefined;
    const last = sessionId ? await prisma.agentEvent.findFirst({ where: { sessionId, type: 'message.user' }, orderBy: { emittedAt: 'desc' } }) : null;
    return runSession(task, { sessionId, userMessage: last ? JSON.parse(last.data).text : task.reason, client: opts.client });
  }
  // Tổng hợp định kỳ chỉ đáng mở phiên khi camera có gì mới: không thì đóng task và dời mốc, không tốn token.
  if (task.kind === 'camera.digest' && task.subjectId) {
    const cameraId = task.subjectId;
    const cameraAgent = await getCameraAgent(cameraId);
    if (!(await hasActivitySince(cameraId, cameraAgent.lastDigestAt))) {
      await prisma.cameraAgent.update({ where: { id: cameraId }, data: { lastDigestAt: new Date() } });
      await emit({ sessionId: newSessionId(), taskId: task.id, subjectType: 'camera', subjectId: cameraId, type: 'action', data: { action: 'camera.digest.skipped', reason: 'không có hoạt động mới' } });
      return 'không có hoạt động mới từ digest trước';
    }
    const outcome = await runSession(task, { sessionId: opts.sessionId, client: opts.client });
    await prisma.cameraAgent.update({ where: { id: cameraId }, data: { lastDigestAt: new Date() } });
    return outcome;
  }
  return runSession(task, { sessionId: opts.sessionId, client: opts.client });
}
