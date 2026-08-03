'use client';
// SPDX-License-Identifier: MIT


import { MoreHorizontal, Shield, Mail, Calendar, MapPin, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { UserRole } from '@/types/enums';
import type { User } from '@/types/models';
import { format } from 'date-fns';

interface UserTableProps {
  users: User[];
  onEdit: (user: User) => void;
  isLoading?: boolean;
  isAdmin?: boolean;
}

export function UserTable({ users, onEdit, isLoading, isAdmin }: UserTableProps) {
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
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm animate-fade-up">
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
                    user.role === UserRole.SUPER_ADMIN ? "bg-[var(--primary-muted)] text-[var(--primary)] border-[var(--primary)]/20" :
                    user.role === UserRole.ORG_ADMIN ? "bg-[var(--info-muted)] text-[var(--info)] border-[var(--info)]/20" :
                    user.role === UserRole.SITE_MANAGER ? "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20" :
                    "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
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
                          onClick={() => toast(`Đã xóa người dùng ${user.name} (demo)`, 'success')}
                          className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-muted)] transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => toast(`Tùy chọn cho ${user.name} (demo)`, 'info')}
                      className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-all"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
