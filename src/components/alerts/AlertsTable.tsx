'use client';
// SPDX-License-Identifier: MIT


import {
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  Mail,
  MessageSquare,
  MoreVertical,
  Phone,
  ShieldAlert,
  Smartphone,
  Volume2,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Alert } from '@/types/models';
import { AlertChannel, AlertStatus, Severity } from '@/types/enums';

interface AlertsTableProps {
  alerts: Alert[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onAcknowledge: (id: string) => void;
}

export function AlertsTable({
  alerts,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onAcknowledge,
}: AlertsTableProps) {
  const allSelected = alerts.length > 0 && selectedIds.length === alerts.length;

  const getStatusConfig = (status: AlertStatus) => {
    switch (status) {
      case AlertStatus.NEW:
        return { label: 'New', classes: 'bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/20' };
      case AlertStatus.ACKNOWLEDGED:
        return { label: 'Acknowledged', classes: 'bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20' };
      case AlertStatus.ESCALATED:
        return { label: 'Escalated', classes: 'bg-[var(--primary-muted)] text-[var(--primary)] border-[var(--primary)]/20' };
      case AlertStatus.RESOLVED:
        return { label: 'Resolved', classes: 'bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20' };
      default:
        return { label: status, classes: 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border)]' };
    }
  };

  const getSeverityConfig = (severity?: Severity) => {
    switch (severity) {
      case Severity.CRITICAL:
        return { icon: AlertCircle, classes: 'text-[var(--danger)]' };
      case Severity.HIGH:
        return { icon: AlertCircle, classes: 'text-[#EA580C]' };
      case Severity.MEDIUM:
        return { icon: ShieldAlert, classes: 'text-[var(--warning)]' };
      case Severity.LOW:
        return { icon: CheckCircle, classes: 'text-[var(--info)]' };
      default:
        return { icon: Bell, classes: 'text-[var(--text-muted)]' };
    }
  };

  const getChannelIcon = (channel: AlertChannel) => {
    switch (channel) {
      case AlertChannel.IN_APP:
        return <Bell className="w-4 h-4 text-[var(--primary)]" />;
      case AlertChannel.SMS:
        return <Smartphone className="w-4 h-4 text-[#EA580C]" />;
      case AlertChannel.EMAIL:
        return <Mail className="w-4 h-4 text-[var(--info)]" />;
      case AlertChannel.SIREN:
        return <Volume2 className="w-4 h-4 text-[var(--danger)]" />;
      case AlertChannel.PA_SYSTEM:
        return <Phone className="w-4 h-4 text-[var(--success)]" />;
      case AlertChannel.WEBHOOK:
        return <MessageSquare className="w-4 h-4 text-[var(--text-muted)]" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded-xl">
        <Bell className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No alerts found</p>
        <p className="text-sm">Try adjusting your filters or search query.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
    <div className="hidden md:block overflow-x-auto bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-sm">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-[var(--surface-hover)] border-b border-[var(--border)] text-[var(--text-muted)] font-medium">
          <tr>
            <th className="px-4 py-3 w-[40px]">
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="w-4 h-4 rounded border-[var(--border)] bg-[var(--background)] text-[var(--primary)] focus:ring-[var(--primary)]/20 cursor-pointer"
                />
              </div>
            </th>
            <th className="px-4 py-3">Violation Details</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Channel / Recipient</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {alerts.map((alert) => {
            const isSelected = selectedIds.includes(alert.id);
            const statusConfig = getStatusConfig(alert.status);
            const severityConfig = getSeverityConfig(alert.violation?.severity);
            const SeverityIcon = severityConfig.icon;
            
            const violationTypeFormatted = alert.violation?.type.replace(/_/g, ' ') || 'Unknown Violation';

            return (
              <tr
                key={alert.id}
                className={cn(
                  'data-row hover:bg-[var(--surface-hover)] transition-colors',
                  isSelected && 'bg-[var(--primary-muted)]/20'
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(alert.id)}
                      className="w-4 h-4 rounded border-[var(--border)] bg-[var(--background)] text-[var(--primary)] focus:ring-[var(--primary)]/20 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg bg-[var(--surface-elevated)]', severityConfig.classes)}>
                      <SeverityIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-medium text-[var(--text-primary)] capitalize">
                        {violationTypeFormatted.toLowerCase()}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                        <span>{alert.violation?.siteName || 'Unknown Site'}</span>
                        {alert.violation?.zoneName && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
                            <span>{alert.violation.zoneName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
                      statusConfig.classes
                    )}
                  >
                    {statusConfig.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-[var(--surface-elevated)] border border-[var(--border)]">
                      {getChannelIcon(alert.channel)}
                    </div>
                    <div>
                      <div className="text-[var(--text-primary)] font-medium">
                        {alert.channel}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {alert.recipient}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col text-[var(--text-primary)]">
                    <span>{format(new Date(alert.createdAt), 'MMM d, yyyy')}</span>
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(alert.createdAt), 'HH:mm:ss')}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {alert.status === AlertStatus.NEW && (
                      <button
                        onClick={() => onAcknowledge(alert.id)}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-md transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-md transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Thẻ danh sách dưới md, thay cho bảng */}
    <div className="md:hidden space-y-3">
      {alerts.map((alert) => {
        const statusConfig = getStatusConfig(alert.status);
        const violationTypeFormatted = alert.violation?.type.replace(/_/g, ' ') || 'Unknown Violation';

        return (
          <div
            key={alert.id}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[var(--text-primary)] capitalize truncate">
                {violationTypeFormatted.toLowerCase()}
              </span>
              <span
                className={cn(
                  'flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
                  statusConfig.classes
                )}
              >
                {statusConfig.label}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1 truncate">
                {getChannelIcon(alert.channel)}
                <span className="truncate">{alert.recipient}</span>
              </span>
              <span className="flex-shrink-0 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(alert.createdAt), 'MMM d, HH:mm')}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              {alert.status === AlertStatus.NEW && (
                <button
                  onClick={() => onAcknowledge(alert.id)}
                  className="px-3 py-1.5 text-xs font-medium bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-md transition-colors"
                >
                  Acknowledge
                </button>
              )}
              <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] rounded-md transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
    </div>
  );
}
