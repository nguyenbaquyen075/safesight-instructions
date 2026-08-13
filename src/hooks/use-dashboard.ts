// SPDX-License-Identifier: MIT

import * as React from 'react';
import type { DashboardKPIs, ComplianceTrendPoint, ViolationBreakdown } from '@/types/models';
import { useViolations } from './use-violations';
import { mockCameras } from '@/data/mock-cameras';
import { CameraStatus, ViolationType } from '@/types/enums';
import { getViolationTypeLabel } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (ts: number) => new Date(ts).toISOString().split('T')[0];
const tsOf = (detectedAt: string) => new Date(detectedAt).getTime();

// ponytail: chưa lưu tổng số người AI quan sát mỗi ngày -> suy ra tỉ lệ tuân thủ GẦN ĐÚNG
// từ số vi phạm THẬT (mỗi vi phạm trừ 5 điểm, sàn 0%). Muốn tỉ lệ chính xác -> ghi thêm
// tổng lượt người quét được mỗi ngày rồi tính rate = 1 - vi_phạm/tổng_quan_sát.
export const rateFromCount = (count: number) => Math.max(0, 100 - count * 5);

export function useDashboardKPIs() {
  const { data: violations = [], isLoading } = useViolations();

  const data = React.useMemo<DashboardKPIs>(() => {
    const now = Date.now();
    const today = dayKey(now);
    const yesterday = dayKey(now - DAY_MS);
    const todayCount = violations.filter(v => dayKey(tsOf(v.detectedAt)) === today).length;
    const yesterdayCount = violations.filter(v => dayKey(tsOf(v.detectedAt)) === yesterday).length;
    const violationsTrend = yesterdayCount === 0 ? 0 : Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 1000) / 10;

    const complianceRate = rateFromCount(todayCount);
    const complianceTrend = Math.round((complianceRate - rateFromCount(yesterdayCount)) * 10) / 10;

    const last24h = violations.filter(v => now - tsOf(v.detectedAt) < DAY_MS).length;
    const prev24h = violations.filter(v => now - tsOf(v.detectedAt) >= DAY_MS && now - tsOf(v.detectedAt) < 2 * DAY_MS).length;
    const alertsTrend = prev24h === 0 ? 0 : Math.round(((last24h - prev24h) / prev24h) * 1000) / 10;

    const activeCameras = mockCameras.filter(c => c.status === CameraStatus.ONLINE).length;

    return {
      totalViolationsToday: todayCount,
      violationsTrend,
      complianceRate,
      complianceTrend,
      activeAlerts: last24h,
      alertsTrend,
      activeCameras,
      totalCameras: mockCameras.length,
      onlineRate: Math.round((activeCameras / mockCameras.length) * 1000) / 10,
    };
  }, [violations]);

  return { data, isLoading };
}

export function useComplianceTrend() {
  const { data: violations = [], isLoading } = useViolations();

  const data = React.useMemo<ComplianceTrendPoint[]>(() => {
    const countByDay = new Map<string, number>();
    violations.forEach(v => {
      const k = dayKey(tsOf(v.detectedAt));
      countByDay.set(k, (countByDay.get(k) || 0) + 1);
    });
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const date = d.toISOString().split('T')[0];
      return { date, rate: rateFromCount(countByDay.get(date) || 0) };
    });
  }, [violations]);

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
