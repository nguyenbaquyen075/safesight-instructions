'use client';
// SPDX-License-Identifier: MIT


import {
  AlertTriangle,
  Camera,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  Activity,
} from 'lucide-react';
import Link from 'next/link';
import { cn, formatPercentage } from '@/lib/utils';
import { useDashboardKPIs, useComplianceTrend, useViolationBreakdown } from '@/hooks/use-dashboard';
import { useViolations } from '@/hooks/use-violations';
import { useRealSitesFromCameras } from '@/hooks/use-real-sites';
import { ComplianceChart } from '@/components/dashboard/ComplianceChart';
import { ViolationDonut } from '@/components/dashboard/ViolationDonut';
import { AlertTimeline } from '@/components/dashboard/AlertTimeline';
import { SiteStatusGrid } from '@/components/dashboard/SiteStatusGrid';
import { AlertChannel, AlertStatus, ViolationStatus } from '@/types/enums';
import type { Alert } from '@/types/models';

interface KPICardProps {
  title: string;
  value: string | number;
  trend: number;
  icon: React.ElementType;
  iconBg: string;
  suffix?: string;
  isLoading?: boolean;
}

function KPICard({ title, value, trend, icon: Icon, iconBg, suffix, isLoading }: KPICardProps) {
  const isPositive = trend >= 0;
  const trendIsGood = title === 'Compliance Rate' ? isPositive : !isPositive;

  if (isLoading) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 animate-pulse">
        <div className="h-4 w-24 bg-[var(--surface-elevated)] rounded mb-4" />
        <div className="h-8 w-32 bg-[var(--surface-elevated)] rounded mb-2" />
        <div className="h-3 w-40 bg-[var(--surface-elevated)] rounded" />
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-lg animate-fade-up">
      <div
        className={cn(
          'absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity',
          iconBg === 'danger' ? 'gradient-danger' : 'gradient-primary'
        )}
      />

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-[var(--text-muted)]">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-[var(--text-primary)] animate-count-up">
              {value}
            </span>
            {suffix && (
              <span className="text-lg text-[var(--text-muted)]">{suffix}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {trendIsGood ? (
              <TrendingUp className="w-3.5 h-3.5 text-[var(--success)]" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-[var(--danger)]" />
            )}
            <span
              className={cn(
                'text-xs font-medium',
                trendIsGood ? 'text-[var(--success)]' : 'text-[var(--danger)]'
              )}
            >
              {isPositive ? '+' : ''}
              {trend}% vs yesterday
            </span>
          </div>
        </div>

        <div
          className={cn(
            'p-3 rounded-xl',
            iconBg === 'danger'
              ? 'bg-[var(--danger-muted)]'
              : iconBg === 'warning'
              ? 'bg-[var(--warning-muted)]'
              : iconBg === 'success'
              ? 'bg-[var(--success-muted)]'
              : 'bg-[var(--primary-muted)]'
          )}
        >
          <Icon
            className={cn(
              'w-6 h-6',
              iconBg === 'danger'
                ? 'text-[var(--danger)]'
                : iconBg === 'warning'
                ? 'text-[var(--warning)]'
                : iconBg === 'success'
                ? 'text-[var(--success)]'
                : 'text-[var(--primary)]'
            )}
          />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: kpis, isLoading: kpisLoading } = useDashboardKPIs();
  const { data: trend, isLoading: trendLoading } = useComplianceTrend();
  const { data: breakdown, isLoading: breakdownLoading } = useViolationBreakdown();
  const { data: violations = [], isLoading: alertsLoading } = useViolations();
  const sites = useRealSitesFromCameras(violations);
  const sitesLoading = alertsLoading;

  // Bọc mỗi vi phạm thật thành 1 "Alert" để tái dùng AlertTimeline có sẵn (không có bảng Alert
  // riêng cho luồng thật này — mỗi vi phạm THẬT đã tự thân là 1 cảnh báo trong hệ thống).
  const alerts: Alert[] = violations.slice(0, 20).map(v => ({
    id: v.id,
    violationId: v.id,
    violation: v,
    channel: AlertChannel.IN_APP,
    recipient: '',
    status: v.status === ViolationStatus.RESOLVED ? AlertStatus.RESOLVED : AlertStatus.NEW,
    sentAt: v.detectedAt,
    createdAt: v.detectedAt,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Vi phạm hôm nay"
          value={kpis?.totalViolationsToday ?? 0}
          trend={kpis?.violationsTrend ?? 0}
          icon={AlertTriangle}
          iconBg="danger"
          isLoading={kpisLoading}
        />
        <KPICard
          title="Tỷ lệ tuân thủ"
          value={formatPercentage(kpis?.complianceRate ?? 0, 1)}
          trend={kpis?.complianceTrend ?? 0}
          icon={ShieldCheck}
          iconBg="success"
          isLoading={kpisLoading}
        />
        <KPICard
          title="Cảnh báo hoạt động"
          value={kpis?.activeAlerts ?? 0}
          trend={kpis?.alertsTrend ?? 0}
          icon={Activity}
          iconBg="warning"
          isLoading={kpisLoading}
        />
        <KPICard
          title="Camera trực tuyến"
          value={kpis ? `${kpis.activeCameras}/${kpis.totalCameras}` : '0/0'}
          trend={0}
          icon={Camera}
          iconBg="primary"
          isLoading={kpisLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compliance Trend — 2/3 width */}
        <div className="lg:col-span-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 group relative overflow-hidden hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-lg animate-fade-up" style={{ animationDelay: '100ms' }}>
          <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity gradient-primary" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Xu hướng tuân thủ
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Tỷ lệ tuân thủ PPE trong 30 ngày qua
              </p>
            </div>
          </div>
          <div className="relative z-10 h-[300px]">
            {trendLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ComplianceChart data={trend ?? []} />
            )}
          </div>
        </div>

        {/* Violation Breakdown — 1/3 width */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 group relative overflow-hidden hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-lg animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity gradient-primary" />
          <div className="mb-4 relative z-10">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Loại vi phạm
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Phân loại theo danh mục hôm nay
            </p>
          </div>
          <div className="relative z-10 h-[300px]">
            {breakdownLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <ViolationDonut data={breakdown ?? []} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Alerts */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 group relative overflow-hidden hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-lg animate-fade-up" style={{ animationDelay: '300ms' }}>
          <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity gradient-danger" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Thông báo gần đây
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Các cảnh báo an toàn mới nhất
              </p>
            </div>
            <Link
              href="/alerts"
              className="flex items-center gap-1 text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] font-medium transition-colors"
            >
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="relative z-10 min-h-[300px]">
            {alertsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-[var(--surface-elevated)]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 bg-[var(--surface-elevated)] rounded" />
                      <div className="h-3 w-1/2 bg-[var(--surface-elevated)] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <AlertTimeline alerts={alerts?.slice(0, 5) ?? []} />
            )}
          </div>
        </div>

        {/* Site Status */}
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 group relative overflow-hidden hover:border-[var(--primary)]/30 transition-all duration-300 hover:shadow-lg animate-fade-up" style={{ animationDelay: '400ms' }}>
          <div className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity gradient-success" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                Trạng thái công trường
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Tổng quan tuân thủ theo công trường
              </p>
            </div>
            <Link
              href="/sites"
              className="flex items-center gap-1 text-xs text-[var(--primary)] hover:text-[var(--primary-hover)] font-medium transition-colors"
            >
              Xem tất cả <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="relative z-10 min-h-[300px]">
            {sitesLoading ? (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-24 bg-[var(--surface-elevated)] rounded-lg animate-pulse" />
                  ))}
               </div>
            ) : (
              <SiteStatusGrid sites={sites} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
