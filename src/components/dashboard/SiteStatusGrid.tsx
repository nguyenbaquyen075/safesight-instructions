'use client';
// SPDX-License-Identifier: MIT


import { Building2, Camera, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SiteStatusSummary } from '@/types/models';
import { SiteStatus } from '@/types/enums';

interface SiteStatusGridProps {
  sites: SiteStatusSummary[];
}

export function SiteStatusGrid({ sites }: SiteStatusGridProps) {
  return (
    <div className="h-[300px] overflow-y-auto pr-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sites.map((site, idx) => (
          <div
            key={site.id}
            className="flex flex-col p-3 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]/50 transition-colors cursor-pointer group animate-fade-up"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 max-w-[70%]">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    site.status === SiteStatus.ACTIVE
                      ? 'bg-[var(--success)] animate-pulse-live'
                      : 'bg-[var(--warning)]'
                  )}
                />
                <h3 className="text-sm font-medium text-[var(--text-primary)] truncate" title={site.name}>
                  {site.name}
                </h3>
              </div>
              <div
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-bold',
                  site.complianceRate >= 90
                    ? 'bg-[var(--success-muted)] text-[var(--success)]'
                    : site.complianceRate >= 80
                    ? 'bg-[var(--warning-muted)] text-[var(--warning)]'
                    : 'bg-[var(--danger-muted)] text-[var(--danger)]'
                )}
              >
                {site.complianceRate.toFixed(1)}%
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-auto">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <strong className={cn(site.activeAlerts > 0 ? 'text-[var(--danger)]' : 'text-[var(--text-primary)]')}>
                    {site.activeAlerts}
                  </strong>{' '}
                  Alerts
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                <Camera className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <strong className="text-[var(--text-primary)]">{site.onlineCameras}</strong>/{site.cameraCount}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
