// SPDX-License-Identifier: MIT
import type { AgentSettings } from '@prisma/client';
import { prisma } from './db';
import { env } from './env';

// Một dòng duy nhất, id cố định: upsert là atomic nên hai lời gọi đồng thời lần đầu không tạo hai dòng.
export const AGENT_SETTINGS_ID = 'agent-settings';

export async function getAgentSettings(): Promise<AgentSettings> {
  return prisma.agentSettings.upsert({ where: { id: AGENT_SETTINGS_ID }, update: {}, create: { id: AGENT_SETTINGS_ID, ...(env.llmModelDefault ? { model: env.llmModelDefault } : {}) } });
}

export async function isPaused(): Promise<boolean> {
  return !(await getAgentSettings()).isEnabled;
}
