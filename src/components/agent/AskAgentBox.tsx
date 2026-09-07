// SPDX-License-Identifier: MIT
'use client';
import { useEffect, useMemo, useState } from 'react';
import { Send } from 'lucide-react';
import { useAgentEvents, useAskAgent } from '@/hooks/use-agent';
import { AgentTimeline } from './AgentTimeline';

const QUIET_MS = 90_000;

export function AskAgentBox({ subjectType = 'system', subjectId }: { subjectType?: 'violation' | 'camera' | 'site' | 'system'; subjectId?: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sentAt, setSentAt] = useState<number | null>(null);
  const ask = useAskAgent();
  const { data: events = [] } = useAgentEvents({ sessionId: sessionId ?? undefined, limit: 200 }, { live: sentAt !== null, enabled: !!sessionId });

  const ended = useMemo(() => events.some(e => e.type === 'session.ended' && sentAt !== null && new Date(e.emittedAt).getTime() > sentAt), [events, sentAt]);
  // "Đang trả lời" = đã gửi, chưa thấy session.ended, và chưa im lặng quá 90s. Tick 5s để hết hạn 90s cũng tự tắt poll.
  const [tick, setTick] = useState(0);
  useEffect(() => { if (sentAt === null) return; const t = setInterval(() => setTick(n => n + 1), 5_000); return () => clearInterval(t); }, [sentAt]);
  void tick;
  // eslint-disable-next-line react-hooks/purity -- Date.now() chỉ dùng để tính "còn đang chờ" cho hiển thị; đồng hồ tick 5s đã ép re-render, không phải nguồn state
  const working = sentAt !== null && !ended && Date.now() - sentAt < QUIET_MS;

  useEffect(() => {
    if (sentAt !== null && !working) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tắt poll khi phiên đã xong
      setSentAt(null);
    }
  }, [working, sentAt]);

  const submit = async () => {
    const message = text.trim(); if (!message) return;
    const r = await ask.mutateAsync({ message, subjectType, subjectId, sessionId: sessionId ?? undefined });
    setSessionId(r.sessionId); setSentAt(Date.now()); setText('');
  };

  // session.ended bình thường là nhiễu, nhưng lối ra sớm (stop='skipped') là lời giải thích duy nhất người hỏi nhận được.
  const shown = events.filter(e =>
    ['message.user', 'message.assistant', 'verdict', 'action', 'error'].includes(e.type)
    || (e.type === 'session.ended' && (e.data as { stop?: string }).stop === 'skipped'));
  return (
    <div className="space-y-3">
      <AgentTimeline events={shown} empty="Hỏi agent về camera, vi phạm, hay tình trạng hệ thống." />
      {working && <p className="text-xs text-[var(--text-muted)]">Agent đang trả lời…</p>}
      <div className="flex gap-2">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Ví dụ: cam-003 hôm nay có gì bất thường?"
          className="flex-1 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
        <button onClick={submit} disabled={ask.isPending || !text.trim()} aria-label="Gửi câu hỏi cho agent"
          className="px-4 rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
          <Send className="w-4 h-4" />
        </button>
      </div>
      {ask.isError && <p className="text-xs text-[var(--danger)]">Gửi thất bại, thử lại.</p>}
    </div>
  );
}
