// SPDX-License-Identifier: MIT
import { prisma } from '../lib/db';
import { runSession, SessionError } from '../session';
import type { LeasedTask } from '../lib/tasks';

export { SessionError };

export async function runResearch(task: LeasedTask, opts: { sessionId?: string } = {}): Promise<string> {
  if (task.kind === 'ask') {
    const sessionId = opts.sessionId ?? (await prisma.agentTask.findUnique({ where: { id: task.id }, select: { sessionId: true } }))?.sessionId ?? undefined;
    const last = sessionId ? await prisma.agentEvent.findFirst({ where: { sessionId, type: 'message.user' }, orderBy: { emittedAt: 'desc' } }) : null;
    return runSession(task, { sessionId, userMessage: last ? JSON.parse(last.data).text : task.reason });
  }
  return runSession(task);
}
