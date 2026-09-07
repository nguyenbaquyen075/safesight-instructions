// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { checkPaused, LIMITS } from '../lib/guard';
import { notifyViolation } from '@/lib/alert-notifier';
import { escapeHtml, sendOpsAlert } from '../lib/notify';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export const makeEscalate = (ctx: ToolContext) => betaZodTool({
  name: 'escalate',
  description: 'Gửi Telegram theo AlertRule của công trường (tôn trọng threshold/cooldown sẵn có). Với vi phạm: chỉ khi đã record_verdict VERIFIED thật và (occurrenceCount ≥ 2 hoặc severity critical). Với vận hành (không có violationId): gửi tới người nhận vận hành.',
  inputSchema: z.object({
    violationId: z.string().optional(),
    caption: z.string().min(10).max(500).describe('Ngắn, tiếng Việt: camera, món thiếu / sự cố, lần thứ mấy, cần làm gì.'),
  }),
  run: async ({ violationId, caption }) => safeRun(ctx, 'escalate', async () => {
    ctx.spent.calls++;
    const paused = await checkPaused();
    if (paused) return JSON.stringify({ sent: false, blockedReason: paused.reason });
    if (ctx.spent.escalations >= LIMITS.escalatePerSession) return JSON.stringify({ sent: false, blockedReason: 'phiên này đã leo thang đủ số lần' });
    if (!violationId) {
      const r = await sendOpsAlert(caption); ctx.spent.escalations++;
      await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'system', type: 'action', data: { action: 'escalate.ops', ...r, caption } });
      return JSON.stringify({ sent: r.sent, blockedReason: r.reason });
    }
    const v = await prisma.violation.findUnique({ where: { id: violationId }, include: { camera: true } });
    if (!v) return JSON.stringify({ sent: false, blockedReason: 'không có vi phạm này' });
    const review = v.agentReview ? JSON.parse(v.agentReview) : null;
    const verified = review?.band === 'VERIFIED' && review?.verdict === 'violation';
    const serious = v.occurrenceCount >= 2 || v.severity === 'critical';
    if (!verified || !serious) return JSON.stringify({ sent: false, blockedReason: 'chưa đủ điều kiện: cần phán quyết VERIFIED thật và (tái phạm hoặc critical)' });
    const callStart = new Date();
    await notifyViolation(v, v.camera, { caption: escapeHtml(caption) });
    ctx.spent.escalations++;
    // Chỉ tính Alert sinh ra từ lời gọi này (nhiều người nhận -> thành công nếu ít nhất một Alert không lỗi)
    const sent = (await prisma.alert.count({ where: { violationId, sentAt: { gte: callStart }, errorMessage: null } })) > 0;
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'violation', subjectId: violationId, type: 'action', data: { action: 'escalate.violation', sent, caption } });
    return JSON.stringify({ sent, blockedReason: sent ? undefined : 'AlertRule không khớp / cooldown / Telegram lỗi (xem bảng Alert)' });
  }),
});
