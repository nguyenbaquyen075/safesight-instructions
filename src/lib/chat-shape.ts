// SPDX-License-Identifier: MIT
import type { AgentEventView } from '@/types/agent';

// Phần thuần cho chat với agent: dòng thời gian (eventSummary) và bong bóng chat (toChatItems).
// Không đụng DB/route — chỉ đọc AgentEventView.

export interface ChatItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  tone: 'muted' | 'danger';
  text: string;
  at: string;
}

export function eventSummary(e: AgentEventView): string {
  const d = e.data as Record<string, unknown>;
  switch (e.type) {
    case 'tool.call': return `gọi ${d.tool}`;
    case 'verdict': return `${d.band ?? '—'} · ${d.verdict} · ${d.note ?? ''}`;
    case 'action': return String(d.action ?? '');
    case 'health': return `${d.code}${e.subjectId ? ` (${e.subjectId})` : ''}`;
    case 'error': return String(d.message ?? '');
    case 'message.user': return `👤 ${d.text ?? ''}`;
    case 'message.assistant': return String(d.text ?? d.note ?? '');
    case 'session.started': return `bắt đầu phiên ${d.kind}`;
    case 'session.ended': return d.stop === 'skipped' ? `Không chạy được: ${d.reason}` : `kết thúc (${d.stop ?? ''})`;
    default: return e.type;
  }
}

// session.ended bình thường là nhiễu, nhưng lối ra sớm (stop='skipped') là lời giải thích duy nhất người hỏi nhận được.
export function toChatItems(events: AgentEventView[]): ChatItem[] {
  const out: ChatItem[] = [];
  for (const e of events) {
    const d = e.data as Record<string, unknown>;
    let item: Omit<ChatItem, 'id' | 'at'> | null = null;
    if (e.type === 'message.user') item = { role: 'user', tone: 'muted', text: String(d.text ?? '') };
    else if (e.type === 'message.assistant') item = { role: 'assistant', tone: 'muted', text: String(d.text ?? d.note ?? '') };
    else if (e.type === 'verdict' || e.type === 'action') item = { role: 'system', tone: 'muted', text: eventSummary(e) };
    else if (e.type === 'error' || (e.type === 'session.ended' && d.stop === 'skipped')) item = { role: 'system', tone: 'danger', text: eventSummary(e) };
    if (item && item.text.trim()) out.push({ id: e.id, at: e.emittedAt, ...item });
  }
  return out;
}

export const QUIET_MS = 90_000;

// Trạng thái một lượt hỏi: "đang trả lời" = đã gửi, chưa thấy session.ended SAU lúc gửi, và chưa im lặng quá 90s.
export function askProgress({ sentAt, events, now }: { sentAt: number | null; events: AgentEventView[]; now: number }): { ended: boolean; working: boolean } {
  if (sentAt === null) return { ended: false, working: false };
  const ended = events.some(e => e.type === 'session.ended' && new Date(e.emittedAt).getTime() > sentAt);
  return { ended, working: !ended && now - sentAt < QUIET_MS };
}
