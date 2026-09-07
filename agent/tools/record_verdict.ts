// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { checkPaused } from '../lib/guard';
import { OBSERVATION_KINDS, scoreEvidence, type ObservationKind } from '../lib/evidence';
import { safeRun } from '../lib/tool-context';
import type { ToolContext } from '../lib/tool-context';

export async function applyVerdict(input: { violationId: string; observations: ObservationKind[]; note: string; ctx: ToolContext }) {
  const { violationId, observations, note, ctx } = input;
  const paused = await checkPaused();
  if (paused) return { band: null, verdict: 'undecided' as const, applied: false, statusNow: null, reason: paused.reason };
  if (ctx.spent.verdicts.has(violationId)) return { band: null, verdict: 'undecided' as const, applied: false, statusNow: null, reason: 'phiên này đã phán quyết vi phạm này rồi' };
  const v = await prisma.violation.findUnique({ where: { id: violationId } });
  if (!v) return { band: null, verdict: 'undecided' as const, applied: false, statusNow: null, reason: 'không có vi phạm này' };
  const scored = scoreEvidence(observations);
  const review = { verdict: scored.verdict, band: scored.band, score: scored.score, observations, note, rationale: scored.rationale, sessionId: ctx.sessionId, reviewedAt: new Date().toISOString() };
  let applied = false; let reason: string | undefined;
  const humanOwned = v.status.toUpperCase() !== 'OPEN';
  if (humanOwned) reason = 'trạng thái đang do người đặt (không phải open), agent chỉ ghi nhận xét';
  const data: { agentReview: string; status?: string } = { agentReview: JSON.stringify(review) };
  if (!humanOwned && scored.band === 'VERIFIED' && scored.verdict === 'false_positive') { data.status = 'FALSE_POSITIVE'; applied = true; }
  if (!humanOwned && scored.band === 'VERIFIED' && scored.verdict === 'violation') applied = true; // giữ open, đã xác nhận thật
  await prisma.violation.update({ where: { id: violationId }, data });
  ctx.spent.verdicts.add(violationId);
  await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'violation', subjectId: violationId, type: 'verdict', data: { ...review, applied } });
  const statusNow = (data.status ?? v.status).toLowerCase();
  return { band: scored.band, verdict: scored.verdict, applied, statusNow, reason };
}

export const makeRecordVerdict = (ctx: ToolContext) => betaZodTool({
  name: 'record_verdict',
  description: 'Ghi phán quyết cho một vi phạm bằng những gì bạn QUAN SÁT được (không có điểm tự tin). Ledger tính band: VERIFIED thì hệ thống tự hành động (báo oan → false_positive), thấp hơn thì chỉ ghi nhận xét. Mỗi phiên một lần cho mỗi vi phạm.',
  inputSchema: z.object({
    violationId: z.string(),
    observations: z.array(z.enum(OBSERVATION_KINDS)).min(1).describe('Chỉ những điều thấy trong ảnh/lịch sử. Xem skill evidence.md.'),
    note: z.string().min(10).max(600).describe('Một hai câu cho người đọc: thấy gì, vì sao kết luận vậy.'),
  }),
  run: async ({ violationId, observations, note }) => safeRun(ctx, 'record_verdict', async () => {
    ctx.spent.calls++;
    return JSON.stringify(await applyVerdict({ violationId, observations, note, ctx }));
  }),
});
