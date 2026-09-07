// SPDX-License-Identifier: MIT
import type { LeasedTask } from './tasks';
import { emit } from './audit';

export interface ToolContext {
  sessionId: string; taskId: string | null; taskKind: string; budget: number;
  spent: { calls: number; escalations: number; followups: number; verdicts: Set<string> };
}

export function newToolContext(task: LeasedTask, sessionId: string): ToolContext {
  return { sessionId, taskId: task.id, taskKind: task.kind, budget: task.budget, spent: { calls: 0, escalations: 0, followups: 0, verdicts: new Set() } };
}

// Bọc thân tool: mọi lỗi bất ngờ (Prisma, đĩa, mạng) thành kết quả JSON {error} + event 'error',
// không bao giờ ném ra runner — model đọc lỗi và đổi hướng thay vì làm chết phiên.
export async function safeRun<T>(ctx: ToolContext, tool: string, fn: () => Promise<T>): Promise<T | string> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, type: 'error', data: { tool, message } });
    return JSON.stringify({ error: `tool ${tool} lỗi: ${message}` });
  }
}
