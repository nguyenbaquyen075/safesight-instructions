'use client';
// SPDX-License-Identifier: MIT


import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, Search, User, UserCircle, Settings } from 'lucide-react';
import { toast } from '@/lib/toast';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 border-b bg-[var(--background)]/80 backdrop-blur-md border-[var(--border)]">
      {/* Left: Title */}
      <div>
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h1>
        {subtitle && (
          <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div
          onClick={() => toast('Tìm kiếm nhanh sắp ra mắt — hiện dùng ô lọc trong từng trang', 'info')}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] text-sm cursor-pointer hover:border-[var(--primary)] transition-colors"
        >
          <Search className="w-4 h-4" />
          <span>Tìm kiếm...</span>
          <kbd className="ml-4 px-1.5 py-0.5 text-[10px] font-mono rounded border border-[var(--border)] bg-[var(--background)]">
            ⌘K
          </kbd>
        </div>

        {/* Notifications */}
        <button
          id="header-notifications"
          onClick={() => router.push('/alerts')}
          className="relative p-2 rounded-lg hover:bg-[var(--surface)] transition-colors"
          aria-label="Thông báo"
        >
          <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
          <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[var(--danger)] border-2 border-[var(--background)] animate-pulse-live" />
        </button>

        {/* Live Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success-muted)] border border-[var(--success)]/20">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse-live" />
          <span className="text-xs font-medium text-[var(--success)]">TRỰC TIẾP</span>
        </div>

        {/* User Avatar */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              id="header-user-menu"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors focus:outline-none"
              aria-label="Menu người dùng"
            >
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="z-50 min-w-[180px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            >
              <DropdownMenu.Item asChild>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer outline-none"
                >
                  <UserCircle className="w-4 h-4 text-[var(--text-muted)]" />
                  Hồ sơ
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer outline-none"
                >
                  <Settings className="w-4 h-4 text-[var(--text-muted)]" />
                  Cài đặt
                </Link>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
