'use client';
// SPDX-License-Identifier: MIT


import * as React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  Users, 
  Clock, 
  Calendar,
  Filter,
  Download,
  ChevronDown,
  Activity,
  PieChart as PieIcon,
  LineChart as LineIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useComplianceTrend, useViolationBreakdown } from '@/hooks/use-dashboard';
import { 
  ComplianceChart 
} from '@/components/dashboard/ComplianceChart';
import { 
  ViolationDonut 
} from '@/components/dashboard/ViolationDonut';

export default function AnalyticsPage() {
  const [mounted, setMounted] = React.useState(false);

  // Các hook phải gọi TRƯỚC mọi return sớm (Rules of Hooks) — nếu không React vỡ trang
  const { data: trend } = useComplianceTrend();
  const { data: breakdown } = useViolationBreakdown();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="space-y-8 pb-20 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Phân tích An toàn</h1>
          <p className="text-[var(--text-muted)] text-sm">Tìm hiểu sâu về tuân thủ công trường và xu hướng phát hiện của AI.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => toast('Đang hiển thị dữ liệu 30 ngày qua', 'info')}
            className="px-6 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-sm font-bold text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            30 Ngày qua
          </button>
          <button
            onClick={() => { toast('Đang chuẩn bị bản in/PDF...', 'success'); setTimeout(() => window.print(), 300); }}
            className="px-6 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-black uppercase tracking-widest hover:bg-[var(--primary-hover)] transition-all shadow-glow-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Xuất PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Tuân thủ Tổng thể', value: '94.2%', trend: '+2.1%', icon: TrendingUp, color: 'success' },
          { label: 'Vi phạm PPE', value: '142', trend: '-12%', icon: ShieldAlert, color: 'danger' },
          { label: 'T.gian Phát hiện TB', value: '1.2s', trend: '-0.3s', icon: Clock, color: 'primary' },
          { label: 'Công nhân hoạt động', value: '854', trend: '+45', icon: Users, color: 'info' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[var(--surface)] border border-[var(--border)] p-6 rounded-[2rem] relative overflow-hidden group">
            <div className="flex justify-between items-start relative z-10">
               <div>
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{kpi.label}</p>
                  <h3 className="text-3xl font-black text-[var(--text-primary)]">{kpi.value}</h3>
                  <div className={cn(
                    "flex items-center gap-1 mt-2 text-[10px] font-bold",
                    kpi.trend.startsWith('+') ? "text-[var(--success)]" : "text-red-500"
                  )}>
                    {kpi.trend} so với tháng trước
                  </div>
               </div>
               <div className={cn("p-3 rounded-2xl bg-[var(--surface-elevated)]", 
                  kpi.color === 'success' ? 'text-[var(--success)]' : 
                  kpi.color === 'danger' ? 'text-red-500' : 'text-[var(--primary)]'
               )}>
                  <kpi.icon className="w-6 h-6" />
               </div>
            </div>
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-[var(--primary)] opacity-[0.02] rounded-full group-hover:scale-150 transition-transform duration-1000" />
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] p-10 relative overflow-hidden">
           <div className="flex justify-between items-center mb-10 relative z-10">
              <div>
                 <h3 className="text-xl font-black text-[var(--text-primary)]">Xu hướng Tuân thủ</h3>
                 <p className="text-xs text-[var(--text-muted)] mt-1">Theo dõi thời gian thực về tuân thủ an toàn trên tất cả các công trường.</p>
              </div>
              <div className="flex items-center gap-2">
                 <button
                    onClick={() => toast('Chế độ biểu đồ đường', 'info')}
                    className="p-2 rounded-lg bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-white transition-colors"
                 >
                    <LineIcon className="w-4 h-4" />
                 </button>
                 <button
                    onClick={() => toast('Chế độ biểu đồ cột', 'info')}
                    className="p-2 rounded-lg bg-[var(--primary-muted)] text-[var(--primary)]"
                 >
                    <BarChart3 className="w-4 h-4" />
                 </button>
              </div>
           </div>
           <div className="h-[400px] relative z-10">
              <ComplianceChart data={trend ?? []} />
           </div>
           <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)] opacity-[0.01] rounded-full -mr-32 -mt-32" />
        </div>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2.5rem] p-10 flex flex-col">
           <div className="mb-10">
              <h3 className="text-xl font-black text-[var(--text-primary)]">Phân loại Vi phạm</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1">Phân loại các sự kiện không tuân thủ an toàn theo hạng mục.</p>
           </div>
           <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
              <ViolationDonut data={breakdown ?? []} />
           </div>
           <div className="grid grid-cols-2 gap-4 mt-10">
              <div className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)]">
                 <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Thiếu Mũ</p>
                 <p className="text-lg font-black text-white">62%</p>
              </div>
              <div className="p-4 rounded-2xl bg-[var(--background-secondary)] border border-[var(--border)]">
                 <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">Thiếu Áo</p>
                 <p className="text-lg font-black text-white">25%</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
