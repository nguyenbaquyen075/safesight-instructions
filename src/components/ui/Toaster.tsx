'use client';
// SPDX-License-Identifier: MIT


import * as React from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ToastKind } from '@/lib/toast';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { message: string; kind: ToastKind };
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message: detail.message, kind: detail.kind }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    };
    window.addEventListener('app-toast', handler);
    return () => window.removeEventListener('app-toast', handler);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[400] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl animate-slide-in-right min-w-[240px] max-w-sm"
        >
          {t.kind === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[var(--success)] flex-shrink-0" />
          ) : t.kind === 'error' ? (
            <XCircle className="w-5 h-5 text-[var(--danger)] flex-shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-[var(--primary)] flex-shrink-0" />
          )}
          <span className="text-sm text-[var(--text-primary)]">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
