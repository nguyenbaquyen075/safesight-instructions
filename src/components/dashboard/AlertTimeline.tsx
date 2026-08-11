'use client';
// SPDX-License-Identifier: MIT


import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn, getSeverityColor, getViolationTypeLabel } from '@/lib/utils';
import type { Alert } from '@/types/models';
import { AlertStatus, Severity } from '@/types/enums';

interface AlertTimelineProps {
  alerts: Alert[];
}

export function AlertTimeline({ alerts }: AlertTimelineProps) {
  const router = useRouter();
  if (alerts.length === 0) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center text-center">
        <ShieldAlert className="w-8 h-8 text-[var(--text-muted)] mb-2" />
        <p className="text-sm text-[var(--text-secondary)]">Không có thông báo gần đây</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] overflow-y-auto pr-2 relative">
      <div className="absolute left-3 top-2 bottom-2 w-px bg-[var(--border)]" />
      
      <div className="space-y-4">
        {alerts.map((alert, idx) => {
          const violation = alert.violation;
          if (!violation) return null;

          const isNew = alert.status === AlertStatus.NEW;
          const severityColor = getSeverityColor(violation.severity);

          return (
            <div key={alert.id} className="relative pl-8 animate-slide-in-right" style={{ animationDelay: `${idx * 50}ms` }}>
              {/* Timeline dot */}
              <div
                className={cn(
                  'absolute left-[9px] top-1.5 w-2 h-2 rounded-full ring-4 ring-[var(--surface)]',
                  isNew ? 'animate-pulse-live' : ''
                )}
                style={{ backgroundColor: severityColor }}
              />

              <div className="flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {violation.cameraName}
                    </span>
                    {isNew && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--danger-muted)] text-[var(--danger)] uppercase">
                        Mới
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-muted)] whitespace-nowrap flex-shrink-0">
                    {formatDistanceToNow(new Date(alert.createdAt), {
                      addSuffix: true,
                      locale: vi,
                    })}
                  </span>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                  {/* Thumbnail — khung hình sống từ video đang giám sát (khớp hiện tại) */}
                  <div className="relative w-16 h-12 rounded-md overflow-hidden bg-[var(--surface-elevated)] flex-shrink-0 border border-[var(--border)]">
                    <video
                      src="/videos/test1.mp4"
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="object-cover w-full h-full"
                    />
                    <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-md" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {getViolationTypeLabel(violation.type)}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] truncate">
                      {violation.siteName}
                    </p>
                  </div>

                  {/* Action/Status */}
                  <div className="flex-shrink-0 flex items-center h-full">
                    {alert.status === AlertStatus.ACKNOWLEDGED ? (
                      <div className="flex flex-col items-end">
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                        <span className="text-[10px] text-[var(--text-muted)] mt-1">
                          {alert.acknowledgedByName?.split(' ').pop()}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => router.push('/alerts')}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] transition-colors border border-[var(--border)]"
                      >
                        Xem
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
