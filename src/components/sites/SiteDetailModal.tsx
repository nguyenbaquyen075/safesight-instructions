'use client';
// SPDX-License-Identifier: MIT

import { X, ShieldAlert, Wifi, WifiOff } from 'lucide-react';
import { cn, getViolationTypeLabel } from '@/lib/utils';
import { mockCameras } from '@/data/mock-cameras';
import { CameraStatus, SiteStatus } from '@/types/enums';
import { SubjectAgentPanel } from '@/components/agent/SubjectAgentPanel';
import type { SiteStatusSummary, Violation } from '@/types/models';

interface SiteDetailModalProps {
  site: SiteStatusSummary;
  violations: Violation[];
  onClose: () => void;
}

export function SiteDetailModal({ site, violations, onClose }: SiteDetailModalProps) {
  const cameras = mockCameras.filter(c => c.siteId === site.id);
  const siteViolations = violations.filter(v => v.siteName === site.name).slice(0, 10);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] shadow-2xl">
        <div className="p-8 border-b border-[var(--border)] flex justify-between items-start sticky top-0 bg-[var(--surface)] z-10">
          <div>
            <div className={cn(
              "inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border mb-2",
              site.status === SiteStatus.ACTIVE
                ? "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20"
                : "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
            )}>
              {site.status === SiteStatus.ACTIVE ? 'HOẠT ĐỘNG' : 'THIẾT LẬP'}
            </div>
            <h2 className="text-2xl font-black text-[var(--text-primary)]">{site.name}</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1">ID: {site.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--text-muted)] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 space-y-8">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)]">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Tuân thủ</p>
              <p className="text-xl font-black text-[var(--text-primary)]">{site.complianceRate}%</p>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)]">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Camera trực tuyến</p>
              <p className="text-xl font-black text-[var(--text-primary)]">{site.onlineCameras}/{site.cameraCount}</p>
            </div>
            <div className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)]">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Cảnh báo</p>
              <p className="text-xl font-black text-[var(--danger)]">{site.activeAlerts}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest mb-3">Camera ({cameras.length})</h3>
            {cameras.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Chưa có camera nào được lắp đặt cho công trình này.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cameras.map(cam => (
                  <div key={cam.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
                    {cam.status === CameraStatus.ONLINE
                      ? <Wifi className="w-4 h-4 text-[var(--success)] shrink-0" />
                      : <WifiOff className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{cam.name}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate">{cam.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-widest mb-3">Vi phạm gần đây</h3>
            {siteViolations.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Chưa có vi phạm nào được ghi nhận.</p>
            ) : (
              <div className="space-y-2">
                {siteViolations.map(v => (
                  <div key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
                    <div className="flex items-center gap-3 min-w-0">
                      <ShieldAlert className="w-4 h-4 text-[var(--danger)] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)] truncate">{getViolationTypeLabel(v.type)}</p>
                        <p className="text-[10px] text-[var(--text-muted)] truncate">{v.cameraName}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap pl-2">{new Date(v.detectedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Agent</h4>
            <SubjectAgentPanel subjectType="site" subjectId={site.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
