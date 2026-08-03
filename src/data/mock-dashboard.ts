// SPDX-License-Identifier: MIT

/* ===== SafeSight AI — Mock Data: Dashboard KPIs ===== */

import { ViolationType, SiteStatus } from '@/types/enums';
import type { DashboardKPIs, ComplianceTrendPoint, ViolationBreakdown, SiteStatusSummary } from '@/types/models';

export const mockDashboardKPIs: DashboardKPIs = {
  totalViolationsToday: 8,
  violationsTrend: -12.5,
  complianceRate: 92.0,
  complianceTrend: 2.3,
  activeAlerts: 3,
  alertsTrend: -8.2,
  activeCameras: 6,
  totalCameras: 12,
  onlineRate: 50.0,
};

export const mockComplianceTrend: ComplianceTrendPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const base = 88 + Math.random() * 8;
  return { date: date.toISOString().split('T')[0], rate: Math.round(base * 10) / 10 };
});

// Khớp hệ hiện tại: model bắt Mũ / Áo / Giày
export const mockViolationBreakdown: ViolationBreakdown[] = [
  { type: ViolationType.HARD_HAT, label: 'Thiếu Mũ', count: 5, percentage: 62.5, color: '#DC2626' },
  { type: ViolationType.SAFETY_VEST, label: 'Thiếu Áo', count: 2, percentage: 25.0, color: '#EA580C' },
  { type: ViolationType.SAFETY_HARNESS, label: 'Thiếu Giày', count: 1, percentage: 12.5, color: '#F59E0B' },
];

export const mockSiteStatusList: SiteStatusSummary[] = [
  { id: 'site-001', name: 'Vinhomes Grand Park', complianceRate: 91.2, activeAlerts: 3, cameraCount: 42, onlineCameras: 39, status: SiteStatus.ACTIVE },
  { id: 'site-002', name: 'Masteri Centre Point', complianceRate: 94.8, activeAlerts: 1, cameraCount: 36, onlineCameras: 36, status: SiteStatus.ACTIVE },
  { id: 'site-003', name: 'Lumière Riverside', complianceRate: 87.5, activeAlerts: 5, cameraCount: 28, onlineCameras: 26, status: SiteStatus.ACTIVE },
  { id: 'site-004', name: 'The Global City', complianceRate: 92.1, activeAlerts: 2, cameraCount: 55, onlineCameras: 52, status: SiteStatus.ACTIVE },
  { id: 'site-005', name: 'Eaton Park', complianceRate: 78.3, activeAlerts: 7, cameraCount: 16, onlineCameras: 12, status: SiteStatus.SETUP },
];

export const mockSeverityBreakdown = [
  { severity: 'CRITICAL', count: 12, color: '#DC2626' },
  { severity: 'HIGH', count: 28, color: '#EA580C' },
  { severity: 'MEDIUM', count: 45, color: '#F59E0B' },
  { severity: 'LOW', count: 62, color: '#10B981' },
];
