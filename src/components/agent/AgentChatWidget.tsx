// SPDX-License-Identifier: MIT
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { canAccessPath } from '@/lib/auth/permissions';
import type { UserRole } from '@/types/enums';
import { Bot, MessageCircle, X } from 'lucide-react';
import { useAskSession } from '@/hooks/use-agent';
import { ChatComposer, ChatThread } from './ChatThread';

const GREETING = 'Xin chào! Em là Trợ lý SafeSight 🤖 Anh/chị cần hỏi gì về camera, vi phạm, cảnh báo hay tình trạng hệ thống?';

// Widget chat nổi góc phải dưới, có mặt trên mọi trang dashboard trừ /agent (trang đó đã có ô hỏi riêng),
// và chỉ cho các vai trò được vào /agent (cùng bảng PAGE_ROLES) — vai trò khác không thấy nút.
// Nằm trong layout nên phiên hỏi đáp giữ nguyên khi đổi trang.
export function AgentChatWidget() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const chat = useAskSession({ subjectType: 'system' });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (pathname.startsWith('/agent') || status !== 'authenticated' || !canAccessPath(session?.user?.role as UserRole | undefined, '/agent')) return null;

  return (
    <div className="print:hidden">
      {open && (
        <section role="dialog" aria-label="Trợ lý SafeSight"
          className="fixed z-[150] bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px] h-[min(560px,calc(100vh-7.5rem))] flex flex-col rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden animate-fade-up">
          <header className="gradient-primary flex items-center gap-2 px-4 py-3 text-white">
            <MessageCircle className="w-5 h-5" aria-hidden />
            <h2 className="text-sm font-bold flex-1">Trợ lý SafeSight</h2>
            <Link href="/agent" aria-label="Mở trang Agent" className="p-1.5 rounded-lg hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <Bot className="w-4 h-4" aria-hidden />
            </Link>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng trợ lý" className="p-1.5 rounded-lg hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              <X className="w-4 h-4" aria-hidden />
            </button>
          </header>
          <ChatThread items={chat.items} greeting={GREETING} working={chat.working} className="flex-1 overflow-y-auto p-4" />
          <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
            <ChatComposer value={chat.text} onChange={chat.setText} onSubmit={chat.submit} disabled={chat.isPending} autoFocus />
            {chat.isError && <p className="text-xs text-[var(--danger)] mt-2">Gửi thất bại, thử lại.</p>}
          </div>
        </section>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} aria-label={open ? 'Đóng trợ lý' : 'Mở trợ lý SafeSight'} aria-expanded={open}
        className="fixed z-[150] bottom-6 right-6 w-14 h-14 rounded-full gradient-primary text-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]">
        {open ? <X className="w-6 h-6" aria-hidden /> : <MessageCircle className="w-6 h-6" aria-hidden />}
      </button>
    </div>
  );
}
