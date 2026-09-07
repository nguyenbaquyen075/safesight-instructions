// SPDX-License-Identifier: MIT
import { randomUUID } from 'node:crypto';
import { prisma } from './db';

export type EventType =
  | 'tool.call' | 'tool.result' | 'verdict' | 'action' | 'health' | 'error'
  | 'report' | 'message.user' | 'message.assistant' | 'session.started' | 'session.ended';

export interface EmitInput {
  sessionId: string;
  taskId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  type: EventType;
  data: unknown;
}

export function newSessionId(): string {
  return randomUUID();
}

// Không bao giờ ném lỗi: audit hỏng không được làm chết phiên.
export async function emit(input: EmitInput): Promise<void> {
  try {
    await prisma.agentEvent.create({
      data: {
        sessionId: input.sessionId,
        taskId: input.taskId ?? null,
        subjectType: input.subjectType ?? null,
        subjectId: input.subjectId ?? null,
        type: input.type,
        data: JSON.stringify(input.data ?? {}),
      },
    });
  } catch (error) {
    console.warn('[audit] không ghi được event', input.type, error instanceof Error ? error.message : String(error));
  }
}
