// SPDX-License-Identifier: MIT
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { prisma } from '../lib/db';
import { emit } from '../lib/audit';
import { loadSnapshotBase64 } from '../lib/snapshot';
import { safeRun } from '../lib/tool-context';
import { parseJsonOr } from '@/lib/violation-shape';
import { isOverdue } from '@/lib/corrective-action-shape';
import type { ToolContext } from '../lib/tool-context';

export async function violationFacts(id: string) {
  const v = await prisma.violation.findUnique({ where: { id }, include: { camera: true, site: true, actions: { orderBy: { dueAt: 'asc' }, take: 10 } } });
  if (!v) return null;
  return {
    violationId: v.id, cameraId: v.cameraId, cameraName: v.camera.name, siteId: v.siteId, siteName: v.site.name,
    type: v.type, severity: v.severity, confidence: v.confidence, occurrenceCount: v.occurrenceCount,
    status: v.status.toLowerCase(), detectedAt: v.detectedAt.toISOString(),
    bbox: parseJsonOr(v.bboxData, []), snapshotUrl: v.snapshotUrl, clipUrl: v.clipUrl,
    agentReview: parseJsonOr(v.agentReview, null),
    // Việc khắc phục đã giao cho người: agent cần biết để không leo thang lại chuyện đã có
    // người nhận. Trần 10 việc (hạn gần nhất trước) để một vi phạm nhiều việc không phình prompt.
    actions: v.actions.map(a => ({ assigneeName: a.assigneeName, dueAt: a.dueAt.toISOString(), status: a.status, overdue: isOverdue(a) })),
  };
}

export const makeReadViolation = (ctx: ToolContext) => betaZodTool({
  name: 'read_violation',
  description: 'Đọc một vi phạm: ảnh snapshot (khung đỏ quanh người), bbox, loại, mức độ, lần thứ mấy, trạng thái, phán quyết cũ, việc khắc phục đã giao (hạn, còn mở hay quá hạn). Trả về cameraId và siteId để đọc tiếp. Miễn phí, luôn gọi đầu tiên.',
  inputSchema: z.object({ violationId: z.string() }),
  run: async ({ violationId }) => safeRun(ctx, 'read_violation', async () => {
    ctx.spent.calls++;
    const facts = await violationFacts(violationId);
    await emit({ sessionId: ctx.sessionId, taskId: ctx.taskId, subjectType: 'violation', subjectId: violationId, type: 'tool.call', data: { tool: 'read_violation', found: !!facts } });
    if (!facts) return JSON.stringify({ error: 'không có vi phạm này' });
    const image = await loadSnapshotBase64(facts.snapshotUrl);
    // Agent chỉ đọc được ảnh; clip là để NGƯỜI xem, nên chỉ nhắc là có chứ không tải video.
    const text = JSON.stringify({ ...facts, snapshotUrl: undefined })
      + (facts.clipUrl ? '\n(có clip 8s kèm vi phạm này, người quản lý xem trong modal chi tiết)' : '');
    if (!image) return text + '\n(ảnh snapshot không còn trên đĩa)';
    return [
      { type: 'text' as const, text },
      { type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } },
    ];
  }),
});
