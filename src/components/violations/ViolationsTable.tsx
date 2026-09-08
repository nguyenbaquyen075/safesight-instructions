'use client';
// SPDX-License-Identifier: MIT


import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  Bell,
  MoreVertical,
  Camera,
  MapPin,
  PlayCircle,
  Shield,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Violation } from '@/types/models';
import { Severity, ViolationStatus } from '@/types/enums';

interface ViolationsTableProps {
  violations: Violation[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onUpdateStatus: (id: string, status: ViolationStatus) => void;
  isLoading?: boolean;
}

export function ViolationsTable({
  violations,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onUpdateStatus,
  isLoading,
}: ViolationsTableProps) {
  const allSelected = violations.length > 0 && selectedIds.length === violations.length;

  if (isLoading) {
    return (
      <div className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden animate-fade-in">
        <div className="bg-[var(--surface-hover)] border-b border-[var(--border)] h-12" />
        <div className="divide-y divide-[var(--border)]">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-4 py-6 flex items-center gap-4 animate-pulse">
              <div className="w-4 h-4 bg-[var(--surface-elevated)] rounded" />
              <div className="w-12 h-12 bg-[var(--surface-elevated)] rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-[var(--surface-elevated)] rounded" />
                <div className="h-3 w-1/3 bg-[var(--surface-elevated)] rounded" />
              </div>
              <div className="w-20 h-6 bg-[var(--surface-elevated)] rounded-md" />
              <div className="w-24 h-6 bg-[var(--surface-elevated)] rounded-full" />
              <div className="w-10 h-6 bg-[var(--surface-elevated)] rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getStatusConfig = (status: ViolationStatus) => {
    switch (status) {
      case ViolationStatus.OPEN:
        return { label: 'Open', classes: 'bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/20' };
      case ViolationStatus.UNDER_REVIEW:
        return { label: 'Under Review', classes: 'bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20' };
      case ViolationStatus.RESOLVED:
        return { label: 'Resolved', classes: 'bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20' };
      case ViolationStatus.FALSE_POSITIVE:
        return { label: 'False Positive', classes: 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border)]' };
      default:
        return { label: status, classes: 'bg-[var(--surface-elevated)] text-[var(--text-muted)] border-[var(--border)]' };
    }
  };

  const getSeverityConfig = (severity: Severity) => {
    switch (severity) {
      case Severity.CRITICAL:
        return { icon: AlertCircle, label: 'Critical', classes: 'text-[var(--danger)] bg-[var(--danger-muted)]' };
      case Severity.HIGH:
        return { icon: AlertCircle, label: 'High', classes: 'text-[#EA580C] bg-[rgba(234,88,12,0.15)]' };
      case Severity.MEDIUM:
        return { icon: ShieldAlert, label: 'Medium', classes: 'text-[var(--warning)] bg-[var(--warning-muted)]' };
      case Severity.LOW:
        return { icon: CheckCircle2, label: 'Low', classes: 'text-[var(--info)] bg-[var(--info-muted)]' };
      default:
        return { icon: Bell, label: 'Unknown', classes: 'text-[var(--text-muted)] bg-[var(--surface-elevated)]' };
    }
  };

  if (violations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded-xl">
        <Shield className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-lg font-medium">No violations found</p>
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
            <th className="px-4 py-3">Violation</th>
            <th className="px-4 py-3">Severity</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Detected At</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {violations.map((violation) => {
            const isSelected = selectedIds.includes(violation.id);
            const statusConfig = getStatusConfig(violation.status);
            const severityConfig = getSeverityConfig(violation.severity);
            const SeverityIcon = severityConfig.icon;
            const violationTypeFormatted = violation.type.replace(/_/g, ' ') || 'Unknown';

            return (
              <tr
                key={violation.id}
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
                      onChange={() => onToggleSelect(violation.id)}
                      className="w-4 h-4 rounded border-[var(--border)] bg-[var(--background)] text-[var(--primary)] focus:ring-[var(--primary)]/20 cursor-pointer"
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-[var(--background-secondary)] border border-[var(--border)] flex-shrink-0 group">
                      {/* Placeholder for real image since we are using mock data */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-50">
                        <Camera className="w-5 h-5 text-[var(--text-muted)]" />
                      </div>
                      {violation.clipUrl && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <PlayCircle className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-[var(--text-primary)] capitalize">
                        {violationTypeFormatted.toLowerCase()}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {Math.round(violation.confidence * 100)}% Confidence
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium', severityConfig.classes)}>
                    <SeverityIcon className="w-3.5 h-3.5" />
                    {severityConfig.label}
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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-[var(--text-primary)]">
                      <MapPin className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span className="truncate max-w-[150px]">{violation.siteName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Camera className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[150px]">{violation.cameraName}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col text-[var(--text-primary)]">
                    <span>{format(new Date(violation.detectedAt), 'MMM d, yyyy')}</span>
                    <span className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {format(new Date(violation.detectedAt), 'HH:mm:ss')}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-muted)] rounded-md transition-colors" title="View Details">
                      <Eye className="w-4 h-4" />
                    </button>
                    {violation.status === ViolationStatus.OPEN && (
                      <button
                        onClick={() => onUpdateStatus(violation.id, ViolationStatus.RESOLVED)}
                        className="px-3 py-1.5 text-xs font-medium bg-[var(--success)] hover:bg-[var(--success-hover)] text-white rounded-md transition-colors"
                      >
                        Resolve
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
      {violations.map((violation) => {
        const statusConfig = getStatusConfig(violation.status);
        const violationTypeFormatted = violation.type.replace(/_/g, ' ') || 'Unknown';

        return (
          <div
            key={violation.id}
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
                <Camera className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{violation.cameraName}</span>
              </span>
              <span className="flex-shrink-0 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(violation.detectedAt), 'MMM d, HH:mm')}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button className="p-1.5 text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary-muted)] rounded-md transition-colors" title="View Details">
                <Eye className="w-4 h-4" />
              </button>
              {violation.status === ViolationStatus.OPEN && (
                <button
                  onClick={() => onUpdateStatus(violation.id, ViolationStatus.RESOLVED)}
                  className="px-3 py-1.5 text-xs font-medium bg-[var(--success)] hover:bg-[var(--success-hover)] text-white rounded-md transition-colors"
                >
                  Resolve
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
