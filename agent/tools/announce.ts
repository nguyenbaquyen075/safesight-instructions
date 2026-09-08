// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { checkPaused, LIMITS, rateLimit } from '../lib/guard';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';
import { announce } from '@/lib/announce';
import { ANNOUNCE_MAX } from '@/lib/announce-shape';

const COOLDOWN_MS = 60_000;
// Ngoài phiên review, phán quyết VERIFIED phải còn mới thì loa mới đúng lúc.
const RECENT_REVIEW_MS = 10 * 60_000;
// Chỉ hai kind này mới có record_verdict trong phiên (xem toolsets.ts).
const REVIEW_KINDS = new Set(['violation.review', 'followup']);

function isRealViolation(agentReview: string | null): boolean {
  if (!agentReview) return false;
  try {
    const review = JSON.parse(agentReview);
    return review?.band === 'VERIFIED' && review?.verdict === 'violation';
  } catch { return false; } // JSON hỏng = chưa có phán quyết, không phải lỗi tool
}

// Loa chỉ được phát khi đã có phán quyết VERIFIED "vi phạm thật" cho camera đó: trong phiên
// review là phán quyết của chính phiên này, ngoài phiên review là phán quyết mới trong 10 phút.
async function hasVerifiedViolation(cameraId: string, ctx: ToolContext): Promise<boolean> {
  if (REVIEW_KINDS.has(ctx.taskKind)) {
    if (ctx.spent.verdicts.size === 0) return false;
    const rows = await prisma.violation.findMany({ where: { id: { in: [...ctx.spent.verdicts] }, cameraId }, select: { agentReview: true } });
    return rows.some(r => isRealViolation(r.agentReview));
  }
  // updatedAt đổi mỗi lần ghi agentReview nên lọc thô theo nó rồi mới đọc JSON.
  const rows = await prisma.violation.findMany({
    where: { cameraId, agentReview: { not: null }, updatedAt: { gte: new Date(Date.now() - RECENT_REVIEW_MS) } },
    select: { agentReview: true }, orderBy: { updatedAt: 'desc' }, take: 20,
  });
  return rows.some(r => isRealViolation(r.agentReview));
}

export const makeAnnounce = (ctx: ToolContext) => betaZodTool({
  name: 'announce',
  description: 'Phát một câu nhắc qua loa công trường của camera (thiết bị đang mở trang Loa công trường sẽ đọc lên). Chỉ khi đã có phán quyết VERIFIED "vi phạm thật" cho camera đó. Tối đa 2 lần/phiên, mỗi camera cách nhau 60 giây.',
  inputSchema: z.object({
    cameraId: z.string(),
    text: z.string().min(10).max(ANNOUNCE_MAX).describe('Một câu tiếng Việt, mệnh lệnh ngắn, đọc lên loa nghe rõ. Ví dụ: "Khu vực cổng chính, vui lòng đội mũ bảo hộ".'),
  }),
  run: async ({ cameraId, text }) => safeRun(ctx, 'announce', async () => {
    ctx.spent.calls++;
    const paused = await checkPaused();
    if (paused) return JSON.stringify({ ok: false, blockedReason: paused.reason });
    if (ctx.spent.announces >= LIMITS.announcePerSession) return JSON.stringify({ ok: false, blockedReason: 'phiên này đã phát loa đủ số lần' });
    if (!(await hasVerifiedViolation(cameraId, ctx))) {
      return JSON.stringify({ ok: false, blockedReason: 'chưa có phán quyết VERIFIED "vi phạm thật" cho camera này' });
    }
    if (!rateLimit(`announce:${cameraId}`, 1, COOLDOWN_MS)) {
      return JSON.stringify({ ok: false, blockedReason: 'camera này vừa phát loa, chờ đủ 60 giây' });
    }
    const result = await announce(cameraId, text);
    // Bridge không phát được (down/401) thì không trừ hạn mức phiên: lần thử sau vẫn còn slot.
    if (result.ok) ctx.spent.announces++;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'camera', subjectId: cameraId, type: 'action', data: { action: 'announce', cameraId, text, listeners: result.listeners } });
    return JSON.stringify({ ok: result.ok, listeners: result.listeners, blockedReason: result.error });
  }),
});
