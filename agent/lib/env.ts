// SPDX-License-Identifier: MIT
import { config } from 'dotenv';
import path from 'node:path';

// .env.local ghi đè .env — giống thứ tự Next.js đọc. Chạy một lần khi import.
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });

function optional(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

// Provider LLM: 'anthropic' (SDK Messages) hoặc 'openai' (proxy tương thích /chat/completions).
const llmProvider: 'anthropic' | 'openai' = optional('LLM_PROVIDER') === 'openai' ? 'openai' : 'anthropic';
const llmKey = optional('LLM_API_KEY') ?? optional('ANTHROPIC_API_KEY');

export const env = {
  agentPort: Number(process.env.AGENT_PORT ?? 4002),
  bridgeUrl: process.env.YOLO_BRIDGE_URL?.trim() || 'http://127.0.0.1:4001',
  bridgeSecret: optional('AGENT_BRIDGE_SECRET'),
  snapshotMaxMb: Number(process.env.SNAPSHOT_MAX_MB ?? 2048),
  llmProvider,
  llmBaseUrl: optional('LLM_BASE_URL') ?? optional('ANTHROPIC_BASE_URL'),
  llmKey,
  llmModelDefault: optional('LLM_MODEL_DEFAULT'),
  // Nhiều proxy tương thích OpenAI không nhận ảnh: mặc định bỏ ảnh, bật lại bằng LLM_IMAGE_INPUT=true.
  llmImageInput: optional('LLM_IMAGE_INPUT') === 'true',
  // Tên cũ, giữ để không phải sửa nơi khác.
  anthropicKey: llmKey,
  snapshotDir: path.resolve(process.cwd(), 'public', 'snapshots'),
};
