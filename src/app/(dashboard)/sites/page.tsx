'use client';
// SPDX-License-Identifier: MIT


import { useState, useEffect } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from '@/lib/toast';
import { useViolations } from '@/hooks/use-violations';
import { useRealSitesFromCameras } from '@/hooks/use-real-sites';
import { SiteDetailModal } from '@/components/sites/SiteDetailModal';
import type { SiteStatusSummary } from '@/types/models';
import {
  Building2,
  Plus,
  Search,
  Filter,
  MoreVertical,
  MapPin,
  Camera,
  ShieldAlert,
  ArrowUpRight,
  LayoutGrid,
  List as ListIcon,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  ShieldCheck,
  Eye,
  Copy,
  Trash2
} from 'lucide-react';
import { cn, formatPercentage } from '@/lib/utils';
import { SiteStatus } from '@/types/enums';

// --- Sub-components ---

function RegisterSiteModal({ onClose, onRegister }: { onClose: () => void; onRegister: (data: any) => void }) {
  const [formData, setFormData] = useState({ name: '', location: '', industry: 'Xây dựng Thương mại' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      onRegister(formData);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-[var(--border)] flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-primary)]">Đăng ký Công trình mới</h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">Tạo không gian làm việc mới để giám sát bằng AI.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--background-secondary)] text-[var(--text-muted)] transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Tên Công trình</label>
            <input 
              required
              type="text" 
              placeholder="VD: Vinhomes Ocean Park 3"
              className="w-full px-5 py-3 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm transition-all"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Vị trí</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input 
                required
                type="text" 
                placeholder="Quận/Huyện, Thành phố"
                className="w-full pl-11 pr-5 py-3 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm transition-all"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Lĩnh vực Dự án</label>
            <select 
              className="w-full px-5 py-3 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] outline-none text-sm transition-all appearance-none"
              value={formData.industry}
              onChange={e => setFormData({ ...formData, industry: e.target.value })}
            >
              <option>Xây dựng Thương mại</option>
              <option>Hạ tầng Giao thông</option>
              <option>Khai khoáng & Công nghiệp nặng</option>
            </select>
          </div>

          <div className="pt-4 flex gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl border border-[var(--border)] text-sm font-black text-[var(--text-muted)] uppercase tracking-widest hover:bg-[var(--background-secondary)] transition-all"
            >
              Hủy
            </button>
            <button 
              disabled={isSubmitting}
              className="flex-1 py-4 rounded-2xl bg-[var(--primary)] text-white text-sm font-black uppercase tracking-widest hover:bg-[var(--primary-hover)] transition-all shadow-glow-primary active:scale-95 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Đăng ký Công trình
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SiteStatCard({ title, value, icon: Icon, trend, color }: any) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] p-5 rounded-2xl space-y-3 animate-fade-up">
      <div className="flex justify-between items-start">
        <div className={cn("p-2.5 rounded-xl", color === 'primary' ? 'bg-[var(--primary-muted)] text-[var(--primary)]' : 
                                             color === 'success' ? 'bg-[var(--success-muted)] text-[var(--success)]' : 
                                             color === 'danger' ? 'bg-[var(--danger-muted)] text-[var(--danger)]' : 
                                             'bg-[var(--warning-muted)] text-[var(--warning)]')}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && ( trend !== 0 ) && (
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", 
                               trend > 0 ? "text-[var(--success)] border-[var(--success)]/20 bg-[var(--success-muted)]" : 
                                          "text-[var(--danger)] border-[var(--danger)]/20 bg-[var(--danger-muted)]")}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-[var(--text-muted)] font-medium">{title}</p>
        <h3 className="text-2xl font-black text-[var(--text-primary)] mt-1">{value}</h3>
      </div>
    </div>
  );
}

// --- Main Page ---

