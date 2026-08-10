'use client';
// SPDX-License-Identifier: MIT

import { cn } from '@/lib/utils';

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{title}</h2>
      <p className="text-sm text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

export function SettingCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function InputGroup({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
      {children}
      {description && <p className="text-xs text-[var(--text-muted)]">{description}</p>}
    </div>
  );
}

export function Switch({ enabled, onChange, label, description }: { enabled: boolean; onChange: (val: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span>
        {description && <span className="text-xs text-[var(--text-muted)]">{description}</span>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        type="button"
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
          enabled ? "bg-[var(--primary)]" : "bg-[var(--border-subtle)]"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            enabled ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
