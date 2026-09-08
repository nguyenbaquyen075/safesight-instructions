'use client';
// SPDX-License-Identifier: MIT

import { format } from 'date-fns';
import { SectionHeader, SettingCard } from './ui';
import { useAuditLog } from '@/hooks/use-audit-log';

export function AuditLogCard() {
  const { data: entries, isLoading, isError } = useAuditLog({ limit: 100 });

  return (
    <SettingCard>
      <SectionHeader title="Nhật ký Thao tác" description="Lịch sử các thay đổi trên người dùng, camera, cảnh báo và cài đặt hệ thống." />

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 w-full bg-[var(--background-secondary)] border border-[var(--border)] rounded-lg animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-[var(--danger)]">Không tải được nhật ký.</p>
      ) : !entries || entries.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">Chưa có thao tác nào được ghi nhận.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Thời gian</th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Người dùng</th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Hành động</th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Đối tượng</th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/50">
              {entries.map((entry) => (
                <tr key={entry.id} className="text-sm">
                  <td className="px-3 py-2 whitespace-nowrap text-[var(--text-muted)]">{format(new Date(entry.createdAt), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-3 py-2 font-medium text-[var(--text-primary)]">{entry.userName}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{entry.action}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{entry.resource}{entry.resourceId ? ` · ${entry.resourceId}` : ''}</td>
                  <td className="px-3 py-2 text-[var(--text-muted)] max-w-xs truncate" title={entry.details}>{entry.details ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SettingCard>
  );
}
