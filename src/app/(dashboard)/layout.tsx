'use client';
// SPDX-License-Identifier: MIT


import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Toaster } from '@/components/ui/Toaster';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const getHeaderInfo = () => {
    if (pathname === '/') return { title: 'Bảng điều khiển Quản trị', subtitle: 'Tổng quan giám sát an toàn thời gian thực' };
    if (pathname.startsWith('/sites')) return { title: 'Hoạt động Công trường', subtitle: 'Quản lý an toàn công trường xây dựng' };
    if (pathname.startsWith('/cameras')) return { title: 'Quản lý Camera', subtitle: 'Cấu hình và giám sát luồng video' };
    if (pathname.startsWith('/alerts')) return { title: 'Trung tâm Thông báo', subtitle: 'Xem và xác nhận thông báo' };
    if (pathname.startsWith('/violations')) return { title: 'Nhật ký Vi phạm', subtitle: 'Kiểm tra và giải quyết vi phạm an toàn' };
    if (pathname.startsWith('/analytics')) return { title: 'Phân tích An toàn', subtitle: 'Xu hướng tuân thủ và báo cáo' };
    if (pathname.startsWith('/users')) return { title: 'Quản lý Người dùng', subtitle: 'Phân quyền và kiểm soát truy cập' };
    if (pathname.startsWith('/settings')) return { title: 'Cài đặt', subtitle: 'Cấu hình cá nhân và hệ thống' };
    return { title: 'SafeSight AI', subtitle: 'Nền tảng An toàn Xây dựng' };
  };

  const { title, subtitle } = getHeaderInfo();

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar />
      <div className="flex-1 ml-[260px] flex flex-col transition-all duration-300">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}
