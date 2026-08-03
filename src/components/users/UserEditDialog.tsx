'use client';
// SPDX-License-Identifier: MIT


import * as Dialog from '@radix-ui/react-dialog';
import { X, Shield, Mail, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserRole, SiteStatus } from '@/types/enums';
import type { User } from '@/types/models';
import { useSites } from '@/hooks/use-sites';
import { useState } from 'react';

interface UserEditDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
}

export function UserEditDialog({ user, isOpen, onClose, onSave }: UserEditDialogProps) {
  const { data: sites } = useSites();
  const [formData, setFormData] = useState<Partial<User>>(user || {});

  if (!user && isOpen) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-xl">
          <div className="flex flex-col space-y-1.5 text-center sm:text-left">
            <Dialog.Title className="text-lg font-bold leading-none tracking-tight text-[var(--text-primary)]">
              {user ? 'Edit User Profile' : 'Create New User'}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-[var(--text-muted)]">
              Manage permissions, site assignments, and security settings for {user?.name}.
            </Dialog.Description>
          </div>

          <div className="grid gap-6 py-4">
            {/* Header Info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--background)] border border-[var(--border)]">
               <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center text-white text-xl font-bold">
                  {user?.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
               </div>
               <div className="flex-1">
                  <h4 className="font-bold text-[var(--text-primary)]">{user?.name}</h4>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                     <Mail className="w-3 h-3" />
                     {user?.email}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
                     <CheckCircle2 className="w-3 h-3 text-[var(--success)]" />
                     2FA Enabled
                  </div>
               </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">System Role</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.values(UserRole).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setFormData({ ...formData, role })}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all",
                      (formData.role || user?.role) === role 
                        ? "bg-[var(--primary-muted)] border-[var(--primary)] text-[var(--primary-light)]"
                        : "bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                    )}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {role.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Site Assignments */}
            <div className="space-y-2">
               <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Assigned Sites</label>
                  <span className="text-[10px] text-[var(--primary)] font-bold cursor-pointer hover:underline">Select All</span>
               </div>
               <div className="max-h-40 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                  {sites?.map((site) => (
                    <div 
                      key={site.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer",
                        user?.assignedSites.includes(site.id)
                          ? "bg-[var(--surface-hover)] border-[var(--primary)]/30"
                          : "bg-[var(--background)] border-[var(--border)]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-all",
                          user?.assignedSites.includes(site.id) ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border)]"
                        )}>
                          {user?.assignedSites.includes(site.id) && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-[var(--text-primary)]">{site.name}</p>
                          <p className="text-[9px] text-[var(--text-muted)] flex items-center gap-0.5">
                            <MapPin className="w-2 h-2" />
                            {site.address.split(',').slice(-2).join(',')}
                          </p>
                        </div>
                      </div>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        site.status === SiteStatus.ACTIVE ? "bg-[var(--success)]" : "bg-[var(--warning)]"
                      )} />
                    </div>
                  ))}
               </div>
            </div>

            {/* Account Status */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--danger-muted)]/10 border border-[var(--danger)]/20">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--danger-muted)] flex items-center justify-center">
                     <AlertCircle className="w-5 h-5 text-[var(--danger)]" />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-[var(--text-primary)]">Deactivate Account</p>
                     <p className="text-[10px] text-[var(--text-muted)]">User will immediately lose all platform access.</p>
                  </div>
               </div>
               <div className="w-10 h-6 rounded-full bg-[var(--border)] relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white" />
               </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
            <button
              onClick={onClose}
              className="mt-2 inline-flex h-10 items-center justify-center rounded-lg border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] focus:outline-none sm:mt-0"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(formData)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-8 py-2 text-sm font-bold text-white transition-all hover:bg-[var(--primary-hover)] shadow-lg shadow-[var(--primary)]/20"
            >
              Save Changes
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
