'use client';
// SPDX-License-Identifier: MIT


import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession, signOut } from 'next-auth/react';
import { UserRole } from '@/types/enums';
import {
  LayoutDashboard,
  Building2,
  Camera,
  Volume2,
  ShieldAlert,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Bell,
  LogOut,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Bảng điều khiển', href: '/', icon: LayoutDashboard },
  { label: 'Công trường', href: '/sites', icon: Building2 },
  { label: 'Camera', href: '/cameras', icon: Camera },
  { label: 'Loa công trường', href: '/site-speaker', icon: Volume2 },
  { label: 'Thông báo', href: '/alerts', icon: Bell, badge: 11 },
  { label: 'Vi phạm', href: '/violations', icon: ShieldAlert },
  { label: 'Phân tích', href: '/analytics', icon: BarChart3 },
  { label: 'Người dùng', href: '/users', icon: Users },
  { label: 'Cài đặt', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [alertCount, setAlertCount] = useState(11); // Initial mock count
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole;

  const filteredNavItems = navItems.filter(item => 
    !item.adminOnly || 
    userRole === UserRole.SUPER_ADMIN || 
    userRole === UserRole.ORG_ADMIN
  );

  useEffect(() => {
    const updateCount = () => {
      const customAlerts = JSON.parse(localStorage.getItem('safesight_alerts') || '[]');
      setAlertCount(11 + customAlerts.length);
    };

    updateCount();
    window.addEventListener('storage', updateCount);
    window.addEventListener('new-alert', updateCount);
    
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('new-alert', updateCount);
    };
  }, []);

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col border-r transition-all duration-300',
        'bg-[var(--background-secondary)] border-[var(--border)]',
        collapsed ? 'w-[68px]' : 'w-[260px]'
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
          const currentBadge = item.label === 'Thông báo' ? alertCount : item.badge;

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
                  {currentBadge && (
                    <span className="flex-shrink-0 px-2 py-0.5 text-xs font-semibold rounded-full bg-[var(--danger)] text-white">
                      {currentBadge}
                    </span>
                  )}
                </>
              )}
              {collapsed && currentBadge && (
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
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] transition-colors"
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
  );
}
