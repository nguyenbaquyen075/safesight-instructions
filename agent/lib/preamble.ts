// SPDX-License-Identifier: MIT
import { prisma } from './db';
import { capabilitiesMarkdown } from './capabilities';
import type { LeasedTask } from './tasks';
import type { CameraMemoryNote } from './camera-agent';

async function neighbours(task: LeasedTask): Promise<string> {
  if (task.subjectType === 'violation' && task.subjectId) {
    const v = await prisma.violation.findUnique({ where: { id: task.subjectId }, select: { cameraId: true, siteId: true, occurrenceCount: true, type: true } });
    return v ? `Vi phạm \`${task.subjectId}\` (loại ${v.type}, lần ${v.occurrenceCount}) thuộc camera \`${v.cameraId}\`, công trường \`${v.siteId}\`. Bắt đầu bằng read_violation.` : `Vi phạm \`${task.subjectId}\` không còn trong DB.`;
  }
  if (task.subjectType === 'camera' && task.subjectId) {
    const c = await prisma.camera.findUnique({ where: { id: task.subjectId }, select: { name: true, siteId: true } });
    return c ? `Camera \`${task.subjectId}\` (${c.name}) thuộc công trường \`${c.siteId}\`. Bắt đầu bằng read_camera_history.` : `Camera \`${task.subjectId}\` không còn trong DB.`;
  }
  if (task.subjectType === 'site' && task.subjectId) {
    const s = await prisma.site.findUnique({ where: { id: task.subjectId }, select: { name: true } });
    return s ? `Công trường \`${task.subjectId}\` (${s.name}). Bắt đầu bằng read_site_context.` : `Công trường \`${task.subjectId}\` không còn trong DB.`;
  }
  const sites = await prisma.site.findMany({ select: { id: true, name: true } });
  return `Toàn hệ thống. Công trường: ${sites.map(s => `\`${s.id}\` (${s.name})`).join(', ')}. Bắt đầu bằng read_system_health hoặc read_agent_activity.`;
}

const ORCHESTRATING_KINDS = new Set(['ask', 'shift.report', 'weekly.report', 'ops.escalate']);

const OPENING: Record<string, string> = {
  'violation.review': 'Đây là một lượt review tự động có ngân sách: nhìn ảnh, đọc lịch sử nếu cần, record_verdict, leo thang nếu đủ điều kiện, rồi kết luận ngắn.',
  'camera.instruction': 'Đây là CHỈ DẪN từ agent trưởng cho subagent camera này. Làm đúng việc được giao (lý do ở dưới): đọc lịch sử/vi phạm liên quan, kết luận bằng write_note, leo thang nếu đủ điều kiện, remember_camera nếu học được điều bền. Không record_verdict.',
  'camera.digest': 'Đây là lượt tổng hợp camera: đọc lịch sử 24h/7 ngày, nhận xét xu hướng (write_note), hẹn xem lại nếu cần. Không record_verdict.',
  'shift.report': 'Viết báo cáo ca cho nhóm quản lý: vi phạm thật / báo oan theo camera, sự cố vận hành đã tự xử lý, việc cần người làm. Gửi bằng escalate (không violationId) rồi trả lời lại nội dung báo cáo.',
  'weekly.report': 'Viết báo cáo TUẦN (7 ngày gần nhất) cho ban chỉ huy: theo công trường và camera — vi phạm thật, báo oan, camera báo oan nhiều nhất, việc còn mở, sự cố vận hành đáng chú ý. Dùng search_violations và read_agent_activity để lấy số liệu, gửi bằng escalate (không violationId), rồi trả lời lại bằng bản báo cáo markdown ngắn gọn.',
  'ops.escalate': 'Sự cố vận hành mà trực tự động không xử được. Đọc read_system_health, viết một thông báo dễ hiểu cho admin và gửi bằng escalate (không violationId).',
  'followup': 'Lượt xem lại theo lịch đã hẹn. Lý do hẹn ở dưới. Làm đúng việc đã hẹn rồi kết luận.',
  'ask': 'Đây là HỘI THOẠI với người dùng đang mở dashboard. Trả lời câu hỏi, ngắn, có id khi cần. Không đưa kế hoạch làm việc.',
};

export async function preambleFor(task: LeasedTask, opts: { userMessage?: string; sessionId?: string; cameraId?: string | null; memory?: CameraMemoryNote[] } = {}): Promise<string> {
  const parts = [
    `## Phiên ${task.kind}`, OPENING[task.kind] ?? OPENING['followup'],
    `Lý do: ${task.reason}`, `Ngân sách: ${task.budget} tool call.`,
    '', '## Bản ghi được mở', await neighbours(task),
    '', await capabilitiesMarkdown(),
  ];
  // Phiên của một camera chạy dưới subagent riêng của camera đó: nhắc vai trò và nạp lại trí nhớ đã học.
  if (opts.cameraId) {
    const notes = opts.memory ?? [];
    parts.push(
      '', `## Bạn là subagent phụ trách camera ${opts.cameraId}`,
      'Bạn chỉ chịu trách nhiệm cho camera này. Điều gì BỀN học được về nó (góc máy, giờ ngược sáng, khu vực hay báo oan, việc cần theo dõi) thì ghi bằng remember_camera để phiên sau dùng lại.',
      '', '## Trí nhớ camera',
      ...(notes.length ? notes.map((n, i) => `- #${i} [${n.at.slice(0, 10)}] ${n.text}`) : ['(chưa có ghi chú)']),
    );
  }
  // Phiên toàn hệ thống của các kind điều phối: biết có subagent theo camera và hai tool để xem/giao việc.
  if (!opts.cameraId && ORCHESTRATING_KINDS.has(task.kind)) {
    parts.push(
      '', '## Subagent theo camera',
      'Mỗi camera có một subagent riêng (trí nhớ, trần token, bật/tắt). Bạn là agent trưởng: list_camera_agents để xem trạng thái và ghi chú của từng camera; dispatch_to_camera để giao một việc cụ thể cho subagent của một camera (chỉ dẫn được ghi vào trí nhớ camera đó). Chỉ giao việc khi có lý do rõ ràng, tối đa 3 lần/phiên.',
    );
  }
  // Thread hỏi đáp: nhắc lại tối đa 10 lượt trước đó (không tính câu hỏi hiện tại) để phiên mới có ngữ cảnh.
  // Hợp đồng: câu hỏi hiện tại đã được ghi thành message.user TRƯỚC khi phiên chạy (route /api/agent/ask), nên phần tử cuối là câu hỏi hiện tại và bị bỏ.
  if (task.kind === 'ask' && opts.sessionId) {
    const history = await prisma.agentEvent.findMany({ where: { sessionId: opts.sessionId, type: { in: ['message.user', 'message.assistant'] } }, orderBy: { emittedAt: 'desc' }, take: 11 });
    const earlier = history.reverse().slice(0, -1);
    if (earlier.length > 0) parts.push('', '## Đã trao đổi trước đó (cũ → mới)', ...earlier.map(h => { const d = JSON.parse(h.data); return `${h.type === 'message.user' ? 'Người dùng' : 'Agent'}: ${d.text ?? d.note ?? ''}`; }));
  }
  if (opts.userMessage) parts.push('', '## Câu hỏi của người dùng', opts.userMessage);
  return parts.join('\n');
}
