'use client';
// SPDX-License-Identifier: MIT


import { useState } from 'react';
import { toast } from '@/lib/toast';
import {
  User,
  Building,
  Bell,
  Shield,
  Sliders,
  Save,
  ShieldAlert,
  Mail,
  Smartphone,
  Siren,
  CheckCircle2,
  AlertCircle,
  X,
  Video
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionHeader, SettingCard, InputGroup, Switch } from '@/components/settings/ui';
import { TelegramBotCard } from '@/components/settings/TelegramBotCard';
import { AlertRulesCard } from '@/components/settings/AlertRulesCard';
import { CameraMonitoringCard } from '@/components/settings/CameraMonitoringCard';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'cameras' | 'monitoring' | 'notifications' | 'security'>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ id: number; title: string; desc: string; type: 'success' | 'danger' | 'warning' } | null>(null);

  const showNotification = (title: string, desc: string, type: 'success' | 'danger' | 'warning' = 'success') => {
    setNotification({ id: Math.random(), title, desc, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showNotification('Đã lưu Cài đặt', 'Tùy chọn không gian làm việc của bạn đã được cập nhật thành công.', 'success');
    }, 1200);
  };

  const tabs = [
    { id: 'profile', label: 'Tài khoản & Tổ chức', icon: User },
    { id: 'cameras', label: 'Giám sát', icon: Video },
    { id: 'monitoring', label: 'Giám sát AI', icon: Sliders },
    { id: 'notifications', label: 'Thông báo', icon: Bell },
    { id: 'security', label: 'Bảo mật', icon: Shield },
  ] as const;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-up relative">
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
                  <CheckCircle2 className="w-6 h-6" />}
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">Cài đặt</h1>
          <p className="text-[var(--text-muted)]">Cấu hình không gian làm việc SafeSight AI của bạn</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-bold transition-all shadow-glow-primary active:scale-95 disabled:opacity-50 whitespace-nowrap"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Đang lưu...' : 'Lưu Cấu hình'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                  isActive
                    ? "bg-[var(--primary-muted)] text-[var(--primary-light)] border border-[var(--primary)]/20"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface)] border border-transparent"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-[var(--primary)]" : "")} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 space-y-6">
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fade-up">
              <SettingCard>
                <SectionHeader 
                  title="Thông tin Cá nhân" 
                  description="Cập nhật chi tiết cá nhân và cách người khác thấy bạn trên nền tảng." 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2 flex items-center gap-6 mb-4">
                    <div className="w-20 h-20 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border)] flex items-center justify-center overflow-hidden relative group">
                      <User className="w-10 h-10 text-[var(--text-muted)]" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        <span className="text-[10px] font-bold text-white uppercase">Tải lên</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-[var(--text-primary)]">Ảnh Đại diện</h4>
                      <p className="text-xs text-[var(--text-muted)]">Khuyên dùng: 256x256px PNG/JPG</p>
                      <button onClick={() => toast('Chọn ảnh đại diện mới (demo)', 'info')} className="text-xs text-[var(--primary)] font-bold hover:underline">Thay đổi Ảnh đại diện</button>
                    </div>
                  </div>
                  <InputGroup label="Họ và Tên">
                    <input type="text" defaultValue="Quản trị viên SafeSight" className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none transition-all" />
                  </InputGroup>
                  <InputGroup label="Địa chỉ Email">
                    <input type="email" defaultValue="admin@safesight.ai" className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none transition-all" />
                  </InputGroup>
                </div>
              </SettingCard>

              <SettingCard>
                <SectionHeader 
                  title="Tổ chức" 
                  description="Quản lý chi tiết công ty và thương hiệu không gian làm việc." 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputGroup label="Tên Công ty">
                    <div className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
                      <Building className="w-4 h-4 text-[var(--text-muted)]" />
                      <input type="text" defaultValue="Tập đoàn Xây dựng SafeSight" className="bg-transparent border-none focus:outline-none text-sm w-full" />
                    </div>
                  </InputGroup>
                  <InputGroup label="Ngành nghề">
                    <select className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none transition-all">
                      <option>Xây dựng Thương mại</option>
                      <option>Hạ tầng Giao thông</option>
                      <option>Khai khoáng & Công nghiệp nặng</option>
                    </select>
                  </InputGroup>
                </div>
              </SettingCard>
            </div>
          )}

          {activeTab === 'cameras' && (
            <div className="space-y-6 animate-fade-up">
              <CameraMonitoringCard />
            </div>
          )}

          {activeTab === 'monitoring' && (
            <div className="space-y-6 animate-fade-up">
              <SettingCard>
                <SectionHeader
                  title="Độ nhạy Phát hiện AI"
                  description="Điều chỉnh mức độ nghiêm ngặt của công cụ AI trong việc xác định vi phạm an toàn." 
                />
                <div className="space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">Ngưỡng Tin cậy</span>
                      <span className="font-bold text-[var(--primary-light)]">85%</span>
                    </div>
                    <input type="range" min="50" max="99" defaultValue="85" className="w-full h-1.5 bg-[var(--background-secondary)] rounded-full appearance-none cursor-pointer accent-[var(--primary)] shadow-sm" />
                    <div className="flex justify-between text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                      <span>Độ chính xác thấp hơn (Cảnh báo giả)</span>
                      <span>Độ chính xác cao hơn (Chính xác)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 pt-6 border-t border-[var(--border)]">
                    <Switch label="Phát hiện Xâm nhập Vùng" description="Giám sát các khu vực hạn chế" enabled={true} onChange={() => {}} />
                    <Switch label="Kiểm tra Tuân thủ PPE" description="Mũ, áo phản quang, kính" enabled={true} onChange={() => {}} />
                    <Switch label="Cảnh báo Sử dụng Điện thoại" description="Phát hiện sử dụng điện thoại" enabled={false} onChange={() => {}} />
                    <Switch label="Cảnh báo Khoảng cách Phương tiện" description="An toàn máy móc hạng nặng" enabled={true} onChange={() => {}} />
                  </div>
                </div>
              </SettingCard>

              <SettingCard>
                <SectionHeader 
                  title="Dữ liệu & Lưu trữ" 
                  description="Kiểm soát chính sách lưu trữ cho các đoạn phim vi phạm và nhật ký." 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InputGroup label="Thời gian lưu trữ">
                    <select className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] focus:border-[var(--primary)] text-sm outline-none">
                      <option>90 Ngày</option>
                      <option>180 Ngày</option>
                      <option>365 Ngày</option>
                      <option>Vô thời hạn</option>
                    </select>
                  </InputGroup>
                  <div className="flex items-center pt-6">
                    <Switch label="Ẩn danh Khuôn mặt" description="Tuân thủ quyền riêng tư" enabled={true} onChange={() => {}} />
                  </div>
                </div>
              </SettingCard>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-fade-up">
              <SettingCard>
                <SectionHeader 
                  title="Kênh Cảnh báo" 
                  description="Cấu hình nơi bạn nhận thông báo an toàn thời gian thực." 
                />
                <div className="space-y-4">
                  {[
                    { id: 'email', label: 'Cảnh báo Email', icon: Mail, color: 'var(--primary)', desc: 'Gửi tới admin@safesight.ai' },
                    { id: 'push', label: 'Thông báo Đẩy', icon: Smartphone, color: 'var(--success)', desc: 'Ứng dụng Di động & Trình duyệt' },
                    { id: 'siren', label: 'Kích hoạt Còi báo động', icon: Siren, color: 'var(--danger)', desc: 'Kích hoạt còi phần cứng' },
                  ].map((channel) => (
                    <div key={channel.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] hover:border-[var(--primary)]/30 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[var(--surface)]" style={{ color: channel.color }}>
                          <channel.icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-[var(--text-primary)]">{channel.label}</h4>
                          <p className="text-[10px] text-[var(--text-muted)]">{channel.desc}</p>
                        </div>
                      </div>
                      <Switch enabled={channel.id !== 'siren'} label="" onChange={() => {}} />
                    </div>
                  ))}
                </div>
              </SettingCard>
              <TelegramBotCard />
              <AlertRulesCard />
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-up">
              <SettingCard>
                <SectionHeader 
                  title="Bảo mật & Truy cập" 
                  description="Bảo vệ tài khoản và quản lý khóa API." 
                />
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <InputGroup label="Mật khẩu Hiện tại">
                      <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none" />
                    </InputGroup>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InputGroup label="Mật khẩu Mới">
                        <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none" />
                      </InputGroup>
                      <InputGroup label="Xác nhận Mật khẩu Mới">
                        <input type="password" placeholder="••••••••" className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none" />
                      </InputGroup>
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-[var(--border)]">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--danger-muted)] border border-[var(--danger)]/20">
                      <div className="flex items-center gap-4">
                        <ShieldAlert className="w-6 h-6 text-[var(--danger)]" />
                        <div>
                          <h4 className="text-sm font-bold text-[var(--danger)]">2FA đang bị Tắt</h4>
                          <p className="text-xs text-[var(--text-muted)]">Bật xác thực 2 yếu tố để bảo mật tốt hơn</p>
                        </div>
                      </div>
                      <button onClick={() => toast('Đã bật xác thực 2 lớp (demo)', 'success')} className="px-4 py-2 rounded-lg bg-[var(--danger)] text-white text-xs font-bold hover:bg-[var(--danger-hover)] transition-all">Bật</button>
                    </div>
                  </div>
                </div>
              </SettingCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
