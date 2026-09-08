// SPDX-License-Identifier: MIT
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './env';
import { prisma } from './db';
import { claudeLatchedOff } from './guard';

export type CapabilityId = 'CLAUDE' | 'TELEGRAM' | 'BRIDGE' | 'ENGINE';

export interface Capability { id: CapabilityId; label: string; gives: string; enabled: boolean; from: string }

async function bridgeUp(): Promise<boolean> {
  try {
    const res = await fetch(`${env.bridgeUrl}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch { return false; }
}

export async function readHeartbeat(): Promise<{ pid: number; at: string; streams: number; fps: number } | null> {
  try {
    const raw = await readFile(path.join(env.snapshotDir, '.heartbeat.json'), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

// DB bận / bảng chưa migrate: coi như không có Telegram, đừng ném ra ngoài (capabilities() chạy lúc khởi động worker).
async function telegramSettings() {
  try {
    return await prisma.telegramSettings.findFirst();
  } catch (error) {
    console.warn('[agent] không đọc được TelegramSettings', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function capabilities(): Promise<Capability[]> {
  const telegram = await telegramSettings();
  const heartbeat = await readHeartbeat();
  const engineFresh = heartbeat ? Date.now() - new Date(heartbeat.at).getTime() < 30_000 : false;
  return [
    { id: 'CLAUDE', from: env.llmProvider === 'openai' ? 'LLM_PROVIDER=openai' : 'ANTHROPIC_API_KEY',
      label: env.llmProvider === 'openai' ? 'LLM (openai)' : 'Claude', enabled: env.llmKey !== null && claudeLatchedOff() === null,
      gives: 'lane nghiên cứu: review vi phạm bằng ảnh, báo cáo ca, trả lời câu hỏi' },
    { id: 'TELEGRAM', from: 'Cài đặt → Thông báo', label: 'Telegram', enabled: !!(telegram?.isEnabled && telegram.botTokenEncrypted),
      gives: 'gửi cảnh báo tới người phụ trách theo AlertRule' },
    { id: 'BRIDGE', from: env.bridgeUrl, label: 'YOLO Bridge', enabled: await bridgeUp(),
      gives: 'biết camera nào đang có detection (sức khoẻ camera)' },
    { id: 'ENGINE', from: 'public/snapshots/.heartbeat.json', label: 'AI engine heartbeat', enabled: engineFresh,
      gives: 'biết AI engine còn chạy, số luồng, fps' },
  ];
}

export function unavailable(id: CapabilityId): { ok: false; configured: false; reason: string } {
  return { ok: false, configured: false,
    reason: `Cài đặt này không có ${id}; nguồn đó không dùng được. Không phải lỗi, thử lại không giúp gì — dùng những gì đã có và nói rõ trong kết luận điều chưa kiểm tra được.` };
}

export async function capabilitiesMarkdown(): Promise<string> {
  const all = await capabilities();
  const on = all.filter(c => c.enabled); const off = all.filter(c => !c.enabled);
  const lines = ['## Khả năng của cài đặt này', ''];
  if (on.length) { lines.push('Đang có:'); for (const c of on) lines.push(`- **${c.label}** — ${c.gives}.`); }
  if (off.length) { lines.push('', 'Không có ở đây, đừng lên kế hoạch dựa vào:'); for (const c of off) lines.push(`- ${c.label}`); }
  return lines.join('\n');
}

export async function logCapabilities(): Promise<void> {
  for (const c of await capabilities()) console.log(`[agent] ${c.enabled ? 'on ' : 'off'}  ${c.label} (${c.from})`);
}
