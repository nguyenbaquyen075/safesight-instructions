'use client';
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { User, Mail, Shield, KeyRound } from 'lucide-react';
import { UserRole } from '@/types/enums';
import { useChangePassword } from '@/hooks/use-users';
import { toast } from '@/lib/toast';
import { SectionHeader, SettingCard, InputGroup } from '@/components/settings/ui';

const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: 'Quản trị viên Cao cấp',
  [UserRole.ORG_ADMIN]: 'Quản trị viên Tổ chức',
  [UserRole.SITE_MANAGER]: 'Quản lý Công trường',
  [UserRole.SAFETY_OFFICER]: 'Cán bộ An toàn',
  [UserRole.SUPERVISOR]: 'Giám sát viên',
};

export default function ProfilePage() {
  const { data: session } = useSession();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const role = session?.user?.role as UserRole | undefined;

  const handleSubmit = () => {
    if (newPassword.length < 8) {
      toast('Mật khẩu mới phải có ít nhất 8 ký tự', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('Xác nhận mật khẩu mới không khớp', 'error');
      return;
    }
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast('Đã đổi mật khẩu', 'success');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
        onError: (err) => toast(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại', 'error'),
      }
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Hồ sơ Cá nhân</h1>
        <p className="text-sm text-[var(--text-muted)]">Thông tin tài khoản và đổi mật khẩu đăng nhập.</p>
      </div>

      <SettingCard>
        <SectionHeader title="Thông tin Tài khoản" description="Do quản trị viên thiết lập, chỉ xem." />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <InputGroup label="Họ và Tên">
            <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)]">
              <User className="w-4 h-4 text-[var(--text-muted)]" />
              {session?.user?.name ?? '—'}
            </div>
          </InputGroup>
          <InputGroup label="Email">
            <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)]">
              <Mail className="w-4 h-4 text-[var(--text-muted)]" />
              {session?.user?.email ?? '—'}
            </div>
          </InputGroup>
          <InputGroup label="Vai trò">
            <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)]">
              <Shield className="w-4 h-4 text-[var(--text-muted)]" />
              {role ? ROLE_LABELS[role] : '—'}
            </div>
          </InputGroup>
        </div>
      </SettingCard>

      <SettingCard>
        <SectionHeader title="Đổi Mật khẩu" description="Nhập mật khẩu hiện tại và mật khẩu mới (tối thiểu 8 ký tự)." />
        <div className="grid grid-cols-1 gap-4 max-w-md">
          <InputGroup label="Mật khẩu Hiện tại">
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none"
            />
          </InputGroup>
          <InputGroup label="Mật khẩu Mới">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none"
            />
          </InputGroup>
          <InputGroup label="Xác nhận Mật khẩu Mới">
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none"
            />
          </InputGroup>
          <button
            onClick={handleSubmit}
            disabled={changePassword.isPending || !currentPassword || !newPassword}
            className="inline-flex items-center gap-2 justify-center px-6 py-2.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-bold transition-all disabled:opacity-50 w-fit"
          >
            <KeyRound className="w-4 h-4" />
            {changePassword.isPending ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </SettingCard>
    </div>
  );
}