export default function SitesPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'TẤT CẢ' | 'HOẠT ĐỘNG' | 'THIẾT LẬP'>('TẤT CẢ');
  const [notification, setNotification] = useState<any>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [customSites, setCustomSites] = useState<SiteStatusSummary[]>([]);
  const [selectedSite, setSelectedSite] = useState<SiteStatusSummary | null>(null);
  const { data: alerts = [] } = useViolations();

  useEffect(() => {
    try {
      setCustomSites(JSON.parse(localStorage.getItem('safesight_custom_sites') || '[]'));
    } catch {
      setCustomSites([]);
    }
  }, []);

  const showNotification = (title: string, desc: string, type: 'success' | 'danger' | 'warning' = 'success') => {
    setNotification({ id: Math.random(), title, desc, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleRegister = (data: any) => {
    showNotification('Đã Đăng ký Công trình', `Đã tạo dự án thành công: ${data.name}`, 'success');

    // Site mới đăng ký -> chưa có camera nào -> trạng thái THIẾT LẬP, lưu localStorage để còn đó sau khi F5
    const newSite: SiteStatusSummary = {
      id: `custom-${Date.now()}`,
      name: data.name,
      complianceRate: 100,
      activeAlerts: 0,
      cameraCount: 0,
      onlineCameras: 0,
      status: SiteStatus.SETUP,
    };
    const updatedSites = [...customSites, newSite];
    setCustomSites(updatedSites);
    localStorage.setItem('safesight_custom_sites', JSON.stringify(updatedSites));

    // Log to system alerts (simulated persistence)
    const newAlert = {
      id: Math.random(),
      type: 'Thông báo Hệ thống',
      severity: 'LOW',
      siteName: data.name,
      cameraName: 'N/A',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: `Một công trình mới đã được đăng ký bởi quản trị viên.`
    };

    const existingAlerts = JSON.parse(localStorage.getItem('safesight_alerts') || '[]');
    localStorage.setItem('safesight_alerts', JSON.stringify([newAlert, ...existingAlerts]));

    // Dispatch event to update sidebar badge
    window.dispatchEvent(new Event('new-alert'));
  };

  // Chỉ site TỰ ĐĂNG KÝ (localStorage) mới xoá được — site gom từ roster camera thật gắn với
  // thiết bị vật lý, không phải thứ UI này nên tự xoá.
  const handleDeleteCustomSite = (site: SiteStatusSummary) => {
    if (!confirm(`Xoá công trình "${site.name}"?`)) return;
    const updated = customSites.filter(s => s.id !== site.id);
    setCustomSites(updated);
    localStorage.setItem('safesight_custom_sites', JSON.stringify(updated));
    toast(`Đã xoá công trình ${site.name}`, 'success');
  };

  // Công trình THẬT: gom theo site từ roster camera thật + số vi phạm thật đã ghi nhận cho site đó
  const sitesFromCameras = useRealSitesFromCameras(alerts);

  const allSites = [...sitesFromCameras, ...customSites];

  const filteredSites = allSites.filter(site => {
    const matchesSearch = site.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'TẤT CẢ' || site.status === (statusFilter === 'HOẠT ĐỘNG' ? SiteStatus.ACTIVE : SiteStatus.SETUP);
    return matchesSearch && matchesStatus;
  });

  const stats = [
    { title: 'Tổng số Công trình', value: allSites.length, icon: Building2, color: 'primary' },
    { title: 'Dự án đang Hoạt động', value: allSites.filter(s => s.status === SiteStatus.ACTIVE).length, icon: Activity, color: 'success' },
    { title: 'Camera Trực tuyến', value: allSites.reduce((acc, s) => acc + s.onlineCameras, 0), icon: Camera, color: 'info' },
    { title: 'Cảnh báo An toàn', value: allSites.reduce((acc, s) => acc + s.activeAlerts, 0), icon: ShieldAlert, color: 'danger' },
  ];

  return (
    <div className="space-y-8 pb-20 relative">
      {/* Modals */}
      {showRegisterModal && (
        <RegisterSiteModal
          onClose={() => setShowRegisterModal(false)}
          onRegister={handleRegister}
        />
      )}
      {selectedSite && (
        <SiteDetailModal
          site={selectedSite}
          violations={alerts}
          onClose={() => setSelectedSite(null)}
        />
      )}

      {/* Dynamic Notification System */}
      {notification && (
        <div className="fixed top-24 right-10 z-[100] animate-slide-in-right">
           <div className={cn(
             "p-4 rounded-[1.5rem] border shadow-2xl flex items-center gap-4 backdrop-blur-2xl max-w-sm transition-all duration-500",
             notification.type === 'danger' ? "bg-red-500/10 border-red-500/30" : 
             notification.type === 'warning' ? "bg-amber-500/10 border-amber-500/30" : 
             "bg-[var(--success-muted)] border-[var(--success)]/30"
           )}>
              <div className={cn(
                "p-3 rounded-xl bg-white/10",
                notification.type === 'danger' ? "text-red-500" : 
                notification.type === 'warning' ? "text-amber-500" : 
                "text-[var(--success)]"
              )}>
                 {notification.type === 'danger' ? <ShieldAlert className="w-6 h-6" /> : 
                  notification.type === 'warning' ? <AlertCircle className="w-6 h-6" /> : 
                  <ShieldCheck className="w-6 h-6" />}
              </div>
              <div className="flex-1">
                 <h4 className="text-sm font-black text-[var(--text-primary)]">{notification.title}</h4>
                 <p className="text-xs text-[var(--text-muted)]">{notification.desc}</p>
              </div>
              <button onClick={() => setNotification(null)} className="text-[var(--text-muted)] hover:text-white p-2">
                 <X className="w-4 h-4" />
              </button>
           </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Công trình Dự án</h1>
          <p className="text-[var(--text-muted)] text-sm">Quản lý các vị trí xây dựng và giám sát tuân thủ toàn công trường.</p>
        </div>
        <button 
          onClick={() => setShowRegisterModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold transition-all shadow-glow-primary active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          <span>Đăng ký Công trình mới</span>
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, idx) => (
          <SiteStatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between gap-4 bg-[var(--surface)] p-4 rounded-2xl border border-[var(--border)] shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
          <div className="relative w-full sm:w-80 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)] group-focus-within:text-[var(--primary)] transition-colors" />
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên công trình..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[var(--background-secondary)] border border-[var(--border)] rounded-xl text-sm focus:border-[var(--primary)] outline-none transition-all"
            />
          </div>
          <div className="flex items-center gap-2 bg-[var(--background-secondary)] p-1 rounded-xl border border-[var(--border)]">
            <button 
              onClick={() => setStatusFilter('TẤT CẢ')}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", statusFilter === 'TẤT CẢ' ? "bg-[var(--surface)] text-[var(--primary-light)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}
            >
              Tất cả
            </button>
            <button 
              onClick={() => setStatusFilter('HOẠT ĐỘNG' as any)}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", statusFilter === 'HOẠT ĐỘNG' ? "bg-[var(--surface)] text-[var(--success)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}
            >
              Hoạt động
            </button>
            <button 
              onClick={() => setStatusFilter('THIẾT LẬP' as any)}
              className={cn("px-4 py-1.5 rounded-lg text-xs font-bold transition-all", statusFilter === 'THIẾT LẬP' ? "bg-[var(--surface)] text-[var(--warning)] shadow-sm" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]")}
            >
              Thiết lập
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-[var(--background-secondary)] p-1 rounded-xl border border-[var(--border)]">
            <button 
              onClick={() => setViewMode('grid')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-1.5 rounded-lg transition-all", viewMode === 'list' ? "bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "text-[var(--text-muted)]")}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => toast('Bộ lọc nâng cao sắp ra mắt — hiện lọc theo trạng thái phía trên', 'info')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
          >
            <Filter className="w-4 h-4" />
            <span>Bộ lọc</span>
          </button>
        </div>
      </div>

      {/* Sites Content */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSites.map((site, idx) => (
            <div 
              key={site.id} 
              className="group relative flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-xl animate-fade-up"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              {/* Site Image Placeholder / Header */}
              <div className="h-32 bg-gradient-to-br from-[var(--background-secondary)] to-[var(--surface-elevated)] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 group-hover:scale-110 transition-transform duration-700">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=800')] bg-cover bg-center" />
                </div>
                <div className="absolute top-4 right-4">
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md shadow-sm",
                    site.status === SiteStatus.ACTIVE 
                      ? "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20" 
                      : "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
                  )}>
                    {site.status === SiteStatus.ACTIVE ? 'HOẠT ĐỘNG' : 'THIẾT LẬP'}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black text-[var(--text-primary)] group-hover:text-[var(--primary-light)] transition-colors line-clamp-1">{site.name}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
                      <MapPin className="w-3 h-3" />
                      <span>Quận 9, TP. Thủ Đức</span>
                    </div>
                  </div>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-lg hover:bg-[var(--background-secondary)] text-[var(--text-muted)] transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                        className="min-w-[200px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-2xl z-50"
                      >
                        <DropdownMenu.Item
                          onSelect={() => setSelectedSite(site)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] outline-none cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => { navigator.clipboard.writeText(site.id); toast('Đã sao chép ID công trình', 'success'); }}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] outline-none cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" /> Sao chép ID công trình
                        </DropdownMenu.Item>
                        {site.id.startsWith('custom-') && (
                          <DropdownMenu.Item
                            onSelect={() => handleDeleteCustomSite(site)}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-muted)] outline-none cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Xoá công trường
                          </DropdownMenu.Item>
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Cảnh báo</span>
                    </div>
                    <p className={cn("text-lg font-black", site.activeAlerts > 0 ? "text-[var(--danger)]" : "text-[var(--text-primary)]")}>
                      {site.activeAlerts}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] justify-end">
                      <Camera className="w-3.5 h-3.5" />
                      <span>Camera</span>
                    </div>
                    <p className="text-lg font-black text-[var(--text-primary)]">
                      {site.onlineCameras}<span className="text-[var(--text-muted)] text-sm font-bold">/{site.cameraCount}</span>
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-wider">Tỷ lệ Tuân thủ</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 w-24 bg-[var(--background-secondary)] rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-1000", 
                            site.complianceRate >= 90 ? "bg-[var(--success)] shadow-[0_0_8px_var(--success)]" : 
                            site.complianceRate >= 80 ? "bg-[var(--warning)]" : "bg-[var(--danger)]"
                          )} 
                          style={{ width: `${site.complianceRate}%` }} 
                        />
                      </div>
                      <span className={cn("text-sm font-black", 
                        site.complianceRate >= 90 ? "text-[var(--success)]" : 
                        site.complianceRate >= 80 ? "text-[var(--warning)]" : "text-[var(--danger)]"
                      )}>
                        {site.complianceRate}%
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedSite(site); }}
                    className="flex items-center gap-1 text-[10px] font-black text-[var(--primary)] uppercase hover:underline"
                  >
                    Xem chi tiết <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm animate-fade-up">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--background-secondary)]/50 border-b border-[var(--border)]">
                <th className="px-6 py-4 text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">Tên Dự án</th>
                <th className="px-6 py-4 text-xs font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Tuân thủ</th>
                <th className="px-6 py-4 text-xs font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Camera</th>
                <th className="px-6 py-4 text-xs font-black text-[var(--text-muted)] uppercase tracking-widest text-center">Cảnh báo</th>
                <th className="px-6 py-4 text-xs font-black text-[var(--text-muted)] uppercase tracking-widest text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredSites.map((site) => (
                <tr key={site.id} className="hover:bg-[var(--surface-hover)] transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[var(--primary-muted)] flex items-center justify-center text-[var(--primary)]">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-light)] transition-colors">{site.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">ID: {site.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase border",
                      site.status === SiteStatus.ACTIVE 
                        ? "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20" 
                        : "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
                    )}>
                      {site.status === SiteStatus.ACTIVE ? 'HOẠT ĐỘNG' : 'THIẾT LẬP'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-1">
                      <span className={cn("text-sm font-bold", site.complianceRate >= 90 ? "text-[var(--success)]" : "text-[var(--warning)]")}>
                        {site.complianceRate}%
                      </span>
                      <div className="w-20 h-1 bg-[var(--background-secondary)] rounded-full overflow-hidden">
                        <div className="h-full bg-current rounded-full" style={{ width: `${site.complianceRate}%`, color: site.complianceRate >= 90 ? 'var(--success)' : 'var(--warning)' }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{site.onlineCameras}/{site.cameraCount}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Thiết bị trực tuyến</p>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg font-black text-sm",
                      site.activeAlerts > 0 ? "bg-[var(--danger-muted)] text-[var(--danger)]" : "text-[var(--text-muted)]"
                    )}>
                      <ShieldAlert className="w-4 h-4" />
                      {site.activeAlerts}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedSite(site); }}
                      className="p-2 rounded-lg hover:bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--primary)] transition-all"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {filteredSites.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-[var(--surface)] border border-dashed border-[var(--border)] rounded-2xl animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-[var(--background-secondary)] flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">Không tìm thấy công trình</h3>
          <p className="text-sm text-[var(--text-muted)] mt-1">Thử điều chỉnh tìm kiếm hoặc bộ lọc.</p>
          <button 
            onClick={() => { setSearchQuery(''); setStatusFilter('TẤT CẢ'); }}
            className="mt-6 text-sm font-bold text-[var(--primary)] hover:underline"
          >
            Xóa tất cả bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}
