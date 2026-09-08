'use client';
// SPDX-License-Identifier: MIT


import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Shield, Mail, Calendar, MapPin, Edit2, Trash2, Copy, UserCheck, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { UserRole } from '@/types/enums';
import type { User } from '@/types/models';
import { format } from 'date-fns';

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onToggleActive: (user: User) => void;
  isLoading?: boolean;
  isAdmin?: boolean;
}

function getRoleBadgeClasses(role: UserRole): string {
  switch (role) {
    case UserRole.SUPER_ADMIN:
      return 'bg-[var(--primary-muted)] text-[var(--primary)] border-[var(--primary)]/20';
    case UserRole.ORG_ADMIN:
      return 'bg-[var(--info-muted)] text-[var(--info)] border-[var(--info)]/20';
    case UserRole.SITE_MANAGER:
      return 'bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20';
    default:
      return 'bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20';
  }
}

// Dùng chung cho hàng bảng (desktop) và thẻ (mobile) để không lặp DropdownMenu.
function UserRowActions({
  user,
  onEdit,
  onDelete,
  onToggleActive,
  isAdmin,
}: {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onToggleActive: (user: User) => void;
  isAdmin?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      {isAdmin && (
        <>
          <button
            onClick={() => onEdit(user)}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-muted)] transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (confirm(`Xoá người dùng ${user.name}? Không thể hoàn tác.`)) onDelete(user);
            }}
            className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-muted)] transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </>
      )}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-all">
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl z-50"
          >
            <DropdownMenu.Item
              onSelect={() => { navigator.clipboard.writeText(user.email); toast('Đã sao chép email', 'success'); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] outline-none cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Sao chép email
            </DropdownMenu.Item>
            {isAdmin && (
              <DropdownMenu.Item
                onSelect={() => onToggleActive(user)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] outline-none cursor-pointer"
              >
                {user.isActive
                  ? <><UserX className="w-3.5 h-3.5" /> Vô hiệu hoá tài khoản</>
                  : <><UserCheck className="w-3.5 h-3.5" /> Kích hoạt tài khoản</>}
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export function UserTable({ users, onEdit, onDelete, onToggleActive, isLoading, isAdmin }: UserTableProps) {
  if (isLoading) {
    return (
      <div className="w-full space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
    <div className="hidden md:block bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-[var(--background-secondary)] border-b border-[var(--border)]">
            <tr>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">User</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Role</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Sites</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Last Login</th>
              <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]/50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-[var(--surface-hover)] transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-sm shadow-inner">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-light)] transition-colors">
                        {user.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border",
                    getRoleBadgeClasses(user.role)
                  )}>
                    <Shield className="w-3 h-3" />
                    {user.role.replace('_', ' ')}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {user.assignedSiteNames && user.assignedSiteNames.length > 0 ? (
                      <>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] font-medium">
                          <MapPin className="w-3 h-3" />
                          {user.assignedSiteNames[0]}
                        </div>
                        {user.assignedSiteNames.length > 1 && (
                          <div className="text-[10px] text-[var(--text-muted)] pl-4">
                            + {user.assignedSiteNames.length - 1} more sites
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-[var(--text-muted)] italic">Global Access</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                   <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", user.isActive ? "bg-[var(--success)]" : "bg-[var(--text-muted)]")} />
                      <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                        {user.isActive ? 'Active' : 'Disabled'}
                      </span>
                   </div>
                </td>
                <td className="px-6 py-4">
                   <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {user.lastLogin ? format(new Date(user.lastLogin), 'MMM d, HH:mm') : 'Never'}
                   </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <UserRowActions
                    user={user}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                    isAdmin={isAdmin}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Thẻ danh sách dưới md, thay cho bảng */}
    <div className="md:hidden space-y-3">
      {users.map((user) => (
        <div key={user.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-xs shadow-inner">
                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)] truncate">{user.name}</span>
            </div>
            <div className={cn(
              "flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border",
              getRoleBadgeClasses(user.role)
            )}>
              <Shield className="w-3 h-3" />
              {user.role.replace('_', ' ')}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
            <span className="flex items-center gap-1 truncate">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{user.email}</span>
            </span>
            <span className="flex-shrink-0 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {user.lastLogin ? format(new Date(user.lastLogin), 'MMM d, HH:mm') : 'Never'}
            </span>
          </div>
          <div className="pt-1">
            <UserRowActions
              user={user}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      ))}
    </div>
    </div>
  );
}
