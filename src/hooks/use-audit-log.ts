// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import type { AuditLogEntry } from '@/types/models';

export function useAuditLog(filters?: { limit?: number; resource?: string }) {
  return useQuery<AuditLogEntry[]>({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.limit) params.append('limit', String(filters.limit));
      if (filters?.resource) params.append('resource', filters.resource);

      const res = await fetch(`/api/audit-log?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch audit log');
      return res.json();
    },
  });
}
