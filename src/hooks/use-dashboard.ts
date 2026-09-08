// SPDX-License-Identifier: MIT

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardKPIs, ComplianceTrendPoint, ViolationBreakdown } from '@/types/models';
import type { ComplianceDay } from '@/lib/compliance-shape';
import { useViolations } from './use-violations';
import { useCameras } from './use-cameras';
import { CameraStatus, ViolationType } from '@/types/enums';
import { getViolationTypeLabel } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const TREND_DAYS = 30;
const dayKey = (ts: number) => new Date(ts).toISOString().split('T')[0];
const tsOf = (detectedAt: string) => new Date(detectedAt).getTime();

// Ước lượng DỰ PHÒNG cho ngày chưa có dòng ObservationStat nào (engine chưa chạy, hoặc
// dữ liệu cũ trước tính năng này): mỗi vi phạm trừ 5 điểm, sàn 0%. Số thật đến từ
// /api/stats/compliance; chỗ nào dùng ước lượng thì giao diện phải ghi rõ "ước tính".
export const rateFromCount = (count: number) => Math.max(0, 100 - count * 5);

/** Tỉ lệ tuân thủ THẬT theo ngày (30 ngày gần nhất) từ số người quan sát được. */
export function useComplianceStats() {
  return useQuery<ComplianceDay[]>({
    queryKey: ['stats', 'compliance', TREND_DAYS],
    queryFn: async () => {
      const from = new Date(Date.now() - (TREND_DAYS - 1) * DAY_MS).toISOString();
      const res = await fetch(`/api/stats/compliance?from=${encodeURIComponent(from)}`);
      if (!res.ok) throw new Error('Failed to fetch compliance stats');
      return res.json();
    },
  });
}

// rate 0–1 của API -> phần trăm hiển thị; null (chưa quan sát) -> ước lượng theo số vi phạm.
const ratePercent = (day: ComplianceDay | undefined, violationCount: number) =>
  day?.complianceRate == null ? rateFromCount(violationCount) : Math.round(day.complianceRate * 1000) / 10;

export function useDashboardKPIs() {
  const { data: violations = [], isLoading } = useViolations();
  const { data: complianceStats = [] } = useComplianceStats();
  // includeDemo: khớp đúng danh sách trang Camera (và cùng khoá React Query với trang đó).
  const { data: cameras = [] } = useCameras({ includeDemo: true });

  const data = React.useMemo<DashboardKPIs>(() => {
    // Cố ý: KPI "hôm nay/hôm qua" tính theo giờ thật tại lần đổi dữ liệu vi phạm.
    const now = Date.now();
    const today = dayKey(now);
    const yesterday = dayKey(now - DAY_MS);
    const todayCount = violations.filter(v => dayKey(tsOf(v.detectedAt)) === today).length;
    const yesterdayCount = violations.filter(v => dayKey(tsOf(v.detectedAt)) === yesterday).length;
    const violationsTrend = yesterdayCount === 0 ? 0 : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 1000) / 10;

    const todayStat = complianceStats.find(d => d.day === today);
    const yesterdayStat = complianceStats.find(d => d.day === yesterday);
    const complianceRate = ratePercent(todayStat, todayCount);
    const complianceTrend = Math.round((complianceRate - ratePercent(yesterdayStat, yesterdayCount)) * 10) / 10;

    const last24h = violations.filter(v => now - tsOf(v.detectedAt) < DAY_MS).length;
    const prev24h = violations.filter(v => now - tsOf(v.detectedAt) >= DAY_MS && now - tsOf(v.detectedAt) < 2 * DAY_MS).length;
    const alertsTrend = prev24h === 0 ? 0 : Math.round(((last24h - prev24h) / prev24h) * 1000) / 10;

    const activeCameras = cameras.filter(c => c.status === CameraStatus.ONLINE).length;

    return {
      totalViolationsToday: todayCount,
      violationsTrend,
      complianceRate,
      complianceTrend,
      complianceEstimated: todayStat?.complianceRate == null,
      activeAlerts: last24h,
      alertsTrend,
      activeCameras,
      totalCameras: cameras.length,
      onlineRate: cameras.length === 0 ? 0 : Math.round((activeCameras / cameras.length) * 1000) / 10,
    };
  }, [violations, complianceStats, cameras]);

  return { data, isLoading };
}

export function useComplianceTrend() {
  const { data: violations = [], isLoading } = useViolations();
  const { data: complianceStats = [] } = useComplianceStats();

  const data = React.useMemo<ComplianceTrendPoint[]>(() => {
    const countByDay = new Map<string, number>();
    violations.forEach(v => {
      const k = dayKey(tsOf(v.detectedAt));
      countByDay.set(k, (countByDay.get(k) || 0) + 1);
    });
    const statByDay = new Map(complianceStats.map(d => [d.day, d]));
    return Array.from({ length: TREND_DAYS }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (TREND_DAYS - 1 - i));
      const date = d.toISOString().split('T')[0];
      return { date, rate: ratePercent(statByDay.get(date), countByDay.get(date) || 0) };
    });
  }, [violations, complianceStats]);

  return { data, isLoading };
}

export function useViolationBreakdown() {
  const { data: violations = [], isLoading } = useViolations();

  const data = React.useMemo<ViolationBreakdown[]>(() => {
    const counts = new Map<string, number>();
    violations.forEach(v => counts.set(v.type, (counts.get(v.type) || 0) + 1));
    const total = violations.length;
    const palette = ['#DC2626', '#EA580C', '#F59E0B', '#2563EB', '#7C3AED', '#059669'];
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count], i) => ({
        type: type as ViolationType,
        label: getViolationTypeLabel(type),
        count,
        percentage: total === 0 ? 0 : Math.round((count / total) * 1000) / 10,
        color: palette[i % palette.length],
      }));
  }, [violations]);

  return { data, isLoading };
}
