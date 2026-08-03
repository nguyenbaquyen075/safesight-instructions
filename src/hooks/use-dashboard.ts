// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import type { DashboardKPIs, ComplianceTrendPoint, ViolationBreakdown } from '@/types/models';

export function useDashboardKPIs() {
  return useQuery<DashboardKPIs>({
    queryKey: ['dashboard', 'kpis'],
    queryFn: async (): Promise<DashboardKPIs> => {
      const res = await fetch('/api/dashboard/kpis');
      if (!res.ok) throw new Error('Failed to fetch KPIs');
      return res.json();
    },
  });
}

export function useComplianceTrend() {
  return useQuery<ComplianceTrendPoint[]>({
    queryKey: ['dashboard', 'compliance-trend'],
    queryFn: async (): Promise<ComplianceTrendPoint[]> => {
      const res = await fetch('/api/dashboard/compliance-trend');
      if (!res.ok) throw new Error('Failed to fetch compliance trend');
      return res.json();
    },
  });
}

export function useViolationBreakdown() {
  return useQuery<ViolationBreakdown[]>({
    queryKey: ['dashboard', 'violation-breakdown'],
    queryFn: async (): Promise<ViolationBreakdown[]> => {
      const res = await fetch('/api/dashboard/violation-breakdown');
      if (!res.ok) throw new Error('Failed to fetch violation breakdown');
      return res.json();
    },
  });
}
