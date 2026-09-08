'use client';
// SPDX-License-Identifier: MIT


import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ShieldAlert } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context';
import { Toaster } from '@/components/ui/Toaster';
import { canAccessPath } from '@/lib/auth/permissions';
import { UserRole } from '@/types/enums';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const userRole = session?.user?.role as UserRole | undefined;
  const allowed = status !== 'authenticated' || canAccessPath(userRole, pathname);

  React.useEffect(() => {
    if (status === 'authenticated' && !allowed) {
      router.replace('/');
    }
  }, [status, allowed, router]);

  const getHeaderInfo = () => {
    if (pathname === '/') return { title: 'Bảng điều khiển Quản trị', subtitle: 'Tổng quan giám sát an toàn thời gian thực' };
    if (pathname.startsWith('/sites')) return { title: 'Hoạt động Công trường', subtitle: 'Quản lý an toàn công trường xây dựng' };
    if (pathname.startsWith('/cameras')) return { title: 'Quản lý Camera', subtitle: 'Cấu hình và giám sát luồng video' };
    if (pathname.startsWith('/alerts')) return { title: 'Trung tâm Thông báo', subtitle: 'Xem và xác nhận thông báo' };
    if (pathname.startsWith('/violations')) return { title: 'Nhật ký Vi phạm', subtitle: 'Kiểm tra và giải quyết vi phạm an toàn' };
    if (pathname.startsWith('/analytics')) return { title: 'Phân tích An toàn', subtitle: 'Xu hướng tuân thủ và báo cáo' };
    if (pathname.startsWith('/reports')) return { title: 'Báo cáo Vi phạm', subtitle: 'Tổng hợp theo camera, xuất CSV/PDF và báo cáo tuần của agent' };
    if (pathname.startsWith('/agent')) return { title: 'Agent giám sát', subtitle: 'Trực vận hành và cán bộ an toàn tự động' };
    if (pathname.startsWith('/users')) return { title: 'Quản lý Người dùng', subtitle: 'Phân quyền và kiểm soát truy cập' };
    if (pathname.startsWith('/settings')) return { title: 'Cài đặt', subtitle: 'Cấu hình cá nhân và hệ thống' };
    if (pathname.startsWith('/profile')) return { title: 'Hồ sơ Cá nhân', subtitle: 'Thông tin tài khoản và đổi mật khẩu' };
    return { title: 'SafeSight AI', subtitle: 'Nền tảng An toàn Xây dựng' };
  };

  const { title, subtitle } = getHeaderInfo();

  return (
    <SidebarProvider>
      <DashboardShell title={title} subtitle={subtitle} allowed={allowed}>
        {children}
      </DashboardShell>
    </SidebarProvider>
  );
}

function DashboardShell({
  title,
  subtitle,
  allowed,
  children,
}: {
  title: string;
  subtitle: string;
  allowed: boolean;
  children: React.ReactNode;
}) {
  const { collapsed } = useSidebar();

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <div
        className={cn(
          'flex-1 flex flex-col transition-all duration-300 ml-0 print:ml-0',
          collapsed ? 'md:ml-[68px]' : 'md:ml-[260px]'
        )}
      >
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 p-6 overflow-y-auto">
          {allowed ? children : (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-[var(--text-muted)]">
              <ShieldAlert className="w-8 h-8 text-[var(--danger)]" />
              <p className="text-sm font-bold">Bạn không có quyền xem trang này</p>
              <p className="text-xs">Đang chuyển về Bảng điều khiển...</p>
            </div>
          )}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
