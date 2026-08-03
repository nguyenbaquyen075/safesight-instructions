'use client';
// SPDX-License-Identifier: MIT


import { useState, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  Filter, 
  AlertTriangle, 
  ShieldAlert, 
  Info,
  MoreVertical,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { mockViolations } from '@/data/mock-violations';
import { Severity } from '@/types/enums';

type SeverityFilter = 'TẤT CẢ' | 'NGHIÊM TRỌNG' | 'CAO' | 'TRUNG BÌNH' | 'THẤP';

export default function AlertsPage() {
  const [filter, setFilter] = useState<SeverityFilter>('TẤT CẢ');
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [customAlerts, setCustomAlerts] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    const saved = JSON.parse(localStorage.getItem('safesight_alerts') || '[]');
    setCustomAlerts(saved);
  }, []);

  if (!mounted) return null;

  const allAlerts = [...customAlerts, ...mockViolations];

  const filteredAlerts = allAlerts.filter(alert => {
    const matchesFilter = filter === 'TẤT CẢ' || alert.severity === (filter === 'NGHIÊM TRỌNG' ? Severity.CRITICAL : filter === 'CAO' ? Severity.HIGH : filter === 'TRUNG BÌNH' ? Severity.MEDIUM : Severity.LOW);
    const matchesSearch = alert.siteName.toLowerCase().includes(search.toLowerCase()) || 
                         alert.cameraName.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-20 animate-fade-up">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Thông báo Hệ thống</h1>
          <p className="text-[var(--text-muted)] text-sm">Nhật ký thông báo thời gian thực cho tất cả các sự kiện an toàn và hệ thống.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toast('Đã đánh dấu tất cả thông báo là đã đọc', 'success')}
            className="px-6 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            Đánh dấu tất cả đã đọc
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Lỗi Nghiêm trọng', value: '02', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
          { label: 'Vi phạm An toàn', value: '14', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Thông tin Hệ thống', value: '128', icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
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
              onClick={() => setFilter(s as any)}
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
                      <h3 className="text-lg font-black text-[var(--text-primary)] group-hover:text-[var(--primary-light)] transition-colors">{alert.type}</h3>
                    </div>
                    <p className="text-sm text-[var(--text-muted)] font-medium">Mối nguy hiểm an toàn tiềm ẩn được phát hiện trên luồng camera công trường.</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    <div className="flex items-center gap-1.5 bg-[var(--background-secondary)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                      <Calendar className="w-3 h-3" />
                      <span>{alert.date}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[var(--background-secondary)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                      <Clock className="w-3 h-3" />
                      <span>{alert.time}</span>
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
                      onClick={() => toast(`Đang mở chi tiết sự kiện: ${alert.type} tại ${alert.cameraName}`, 'info')}
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
