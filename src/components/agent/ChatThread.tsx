// SPDX-License-Identifier: MIT
'use client';
import { useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import type { ChatItem } from '@/lib/chat-shape';
import { cn } from '@/lib/utils';

// Luồng chat dạng bong bóng: người hỏi bên phải (primary), agent bên trái (surface-elevated),
// verdict/action/lỗi là dòng nhỏ ở giữa. Tự cuộn xuống cuối khi có tin mới.
export function ChatThread({ items, greeting, working, className }: { items: ChatItem[]; greeting?: string; working: boolean; className?: string }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [items.length, working]);
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-live="polite">
      {greeting && <Bubble role="assistant">{greeting}</Bubble>}
      {items.map(i => i.role === 'system'
        ? <p key={i.id} className={cn('text-center text-[11px] px-2 break-words', i.tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]')}>{i.text}</p>
        : <Bubble key={i.id} role={i.role}>{i.text}</Bubble>)}
      {working && <Bubble role="assistant"><span className="text-[var(--text-muted)]">Agent đang trả lời…</span></Bubble>}
      <div ref={endRef} />
    </div>
  );
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words',
      role === 'user' ? 'self-end rounded-br-md bg-[var(--primary)] text-white' : 'self-start rounded-bl-md bg-[var(--surface-elevated)] text-[var(--text-primary)]')}>
      {children}
    </div>
  );
}

// Ô nhập một dòng: Enter gửi, nút gửi có aria-label.
export function ChatComposer({ value, onChange, onSubmit, disabled, placeholder = 'Nhập câu hỏi… (Enter để gửi)', autoFocus }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; disabled?: boolean; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} aria-label="Câu hỏi cho agent"
        className="flex-1 min-w-0 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
      <button type="submit" disabled={disabled || !value.trim()} aria-label="Gửi câu hỏi cho agent"
        className="w-10 h-10 shrink-0 flex items-center justify-center rounded-xl bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">
        <Send className="w-4 h-4" aria-hidden />
      </button>
    </form>
  );
}
