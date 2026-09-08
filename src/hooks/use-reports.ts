// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import type { ViolationReport } from '@/lib/report-shape';

export interface ReportFilters {
  siteId?: string;
  cameraId?: string;
  from?: string; // "YYYY-MM-DD"
  to?: string;   // "YYYY-MM-DD"
}

export function useViolationReport(filters: ReportFilters) {
  return useQuery<ViolationReport>({
    queryKey: ['reports', 'violations', filters],
    queryFn: async () => {
      const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
      const res = await fetch(`/api/reports/violations?${params.toString()}`);
      if (!res.ok) throw new Error('Không tải được báo cáo vi phạm');
      return res.json();
    },
  });
}
