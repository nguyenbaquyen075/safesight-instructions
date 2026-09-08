'use client';
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import {
  ShieldAlert,
  Download,
  Calendar,
  MapPin,
  Search,
  X,
} from 'lucide-react';
import { cn, getViolationTypeLabel } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { Severity, ViolationStatus } from '@/types/enums';
import { MicButton } from '@/components/cameras/MicButton';
import { useUpdateViolationStatus } from '@/hooks/use-violations';
import { AgentReviewCard } from '@/components/agent/AgentReviewCard';
import { SubjectAgentPanel } from '@/components/agent/SubjectAgentPanel';
import type { Violation } from '@/types/models';

// Bản ghi AI lưu ở localStorage có thêm date/time/description ngoài kiểu Violation từ DB.
type ViolationLike = Violation & { date?: string; time?: string; description?: string };

export function ViolationDetailModal({ violation, onClose }: { violation: ViolationLike, onClose: () => void }) {
  const [showTicket, setShowTicket] = useState(false);
  // clip_*.mp4 bị dọn (clear_snapshots) trong khi Violation.clipUrl còn giữ đường dẫn cũ
  // -> video 404 lúc phát; rơi về ảnh chốt thay vì ô video đen.
  const [clipFailed, setClipFailed] = useState(false);
  const [tab, setTab] = useState<'detail' | 'agent'>('detail');
  const [empName, setEmpName] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [penalty, setPenalty] = useState('200.000đ');
  const updateStatus = useUpdateViolationStatus();

  if (!violation) return null;

  const reason = String(violation.type || '').toLowerCase().match(/mũ|helmet|hard/)
    ? 'Không đội mũ bảo hộ lao động'
    : `Vi phạm: ${getViolationTypeLabel(violation.type)}`;

  const markUnderReview = () => {
    updateStatus.mutate(
      { id: violation.id, status: ViolationStatus.UNDER_REVIEW },
      {
        onSuccess: () => toast('Đã ghi nhận xem xét tuân thủ cho vi phạm này', 'success'),
        onError: () => toast('Cập nhật thất bại, thử lại sau', 'error'),
      }
    );
  };

  // Nhận diện khuôn mặt: hiện MÔ PHỎNG (chưa có model face thật)
  const autoScan = () => {
    setEmpName('Nguyễn Văn A');
    setEmpDept('Tổ bê tông 2 • MSNV: NV-0293');
    toast('Đã nhận diện khuôn mặt: Nguyễn Văn A — độ khớp 87% (mô phỏng)', 'info');
  };

  const submitTicket = () => {
    if (!empName.trim()) { toast('Vui lòng nhập tên nhân viên vi phạm', 'error'); return; }
    toast(`Đã lập phiếu phạt cho ${empName} — mức phạt ${penalty}`, 'success');
    setShowTicket(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
      <div className="relative w-full max-w-5xl bg-[var(--surface)] rounded-[3rem] overflow-hidden border border-white/10 shadow-2xl flex flex-col lg:flex-row">
        {/* Video Side */}
        <div className="flex-1 bg-black relative aspect-video lg:aspect-auto">
          {/* Có clip 8s (20 khung trước + 12 khung sau lúc chốt) thì phát clip, dùng ảnh chốt làm
              poster để khung hình không bị đen lúc chờ tải; không có clip thì rơi về ảnh chốt. */}
          {violation.clipUrl && !clipFailed ? (
            <video
              src={violation.clipUrl}
              poster={violation.snapshotUrl}
              className="w-full h-full object-contain"
              controls
              muted
              playsInline
              preload="metadata"
              onError={() => setClipFailed(true)}
            />
          ) : violation.snapshotUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh do AI engine ghi lúc chạy, không qua next/image
            <img src={violation.snapshotUrl} alt="Ảnh bằng chứng vi phạm" className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-white/20">
               <ShieldAlert className="w-20 h-20" />
               <p className="font-bold uppercase tracking-widest text-sm">Thiếu Clip Bằng chứng</p>
            </div>
          )}
          <div className="absolute top-6 left-6 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest">Bằng chứng đã ghi</span>
          </div>
          {violation.cameraId && (
            <div className="absolute top-6 right-6">
              <MicButton
                cameraId={violation.cameraId}
                mode="broadcast"
                hasViolation
                onError={(msg) => toast(msg, 'error')}
              />
            </div>
          )}
        </div>

        {/* Content Side */}
        <div className="w-full lg:w-96 p-10 flex flex-col justify-between border-l border-white/5">
           <div className="space-y-8">
              <div className="flex justify-between items-start">
                 <div>
                    <div className={cn(
                       "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border mb-3 inline-block",
                       violation.severity === Severity.CRITICAL ? "bg-red-500/20 text-red-500 border-red-500/30" : "bg-amber-500/20 text-amber-500 border-amber-500/30"
                    )}>
                      {violation.severity === Severity.CRITICAL ? 'NGHIÊM TRỌNG' : 'CAO'}
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{getViolationTypeLabel(violation.type)}</h2>
                 </div>
                 <button onClick={onClose} className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all">
                    <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="flex gap-1 mb-4" role="tablist">
                {(['detail', 'agent'] as const).map(t => (
                  <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]', tab === t ? 'bg-[var(--primary)] text-white' : 'text-white/50 hover:text-white')}>{t === 'detail' ? 'Chi tiết' : 'Agent'}</button>
                ))}
              </div>

              {tab === 'detail' && (
              <div className="space-y-6">
                 <div className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                       <MapPin className="w-5 h-5 text-[var(--primary)]" />
                       <div>
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Vị trí</p>
                          <p className="text-sm font-bold text-white">{violation.siteName}</p>
                          <p className="text-xs text-white/60">{violation.cameraName}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <Calendar className="w-5 h-5 text-[var(--primary)]" />
                       <div>
                          <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Thời gian phát hiện</p>
                          <p className="text-sm font-bold text-white">{violation.date || new Date(violation.detectedAt).toLocaleDateString()}</p>
                          <p className="text-xs text-white/60">{violation.time || new Date(violation.detectedAt).toLocaleTimeString()}</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Mô tả AI</h4>
                    <p className="text-sm text-white/70 leading-relaxed italic">
                       &quot;{violation.description || `Hệ thống phát hiện tự động đã ghi nhận vi phạm: ${getViolationTypeLabel(violation.type)}. Bằng chứng đã được lưu trữ để xem xét tuân thủ.`}&quot;
                    </p>
                 </div>
              </div>
              )}

              {tab === 'agent' && (
                <div className="space-y-4">
                  <AgentReviewCard review={violation.agentReview ?? null} />
                  <SubjectAgentPanel subjectType="violation" subjectId={violation.id} />
                </div>
              )}
           </div>

           <div className="pt-8 border-t border-white/5 space-y-4">
              <button
                 onClick={() => setShowTicket(true)}
                 className="w-full py-4 rounded-2xl bg-red-500 text-white font-black text-sm uppercase tracking-widest shadow-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2"
              >
                 <ShieldAlert className="w-4 h-4" />
                 Lập phiếu phạt
              </button>
              <button
                 onClick={markUnderReview}
                 disabled={updateStatus.isPending}
                 className="w-full py-4 rounded-2xl bg-[var(--primary)] text-white font-black text-sm uppercase tracking-widest shadow-glow-primary hover:bg-[var(--primary-hover)] transition-all disabled:opacity-50"
              >
                 {updateStatus.isPending ? 'Đang cập nhật...' : 'Xem xét Tuân thủ'}
              </button>
              <button
                 onClick={() => toast('Đang tải xuống bằng chứng (demo)', 'info')}
                 className="w-full py-4 rounded-2xl bg-white/5 text-white/60 font-bold text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                 <Download className="w-4 h-4" />
                 Tải xuống Bằng chứng
              </button>
           </div>
        </div>

        {showTicket && (
          <div className="absolute inset-0 z-10 bg-[var(--surface)] rounded-[3rem] p-8 sm:p-10 overflow-y-auto animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">Phiếu Xử phạt An toàn</h2>
                  <p className="text-xs text-white/50">Lập phiếu cho vi phạm PPE trên công trường</p>
                </div>
              </div>
              <button onClick={() => setShowTicket(false)} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Ảnh bằng chứng</label>
                <div className="relative rounded-2xl overflow-hidden border border-white/10 h-40 bg-black">
                  {violation.snapshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh do AI engine ghi lúc chạy, không qua next/image
                    <img src={violation.snapshotUrl} alt="Ảnh bằng chứng đính kèm phiếu phạt" className="w-full h-full object-cover" />
                  ) : violation.clipUrl ? (
                    <video src={violation.clipUrl} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20"><ShieldAlert className="w-10 h-10" /></div>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-1 rounded-md bg-red-500 text-white text-[9px] font-black uppercase tracking-widest">{getViolationTypeLabel(violation.type)}</span>
                </div>
              </div>

              <div className="sm:col-span-2">
                <button onClick={autoScan} className="w-full py-3 rounded-xl bg-[var(--primary-muted)] text-[var(--primary-light)] border border-[var(--primary)]/30 text-xs font-black uppercase tracking-widest hover:bg-[var(--primary)]/20 transition-all flex items-center justify-center gap-2">
                  <Search className="w-4 h-4" /> Nhận diện khuôn mặt tự động
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Nhân viên vi phạm</label>
                <input value={empName} onChange={(e) => setEmpName(e.target.value)} placeholder="Nhập tên nhân viên..." className="w-full px-3 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-white/10 text-sm text-white outline-none focus:border-[var(--primary)] transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Bộ phận / Tổ đội</label>
                <input value={empDept} onChange={(e) => setEmpDept(e.target.value)} placeholder="Nhập bộ phận..." className="w-full px-3 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-white/10 text-sm text-white outline-none focus:border-[var(--primary)] transition-all" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Lỗi vi phạm</label>
                <input value={reason} readOnly className="w-full px-3 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-white/10 text-sm text-white/80 outline-none" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Mức phạt</label>
                <input value={penalty} onChange={(e) => setPenalty(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-white/10 text-sm text-white outline-none focus:border-[var(--primary)] transition-all" />
              </div>

              <div className="sm:col-span-2 p-3 rounded-xl bg-[var(--background-secondary)] border border-white/5 text-xs text-white/60 flex flex-wrap gap-x-6 gap-y-1">
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{violation.siteName} • {violation.cameraName}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{violation.date || new Date(violation.detectedAt).toLocaleDateString()} {violation.time || ''}</span>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={() => setShowTicket(false)} className="flex-1 py-3.5 rounded-2xl border border-white/10 text-white/60 font-bold text-sm hover:bg-white/5 transition-all">Quay lại</button>
              <button onClick={submitTicket} className="flex-[2] py-3.5 rounded-2xl bg-red-500 text-white font-black text-sm uppercase tracking-widest hover:bg-red-600 transition-all flex items-center justify-center gap-2">
                <Download className="w-4 h-4" /> Xuất phiếu phạt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
