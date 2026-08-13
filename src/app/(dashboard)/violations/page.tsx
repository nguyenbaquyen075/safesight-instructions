'use client';
// SPDX-License-Identifier: MIT


import { useState, useEffect } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from '@/lib/toast';
import {
  ShieldAlert,
  Search,
  Filter,
  Play,
  Download,
  MoreVertical,
  Calendar,
  Clock,
  MapPin,
  Maximize2,
  Trash2,
  Share2,
  History,
  AlertCircle,
  X,
  PlayCircle,
  CheckCircle2,
  Ban
} from 'lucide-react';
import { cn, getViolationTypeLabel } from '@/lib/utils';
import { useViolations, useDeleteViolation, useUpdateViolationStatus } from '@/hooks/use-violations';
import { useDashboardKPIs } from '@/hooks/use-dashboard';
import { Severity, ViolationStatus } from '@/types/enums';
import { ViolationDetailModal } from '@/components/violations/ViolationDetailModal';
import type { Violation } from '@/types/models';

function exportViolationsCsv(rows: Violation[]) {
  const header = ['Loại vi phạm', 'Mức độ', 'Công trình', 'Camera', 'Thời gian phát hiện', 'Trạng thái'];
  const lines = rows.map(v => [
    getViolationTypeLabel(v.type), v.severity, v.siteName, v.cameraName,
    new Date(v.detectedAt).toLocaleString(), v.status,
  ]);
  const csv = [header, ...lines]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vi-pham-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ViolationsPage() {
  const [mounted, setMounted] = useState(false);
  type SeverityFilter = 'TẤT CẢ' | 'NGHIÊM TRỌNG' | 'CAO';
  const [filter, setFilter] = useState<SeverityFilter>('TẤT CẢ');
  const [selectedViolation, setSelectedViolation] = useState<any>(null);
  const { data: violations = [] } = useViolations();
  const { data: kpis } = useDashboardKPIs();
  const deleteViolation = useDeleteViolation();
  const updateViolationStatus = useUpdateViolationStatus();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const allViolations = violations.filter(v =>
    filter === 'TẤT CẢ' || v.severity === (filter === 'NGHIÊM TRỌNG' ? Severity.CRITICAL : Severity.HIGH)
  );

  const handleDelete = (v: Violation) => {
    if (!confirm(`Xoá vi phạm "${getViolationTypeLabel(v.type)}" tại ${v.cameraName}? Không thể hoàn tác.`)) return;
    deleteViolation.mutate(v.id, {
      onSuccess: () => toast('Đã xoá vi phạm khỏi danh sách', 'success'),
      onError: () => toast('Xoá thất bại, thử lại sau', 'error'),
    });
  };

  const handleShare = async (v: Violation) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/violations#${v.id}`);
      toast('Đã sao chép liên kết chia sẻ vi phạm', 'success');
    } catch {
      toast('Trình duyệt chặn sao chép, thử lại thủ công', 'error');
    }
  };

  const handleSetStatus = (v: Violation, status: ViolationStatus) => {
    updateViolationStatus.mutate(
      { id: v.id, status },
      {
        onSuccess: () => toast(status === ViolationStatus.RESOLVED ? 'Đã đánh dấu đã giải quyết' : 'Đã đánh dấu báo động giả', 'success'),
        onError: () => toast('Cập nhật thất bại, thử lại sau', 'error'),
      }
    );
  };

  const getFilterLabel = (s: string) => {
    if (s === 'ALL') return 'TẤT CẢ';
    if (s === Severity.CRITICAL) return 'NGHIÊM TRỌNG';
    if (s === Severity.HIGH) return 'CAO';
    return s;
  }

  return (
    <div className="space-y-8 pb-20 animate-fade-up">
      {/* Detail Modal */}
      {selectedViolation && (
        <ViolationDetailModal 
          violation={selectedViolation} 
          onClose={() => setSelectedViolation(null)} 
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Thư viện Vi phạm</h1>
          <p className="text-[var(--text-muted)] text-sm">Lưu trữ bằng chứng về các sự kiện không tuân thủ an toàn.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--surface)] p-1 rounded-xl border border-[var(--border)]">
             {['ALL', Severity.CRITICAL, Severity.HIGH].map(s => (
               <button 
                 key={s}
                 onClick={() => setFilter(getFilterLabel(s) as any)}
                 className={cn(
                   "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                   (filter === getFilterLabel(s)) ? "bg-[var(--primary)] text-white shadow-lg" : "text-[var(--text-muted)] hover:text-white"
                 )}
               >
                 {getFilterLabel(s)}
               </button>
             ))}
          </div>
          <button
            onClick={() => { exportViolationsCsv(allViolations); toast(`Đã xuất ${allViolations.length} vi phạm ra file CSV`, 'success'); }}
            className="px-6 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Xuất file
          </button>
        </div>
      </div>

      {/* Analytics Mini-row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng số vi phạm', value: allViolations.length.toString(), icon: History, color: 'primary' },
          { label: 'Nguy hiểm (Thiếu mũ)', value: allViolations.filter(v => String(v.type || '').toLowerCase().match(/mũ|helmet|hard/)).length.toString(), icon: ShieldAlert, color: 'danger' },
          { label: 'Chưa giải quyết', value: allViolations.filter(v => v.status !== ViolationStatus.RESOLVED && v.status !== ViolationStatus.FALSE_POSITIVE).length.toString(), icon: AlertCircle, color: 'warning' },
          { label: 'Tỷ lệ tuân thủ', value: `${kpis?.complianceRate ?? 100}%`, icon: Filter, color: 'success' },
        ].map(stat => (
          <div key={stat.label} className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-2xl flex items-center gap-4">
             <div className={cn("p-2 rounded-lg bg-[var(--surface-elevated)]", 
                stat.color === 'primary' ? 'text-[var(--primary)]' : 
                stat.color === 'danger' ? 'text-red-500' : 
                stat.color === 'warning' ? 'text-amber-500' : 'text-[var(--success)]'
             )}>
                <stat.icon className="w-4 h-4" />
             </div>
             <div>
                <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">{stat.label}</p>
                <p className="text-sm font-black text-[var(--text-primary)]">{stat.value}</p>
             </div>
          </div>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {allViolations.map((violation, idx) => (
          <div 
            key={violation.id}
            onClick={() => setSelectedViolation(violation)}
            className="group bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] overflow-hidden hover:border-[var(--primary)]/30 transition-all duration-500 hover:shadow-2xl animate-fade-up cursor-pointer"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {/* Media Preview */}
            <div className="relative aspect-video bg-black overflow-hidden">
               {violation.clipUrl ? (
                 <video 
                   src={violation.clipUrl} 
                   className="w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-1000"
                   muted
                   loop
                   onMouseOver={e => (e.target as HTMLVideoElement).play()}
                   onMouseOut={e => (e.target as HTMLVideoElement).pause()}
                 />
               ) : (
                 <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
                    <ShieldAlert className="w-12 h-12 text-white/10" />
                 </div>
               )}
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
               
               <div className="absolute top-4 left-4 flex items-center gap-2">
                 <div className={cn(
                   "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border backdrop-blur-md",
                   violation.severity === Severity.CRITICAL ? "bg-red-500/20 text-red-500 border-red-500/30" : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                 )}>
                   {violation.severity === Severity.CRITICAL ? 'NGHIÊM TRỌNG' : 'CAO'}
                 </div>
               </div>

               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-16 h-16 rounded-full bg-[var(--primary)]/90 flex items-center justify-center text-white shadow-glow-primary transform scale-90 group-hover:scale-100 transition-transform">
                     <Play className="w-8 h-8 fill-current ml-1" />
                  </div>
               </div>
            </div>

            {/* Details */}
            <div className="p-8 space-y-6">
               <div className="flex justify-between items-start">
                  <div>
                     <h3 className="text-xl font-black text-[var(--text-primary)] group-hover:text-[var(--primary-light)] transition-colors uppercase tracking-tight">{getViolationTypeLabel(violation.type)}</h3>
                     <div className="flex items-center gap-3 mt-2 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                           <Calendar className="w-3 h-3" />
                           <span>{new Date(violation.detectedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                           <Clock className="w-3 h-3" />
                           <span>{new Date(violation.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                     </div>
                  </div>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                         onClick={(e) => e.stopPropagation()}
                         className="p-2 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--text-muted)] transition-colors"
                      >
                         <MoreVertical className="w-5 h-5" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl z-50"
                      >
                        <DropdownMenu.Item
                          onSelect={() => handleSetStatus(violation, ViolationStatus.RESOLVED)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] outline-none cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" /> Đánh dấu đã giải quyết
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => handleSetStatus(violation, ViolationStatus.FALSE_POSITIVE)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] outline-none cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5 text-[var(--warning)]" /> Đánh dấu báo động giả
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
               </div>

               <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)]">
                     <div className="w-10 h-10 rounded-xl bg-[var(--surface)] flex items-center justify-center text-[var(--primary)]">
                        <MapPin className="w-5 h-5" />
                     </div>
                     <div>
                        <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Vị trí</p>
                        <p className="text-sm font-bold text-[var(--text-primary)] truncate max-w-[150px]">{violation.siteName} • {violation.cameraName}</p>
                     </div>
                  </div>
               </div>

               <div className="flex items-center justify-between pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center -space-x-2">
                     {[1, 2, 3].map(i => (
                       <div key={i} className="w-8 h-8 rounded-full border-2 border-[var(--surface)] bg-[var(--surface-elevated)] flex items-center justify-center text-[8px] font-black text-[var(--text-muted)]">
                          U{i}
                       </div>
                     ))}
                     <div className="w-8 h-8 rounded-full border-2 border-[var(--surface)] bg-[var(--primary)] flex items-center justify-center text-[8px] font-black text-white">
                        +2
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(violation); }}
                        className="p-3 rounded-xl hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all"
                     >
                        <Trash2 className="w-5 h-5" />
                     </button>
                     <button
                        onClick={(e) => { e.stopPropagation(); handleShare(violation); }}
                        className="p-3 rounded-xl hover:bg-[var(--primary-muted)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-all"
                     >
                        <Share2 className="w-5 h-5" />
                     </button>
                     <button
                        onClick={(e) => { e.stopPropagation(); setSelectedViolation(violation); }}
                        className="p-3 rounded-xl bg-[var(--primary)] text-white shadow-glow-primary hover:bg-[var(--primary-hover)] transition-all"
                     >
                        <Maximize2 className="w-5 h-5" />
                     </button>
                  </div>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
