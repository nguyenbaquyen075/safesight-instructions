// SPDX-License-Identifier: MIT
'use client';
import { useAskSession, type AskSubjectType } from '@/hooks/use-agent';
import { ChatComposer, ChatThread } from './ChatThread';

// Ô hỏi đáp nhúng (trang /agent, tab Agent trong modal): cùng bộ máy với widget nổi, chỉ khác khung.
export function AskAgentBox({ subjectType = 'system', subjectId }: { subjectType?: AskSubjectType; subjectId?: string }) {
  const chat = useAskSession({ subjectType, subjectId });
  return (
    <div className="space-y-3">
      {chat.items.length === 0 && !chat.working
        ? <p className="text-sm text-[var(--text-muted)] py-4 text-center">Hỏi agent về camera, vi phạm, hay tình trạng hệ thống.</p>
        : <ChatThread items={chat.items} working={chat.working} className="max-h-80 overflow-y-auto pr-1" />}
      <ChatComposer value={chat.text} onChange={chat.setText} onSubmit={chat.submit} disabled={chat.isPending} placeholder="Ví dụ: cam-003 hôm nay có gì bất thường?" />
      {chat.isError && <p className="text-xs text-[var(--danger)]">Gửi thất bại, thử lại.</p>}
    </div>
  );
}
