'use client';
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole, SiteStatus } from '@/types/enums';
import { assignableRoles } from '@/lib/auth/permissions';
import { useSites } from '@/hooks/use-sites';
import { useCreateUser } from '@/hooks/use-users';
import { toast } from '@/lib/toast';

interface AddUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const initialForm = { name: '', email: '', password: '', role: UserRole.SUPERVISOR as UserRole, assignedSites: [] as string[] };

export function AddUserDialog({ isOpen, onClose }: AddUserDialogProps) {
  const { data: sites } = useSites();
  const { data: session } = useSession();
  // ORG_ADMIN không được cấp SUPER_ADMIN — API chặn, danh sách ở đây khớp theo.
  const roles = assignableRoles(session?.user?.role);
  const createUser = useCreateUser();
  const [form, setForm] = useState(initialForm);

  const resetAndClose = () => {
    setForm(initialForm);
    onClose();
  };

  const toggleSite = (siteId: string) => {
    setForm(f => ({
      ...f,
      assignedSites: f.assignedSites.includes(siteId)
        ? f.assignedSites.filter(id => id !== siteId)
        : [...f.assignedSites, siteId],
    }));
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      toast('Điền đủ tên, email và mật khẩu tối thiểu 8 ký tự', 'error');
      return;
    }
    createUser.mutate(form, {
      onSuccess: () => {
        toast(`Đã tạo người dùng ${form.name}`, 'success');
        resetAndClose();
      },
      onError: (err) => toast(err instanceof Error ? err.message : 'Tạo người dùng thất bại', 'error'),
    });
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && resetAndClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl max-h-[90vh] overflow-y-auto">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <Dialog.Title className="text-lg font-bold leading-none tracking-tight text-[var(--text-primary)]">
              Thêm người dùng
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[var(--text-muted)]">
              Tạo tài khoản mới và gán vai trò, công trường.
            </Dialog.Description>
          </div>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Họ và tên</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                  placeholder="ten@congty.vn"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Mật khẩu</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
                placeholder="Tối thiểu 8 ký tự"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Vai trò</label>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm({ ...form, role })}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all',
                      form.role === role
                        ? 'bg-[var(--primary-muted)] border-[var(--primary)] text-[var(--primary-light)]'
                        : 'bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]'
                    )}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {role.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Công trường được gán</label>
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                {sites?.map((site) => (
                  <div
                    key={site.id}
                    onClick={() => toggleSite(site.id)}
                    className={cn(
                      'flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer',
                      form.assignedSites.includes(site.id)
                        ? 'bg-[var(--surface-hover)] border-[var(--primary)]/30'
                        : 'bg-[var(--background)] border-[var(--border)]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center transition-all',
                        form.assignedSites.includes(site.id) ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)]'
                      )}>
                        {form.assignedSites.includes(site.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <p className="text-[11px] font-bold text-[var(--text-primary)]">{site.name}</p>
                    </div>
                    <div className={cn('w-1.5 h-1.5 rounded-full', site.status === SiteStatus.ACTIVE ? 'bg-[var(--success)]' : 'bg-[var(--warning)]')} />
                  </div>
                ))}
                {sites?.length === 0 && <p className="text-xs text-[var(--text-muted)] px-1">Chưa có công trường nào.</p>}
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <button
              onClick={resetAndClose}
              className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] focus:outline-none sm:mt-0"
            >
              Huỷ
            </button>
            <button
              onClick={handleSubmit}
              disabled={createUser.isPending}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-8 py-2 text-sm font-bold text-white transition-all hover:bg-[var(--primary-hover)] shadow-lg shadow-[var(--primary)]/20 disabled:opacity-50"
            >
              {createUser.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
            </button>
          </div>

          <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4 text-[var(--text-muted)]" />
            <span className="sr-only">Close</span>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
