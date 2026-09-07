'use client';
// SPDX-License-Identifier: MIT


import { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  Info,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { cn, getViolationTypeLabel } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useViolations } from '@/hooks/use-violations';
import { useMounted } from '@/hooks/use-mounted';
import { ViolationDetailModal } from '@/components/violations/ViolationDetailModal';
import { Severity } from '@/types/enums';
import type { Violation } from '@/types/models';

type SeverityFilter = 'TẤT CẢ' | 'NGHIÊM TRỌNG' | 'CAO' | 'TRUNG BÌNH' | 'THẤP';

const READ_KEY = 'safesight_read_alerts';

export default function AlertsPage() {
  const [filter, setFilter] = useState<SeverityFilter>('TẤT CẢ');
  const [search, setSearch] = useState('');
  const mounted = useMounted();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [selectedAlert, setSelectedAlert] = useState<Violation | null>(null);
  const { data: allAlerts = [] } = useViolations();

  useEffect(() => {
    // Nạp trạng thái "đã đọc" từ localStorage SAU khi hydrate (đọc lúc render sẽ lệch
    // server/client). Chuyển sang useSyncExternalStore là refactor riêng vì persistRead
    // cũng ghi state này.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReadIds(new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')));
    } catch {
      setReadIds(new Set());
    }
  }, []);

  if (!mounted) return null;

  const persistRead = (ids: Set<string>) => {
    setReadIds(ids);
    localStorage.setItem(READ_KEY, JSON.stringify(Array.from(ids)));
  };

  const markRead = (id: string) => {
    if (readIds.has(id)) return;
    persistRead(new Set(readIds).add(id));
  };

  const markAllRead = () => {
    persistRead(new Set([...readIds, ...filteredAlerts.map(a => a.id)]));
    toast('Đã đánh dấu tất cả thông báo là đã đọc', 'success');
  };

  const filteredAlerts = allAlerts.filter(alert => {
    const matchesFilter = filter === 'TẤT CẢ' || alert.severity === (filter === 'NGHIÊM TRỌNG' ? Severity.CRITICAL : filter === 'CAO' ? Severity.HIGH : filter === 'TRUNG BÌNH' ? Severity.MEDIUM : Severity.LOW);
    const matchesSearch = alert.siteName.toLowerCase().includes(search.toLowerCase()) ||
                         alert.cameraName.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const last24h = 24 * 60 * 60 * 1000;
  // Cố ý lấy giờ hiện tại mỗi lần render để đếm "24h gần nhất"; trang chỉ render sau hydrate.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const recent = allAlerts.filter(a => now - new Date(a.detectedAt).getTime() < last24h);

  return (
    <div className="space-y-8 pb-20 animate-fade-up">
      {/* Detail Modal */}
      {selectedAlert && (
        <ViolationDetailModal
          violation={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Thông báo Hệ thống</h1>
          <p className="text-[var(--text-muted)] text-sm">Nhật ký thông báo thời gian thực cho tất cả các sự kiện an toàn và hệ thống.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={markAllRead}
            className="px-6 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Lỗi Nghiêm trọng (24h)', value: recent.filter(a => a.severity === Severity.CRITICAL).length.toString(), icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'Vi phạm An toàn (24h)', value: recent.filter(a => a.severity === Severity.HIGH || a.severity === Severity.MEDIUM).length.toString(), icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Tổng số Cảnh báo (24h)', value: recent.length.toString(), icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
        ].map(stat => (
          <div key={stat.label} className="p-6 rounded-[2rem] bg-[var(--surface)] border border-[var(--border)] flex items-center gap-4">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-[var(--text-primary)]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-[var(--surface)] p-4 rounded-3xl border border-[var(--border)] flex flex-col lg:flex-row gap-4 items-center justify-between shadow-sm">
        <div className="relative w-full lg:w-96 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
          <input 
            type="text" 
            placeholder="Tìm kiếm theo công trình hoặc camera..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-[var(--background-secondary)] border border-[var(--border)] rounded-2xl text-sm focus:border-[var(--primary)] outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto scrollbar-none">
          {['TẤT CẢ', 'NGHIÊM TRỌNG', 'CAO', 'TRUNG BÌNH', 'THẤP'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s as SeverityFilter)}
              className={cn(
                "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                filter === s 
                  ? "bg-[var(--primary-muted)] text-[var(--primary-light)] border-[var(--primary)]/30" 
                  : "bg-[var(--background-secondary)] text-[var(--text-muted)] border-transparent hover:border-[var(--border)]"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {filteredAlerts.map((alert, idx) => (
          <div 
            key={alert.id}
            className="group relative bg-[var(--surface)] border border-[var(--border)] p-6 rounded-[2.5rem] hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-xl animate-fade-up"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              {/* Severity Indicator */}
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0",
                alert.severity === Severity.CRITICAL ? "bg-red-500/10 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]" :
                alert.severity === Severity.HIGH ? "bg-amber-500/10 text-amber-500" :
                "bg-blue-500/10 text-blue-500"
              )}>
                {alert.severity === Severity.CRITICAL ? <ShieldAlert className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
              </div>

              {/* Alert Content */}
              <div className="flex-1 space-y-4 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                        alert.severity === Severity.CRITICAL ? "bg-red-500/10 text-red-500 border-red-500/20" :
                        alert.severity === Severity.HIGH ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                        "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}>
                        {alert.severity === Severity.CRITICAL ? 'NGHIÊM TRỌNG' : alert.severity === Severity.HIGH ? 'CAO' : alert.severity === Severity.MEDIUM ? 'TRUNG BÌNH' : 'THẤP'}
                      </span>
                      {!readIds.has(alert.id) && (
                        <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" title="Chưa đọc" />
                      )}
                      <h3 className="text-lg font-black text-[var(--text-primary)] group-hover:text-[var(--primary-light)] transition-colors">{getViolationTypeLabel(alert.type)}</h3>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] font-medium">Mối nguy hiểm an toàn tiềm ẩn được phát hiện trên luồng camera công trường.</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    <div className="flex items-center gap-1.5 bg-[var(--background-secondary)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(alert.detectedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[var(--background-secondary)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(alert.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[var(--border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--background-secondary)] flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-[var(--primary)]" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Công trình</p>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{alert.siteName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--background-secondary)] flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-[var(--success)]" />
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">Camera</p>
                      <p className="text-xs font-bold text-[var(--text-primary)]">{alert.cameraName}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => { markRead(alert.id); setSelectedAlert(alert); }}
                      className="px-6 py-2 rounded-xl bg-[var(--primary)] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[var(--primary-hover)] transition-all shadow-glow-primary active:scale-95 flex items-center gap-2"
                    >
                      Xem xét Sự kiện <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
