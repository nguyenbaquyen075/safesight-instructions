'use client';
// SPDX-License-Identifier: MIT


import { useState } from 'react';
import { Users, UserPlus, Search, Filter, ShieldCheck, UserCog, Key } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { UserRole } from '@/types/enums';
import { useUsers } from '@/hooks/use-users';
import { UserTable } from '@/components/users/UserTable';
import { UserEditDialog } from '@/components/users/UserEditDialog';
import { toast } from '@/lib/toast';
import type { User } from '@/types/models';

export default function UsersPage() {
  const [role, setRole] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: session } = useSession();
  const userRole = session?.user?.role as UserRole;
  const isAdmin = userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ORG_ADMIN;

  const { data: users, isLoading } = useUsers(
    role !== 'all' ? { role } : undefined
  );

  const filteredUsers = users?.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const handleSave = (data: any) => {
    console.log('Saving user data:', data);
    // In a real app, this would be a mutation
    setIsDialogOpen(false);
    toast('Đã lưu thông tin người dùng', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quản lý Người dùng</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Cấu hình quyền truy cập hệ thống, vai trò và chính sách bảo mật cho nhóm của bạn.
          </p>
        </div>
        
        {isAdmin && (
          <button
            onClick={() => toast('Đã gửi lời mời người dùng mới (demo)', 'success')}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-lg font-medium transition-all shadow-lg shadow-[var(--primary)]/20 animate-fade-up"
          >
            <UserPlus className="w-4 h-4" />
            Mời Người dùng
          </button>
        )}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up" style={{ animationDelay: '100ms' }}>
         <div className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-xl group hover:border-[var(--primary)]/30 transition-all">
            <div className="flex items-center justify-between mb-3">
               <div className="p-2 rounded-lg bg-[var(--primary-muted)] text-[var(--primary)]">
                  <ShieldCheck className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-bold text-[var(--success)] uppercase tracking-widest">+2 tháng này</span>
            </div>
            <p className="text-sm text-[var(--text-muted)] font-medium">Tổng số Nhân sự</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{users?.length ?? 0}</p>
         </div>

         <div className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-xl group hover:border-[var(--primary)]/30 transition-all">
            <div className="flex items-center justify-between mb-3">
               <div className="p-2 rounded-lg bg-[var(--warning-muted)] text-[var(--warning)]">
                  <Key className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-bold text-[var(--warning)] uppercase tracking-widest">3 đang chờ</span>
            </div>
            <p className="text-sm text-[var(--text-muted)] font-medium">Tuân thủ 2FA</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">
               {Math.round(((users?.filter(u => u.twoFactorEnabled).length ?? 0) / (users?.length ?? 1)) * 100)}%
            </p>
         </div>

         <div className="p-5 bg-[var(--surface)] border border-[var(--border)] rounded-xl group hover:border-[var(--primary)]/30 transition-all">
            <div className="flex items-center justify-between mb-3">
               <div className="p-2 rounded-lg bg-[var(--info-muted)] text-[var(--info)]">
                  <UserCog className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Đang hoạt động</span>
            </div>
            <p className="text-sm text-[var(--text-muted)] font-medium">Phiên hoạt động</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">14</p>
         </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4 p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-fade-up" style={{ animationDelay: '200ms' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email..."
            className="w-full pl-10 pr-4 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-lg">
            <Filter className="w-4 h-4 text-[var(--text-muted)]" />
            <select
              className="bg-transparent border-none text-sm text-[var(--text-primary)] focus:outline-none cursor-pointer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="all">Tất cả Vai trò</option>
              <option value="SUPER_ADMIN">Quản trị viên Cao cấp</option>
              <option value="ORG_ADMIN">Quản trị viên Tổ chức</option>
              <option value="SITE_MANAGER">Quản lý Công trường</option>
              <option value="SAFETY_OFFICER">Cán bộ An toàn</option>
              <option value="SUPERVISOR">Giám sát viên</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <UserTable 
        users={filteredUsers ?? []} 
        onEdit={handleEdit}
        isLoading={isLoading} 
        isAdmin={isAdmin}
      />

      {/* Edit Dialog */}
      <UserEditDialog 
        user={selectedUser}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
