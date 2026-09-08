// SPDX-License-Identifier: MIT
import type { LeasedTask } from './tasks';
import { emit } from './audit';

export interface ToolContext {
  sessionId: string; taskId: string | null; taskKind: string; budget: number;
  // Camera mà phiên này phụ trách (null = phiên toàn hệ thống): quyết định có tool remember_camera hay không.
  cameraId: string | null;
  spent: { calls: number; escalations: number; followups: number; remembers: number; announces: number; verdicts: Set<string> };
}

export function newToolContext(task: LeasedTask, sessionId: string, cameraId: string | null = null): ToolContext {
  return { sessionId, taskId: task.id, taskKind: task.kind, budget: task.budget, cameraId, spent: { calls: 0, escalations: 0, followups: 0, remembers: 0, announces: 0, verdicts: new Set() } };
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
