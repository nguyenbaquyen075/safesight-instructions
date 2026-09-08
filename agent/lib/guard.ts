// SPDX-License-Identifier: MIT
import { isPaused } from './settings';

export type Blocked = { blocked: true; reason: string };

export const LIMITS = {
  engineRestartPerHour: 3,
  cameraStatusPerCamera5m: 1,
  escalatePerSession: 2,
  followupPerSession: 3,
  rememberPerSession: 3,
} as const;

export async function checkPaused(): Promise<Blocked | null> {
  if (await isPaused()) {
    return { blocked: true, reason: 'Agent đang tạm dừng (AgentSettings.isEnabled = false). Không làm gì, chỉ ghi nhận.' };
  }
  return null;
}

// Key sai / bị thu hồi thì mọi phiên sau đều hỏng như nhau: tắt Claude tới lần khởi động sau thay vì đốt task.
let claudeOffReason: string | null = null;
export function latchClaudeOff(reason: string): void { claudeOffReason = reason; }
export function claudeLatchedOff(): string | null { return claudeOffReason; }

// ponytail: bộ đếm trong bộ nhớ tiến trình — đủ cho một worker; restart worker là reset.
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return false; }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function resetRateLimits(): void { hits.clear(); }
