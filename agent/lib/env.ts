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

export const env = {
  agentPort: Number(process.env.AGENT_PORT ?? 4002),
  bridgeUrl: process.env.YOLO_BRIDGE_URL?.trim() || 'http://127.0.0.1:4001',
  bridgeSecret: optional('AGENT_BRIDGE_SECRET'),
  snapshotMaxMb: Number(process.env.SNAPSHOT_MAX_MB ?? 2048),
  anthropicKey: optional('ANTHROPIC_API_KEY'),
  snapshotDir: path.resolve(process.cwd(), 'public', 'snapshots'),
};
