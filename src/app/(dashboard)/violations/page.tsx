'use client';
// SPDX-License-Identifier: MIT


import { useState, useEffect } from 'react';
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
  PlayCircle
} from 'lucide-react';
import { cn, getViolationTypeLabel } from '@/lib/utils';
import { mockViolations } from '@/data/mock-violations';
import { Severity } from '@/types/enums';
import { MicButton } from '@/components/cameras/MicButton';

// --- Sub-component: Violation Detail Modal ---
function ViolationDetailModal({ violation, onClose }: { violation: any, onClose: () => void }) {
  const [showTicket, setShowTicket] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empDept, setEmpDept] = useState('');
  const [penalty, setPenalty] = useState('200.000đ');

  if (!violation) return null;

  const reason = String(violation.type || '').toLowerCase().match(/mũ|helmet|hard/)
    ? 'Không đội mũ bảo hộ lao động'
    : `Vi phạm: ${getViolationTypeLabel(violation.type)}`;

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
          {violation.clipUrl ? (
            <video 
              src={violation.clipUrl} 
              className="w-full h-full object-contain"
              autoPlay
              controls
              loop
            />
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
                       "{violation.description || `Hệ thống phát hiện tự động đã ghi nhận vi phạm: ${getViolationTypeLabel(violation.type)}. Bằng chứng đã được lưu trữ để xem xét tuân thủ.`}"
                    </p>
                 </div>
              </div>
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
                 onClick={() => toast('Đã ghi nhận xem xét tuân thủ cho vi phạm này', 'success')}
                 className="w-full py-4 rounded-2xl bg-[var(--primary)] text-white font-black text-sm uppercase tracking-widest shadow-glow-primary hover:bg-[var(--primary-hover)] transition-all"
              >
                 Xem xét Tuân thủ
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
                  {violation.clipUrl ? (
                    <video src={violation.clipUrl} autoPlay muted loop className="w-full h-full object-cover" />
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

export default function ViolationsPage() {
  const [mounted, setMounted] = useState(false);
  type SeverityFilter = 'TẤT CẢ' | 'NGHIÊM TRỌNG' | 'CAO';
  const [filter, setFilter] = useState<SeverityFilter>('TẤT CẢ');
  const [aiViolations, setAiViolations] = useState<any[]>([]);
  const [selectedViolation, setSelectedViolation] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    const loadAiAlerts = () => {
      const alerts = JSON.parse(localStorage.getItem('safesight_alerts') || '[]');
      setAiViolations(alerts);
    };

    loadAiAlerts();
    window.addEventListener('new-alert', loadAiAlerts);
    return () => window.removeEventListener('new-alert', loadAiAlerts);
  }, []);

  if (!mounted) return null;

  const allViolations = [...aiViolations, ...mockViolations].filter(v => 
    filter === 'TẤT CẢ' || v.severity === (filter === 'NGHIÊM TRỌNG' ? Severity.CRITICAL : Severity.HIGH)
  );

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
            onClick={() => toast('Đang xuất danh sách vi phạm ra file (demo)', 'success')}
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
          { label: 'Chưa giải quyết', value: allViolations.filter(v => v.status !== 'RESOLVED' && v.status !== 'DISMISSED').length.toString(), icon: AlertCircle, color: 'warning' },
          { label: 'Tỷ lệ tuân thủ', value: '92%', icon: Filter, color: 'success' },
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
                           <span>{violation.date || new Date(violation.detectedAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                           <Clock className="w-3 h-3" />
                           <span>{violation.time || new Date(violation.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                     </div>
                  </div>
                  <button
                     onClick={(e) => { e.stopPropagation(); toast('Tùy chọn thêm cho vi phạm này (demo)', 'info'); }}
                     className="p-2 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--text-muted)] transition-colors"
                  >
                     <MoreVertical className="w-5 h-5" />
                  </button>
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
                        onClick={(e) => { e.stopPropagation(); toast('Đã xóa vi phạm khỏi danh sách (demo)', 'success'); }}
                        className="p-3 rounded-xl hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-500 transition-all"
                     >
                        <Trash2 className="w-5 h-5" />
                     </button>
                     <button
                        onClick={(e) => { e.stopPropagation(); toast('Đã sao chép liên kết chia sẻ vi phạm', 'info'); }}
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
