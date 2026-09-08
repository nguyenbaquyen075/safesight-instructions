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

// Dòng cài đặt có thể do route Next tạo (mặc định schema 'claude-opus-5') trước khi worker chạy.
// Trên endpoint tương thích OpenAI, tên model của Anthropic làm proxy trả 400 -> mọi task nghiên
// cứu chết mà UI không tự sửa được. Nắn về LLM_MODEL_DEFAULT một lần lúc khởi động.
export async function applyModelDefault(): Promise<void> {
  if (env.llmProvider !== 'openai' || !env.llmModelDefault) return;
  const current = await getAgentSettings();
  if (!current.model.startsWith('claude-')) return;
  await prisma.agentSettings.update({ where: { id: AGENT_SETTINGS_ID }, data: { model: env.llmModelDefault } });
  console.log(`[agent] model '${current.model}' không dùng được với LLM_PROVIDER=openai — đổi sang '${env.llmModelDefault}'`);
}
