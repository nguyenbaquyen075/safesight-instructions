// SPDX-License-Identifier: MIT
import { Activity, AlertCircle, MessageSquare, ShieldAlert, ShieldCheck, Terminal, Zap, FileText } from 'lucide-react';
import type { AgentEventView } from '@/types/agent';

const ICON: Record<string, React.ElementType> = { 'tool.call': Terminal, verdict: ShieldCheck, action: Zap, health: Activity, error: AlertCircle, 'message.user': MessageSquare, 'message.assistant': MessageSquare, report: FileText };

function summary(e: AgentEventView): string {
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

export function AgentTimeline({ events, empty = 'Chưa có hoạt động nào.' }: { events: AgentEventView[]; empty?: string }) {
  if (events.length === 0) return <p className="text-sm text-[var(--text-muted)] py-6 text-center">{empty}</p>;
  return (
    <ol className="space-y-2">
      {events.map(e => {
        const Icon = e.type === 'verdict' && (e.data as { verdict?: string }).verdict === 'violation' ? ShieldAlert : ICON[e.type] ?? Activity;
        return (
          <li key={e.id} className="flex items-start gap-3 text-sm">
            <span className="font-mono text-[10px] text-[var(--text-muted)] pt-1 shrink-0">{new Date(e.emittedAt).toLocaleTimeString('vi-VN')}</span>
            <Icon className={e.type === 'error' ? 'w-4 h-4 text-[var(--danger)] shrink-0 mt-0.5' : 'w-4 h-4 text-[var(--text-secondary)] shrink-0 mt-0.5'} aria-hidden />
            <span className="text-[var(--text-primary)] break-words">{summary(e)}</span>
          </li>
        );
      })}
    </ol>
  );
}
