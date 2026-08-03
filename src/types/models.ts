// SPDX-License-Identifier: MIT

/* ===== SafeSight AI — Domain Models ===== */

import type {
  UserRole,
  ViolationType,
  Severity,
  CameraStatus,
  AlertChannel,
  AlertStatus,
  ZoneType,
  SiteStatus,
  ViolationStatus,
} from './enums';

export interface Organization {
  id: string;
  name: string;
  plan: 'starter' | 'professional' | 'enterprise';
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Site {
  id: string;
  orgId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  status: SiteStatus;
  cameraCount: number;
  onlineCameraCount: number;
  workerCount: number;
  complianceRate: number;
  activeAlerts: number;
  todayViolations: number;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Camera {
  id: string;
  siteId: string;
  siteName: string;
  name: string;
  rtspUrl: string;
  status: CameraStatus;
  type: 'fixed' | 'ptz' | 'dome' | 'bullet';
  location: string;
  fps: number;
  resolution: string;
  lastHealthCheck: string;
  lastDetectionAt?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  createdAt: string;
}

export interface Zone {
  id: string;
  siteId: string;
  cameraId: string;
  cameraName: string;
  name: string;
  type: ZoneType;
  polygonData: number[][];
  schedule?: ZoneSchedule;
  isActive: boolean;
  maxOccupancy?: number;
  currentOccupancy?: number;
  violationCount: number;
  createdAt: string;
}

export interface ZoneSchedule {
  enabled: boolean;
  days: number[]; // 0=Sunday, 6=Saturday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface Violation {
  id: string;
  cameraId: string;
  cameraName: string;
  siteId: string;
  siteName: string;
  zoneId?: string;
  zoneName?: string;
  type: ViolationType;
  severity: Severity;
  confidence: number;
  bboxData: BoundingBox[];
  snapshotUrl: string;
  clipUrl?: string;
  status: ViolationStatus;
  detectedAt: string;
  createdAt: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
}

export interface Alert {
  id: string;
  violationId: string;
  violation?: Violation;
  ruleId?: string;
  channel: AlertChannel;
  recipient: string;
  status: AlertStatus;
  sentAt: string;
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  escalatedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface AlertRule {
  id: string;
  siteId: string;
  siteName: string;
  name: string;
  violationTypes: ViolationType[];
  channels: AlertChannel[];
  recipients: string[];
  threshold: number;
  cooldownSec: number;
  schedule?: ZoneSchedule;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  assignedSites: string[];
  assignedSiteNames: string[];
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: string;
  ipAddress: string;
  createdAt: string;
}

/* ===== Dashboard Aggregates ===== */

export interface DashboardKPIs {
  totalViolationsToday: number;
  violationsTrend: number; // percentage change from yesterday
  complianceRate: number;
  complianceTrend: number;
  activeAlerts: number;
  alertsTrend: number;
  activeCameras: number;
  totalCameras: number;
  onlineRate: number;
}

export interface ComplianceTrendPoint {
  date: string;
  rate: number;
  siteId?: string;
  siteName?: string;
}

export interface ViolationBreakdown {
  type: ViolationType;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface SiteStatusSummary {
  id: string;
  name: string;
  complianceRate: number;
  activeAlerts: number;
  cameraCount: number;
  onlineCameras: number;
  status: SiteStatus;
}
