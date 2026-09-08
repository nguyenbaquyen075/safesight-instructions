'use client';
// SPDX-License-Identifier: MIT


import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession, signOut } from 'next-auth/react';
import { UserRole } from '@/types/enums';
import { canAccessPath } from '@/lib/auth/permissions';
import { useOpenViolationCount } from '@/hooks/use-violations';
import { useReadAlertIds } from '@/hooks/use-read-alerts';
import { useSidebar } from './sidebar-context';
import {
  LayoutDashboard,
  Building2,
  Camera,
  Volume2,
  ShieldAlert,
  BarChart3,
  ScanSearch,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Bell,
  LogOut,
  Bot,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Bảng điều khiển', href: '/', icon: LayoutDashboard },
  { label: 'Công trường', href: '/sites', icon: Building2 },
  { label: 'Camera', href: '/cameras', icon: Camera },
  { label: 'Loa công trường', href: '/site-speaker', icon: Volume2 },
  { label: 'Thông báo', href: '/alerts', icon: Bell },
  { label: 'Vi phạm', href: '/violations', icon: ShieldAlert },
  { label: 'Phân tích', href: '/analytics', icon: BarChart3 },
  { label: 'Agent', href: '/agent', icon: Bot },
  { label: 'Kiểm thử Roboflow', href: '/roboflow', icon: ScanSearch },
  { label: 'Người dùng', href: '/users', icon: Users },
  { label: 'Cài đặt', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const { open, setOpen, collapsed, setCollapsed } = useSidebar();
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole;
  const { data: openViolations } = useOpenViolationCount();
  const readIds = useReadAlertIds();

  const filteredNavItems = navItems.filter(item => canAccessPath(userRole, item.href));

  // Badge = vi phạm đang mở trừ những id đã "đánh dấu đã đọc" ở trang /alerts (cùng nguồn READ_ALERTS_KEY).
  const openAlertCount = (openViolations?.openIds ?? []).filter(id => !readIds.has(id)).length;

  // Đóng drawer di động mỗi khi đổi route.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 h-screen flex flex-col border-r transition-all duration-300',
          'bg-[var(--background-secondary)] border-[var(--border)]',
          collapsed ? 'w-[260px] md:w-[68px]' : 'w-[260px]',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex-shrink-0 w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                  SafeSight AI
                </span>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">
                  Giám sát An toàn
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            const currentBadge = item.href === '/alerts' ? openAlertCount : 0;
            const badgeLabel = currentBadge && currentBadge > 99 ? '99+' : currentBadge;

            return (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.label.toLowerCase()}`}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-[var(--primary-muted)] text-[var(--primary-light)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)]'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0',
                    isActive ? 'text-[var(--primary)]' : ''
                  )}
                />
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {!!currentBadge && (
                      <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full bg-[var(--danger)] text-white">
                        {badgeLabel}
                      </span>
                    )}
                  </>
                )}
                {collapsed && !!currentBadge && (
                  <span className="absolute left-12 top-0.5 w-2 h-2 rounded-full bg-[var(--danger)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[var(--border)] space-y-1">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
              "text-[var(--danger)] hover:bg-[var(--danger-muted)]"
            )}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span>Đăng xuất</span>}
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Thu gọn thanh bên</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
