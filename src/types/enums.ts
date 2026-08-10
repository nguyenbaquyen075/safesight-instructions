// SPDX-License-Identifier: MIT

/* ===== SafeSight AI — Domain Enums ===== */

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  SITE_MANAGER = 'site_manager',
  SAFETY_OFFICER = 'safety_officer',
  SUPERVISOR = 'supervisor',
}

export enum ViolationType {
  HARD_HAT = 'hard_hat',
  SAFETY_VEST = 'safety_vest',
  SAFETY_HARNESS = 'safety_harness',
  PROTECTIVE_EYEWEAR = 'protective_eyewear',
  SAFETY_GLOVES = 'safety_gloves',
  SAFETY_FOOTWEAR = 'safety_footwear',
  RESPIRATORY = 'respiratory',
  ZONE_INTRUSION = 'zone_intrusion',
  VEHICLE_PROXIMITY = 'vehicle_proximity',
  SUSPENDED_LOAD = 'suspended_load',
  FALL_DETECTED = 'fall_detected',
  FIRE_SMOKE = 'fire_smoke',
  PHONE_USE = 'phone_use',
  RUNNING = 'running',
  UNAUTHORIZED_CLIMBING = 'unauthorized_climbing',
  CROWD_DENSITY = 'crowd_density',
}

export enum Severity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum CameraStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
  MAINTENANCE = 'maintenance',
}

export enum AlertChannel {
  IN_APP = 'in_app',
  SMS = 'sms',
  EMAIL = 'email',
  SIREN = 'siren',
  PA_SYSTEM = 'pa_system',
  WEBHOOK = 'webhook',
  TELEGRAM = 'telegram',
}

export enum AlertStatus {
  NEW = 'new',
  ACKNOWLEDGED = 'acknowledged',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  SUPPRESSED = 'suppressed',
}

export enum ZoneType {
  RESTRICTED = 'restricted',
  WARNING = 'warning',
  MONITORING = 'monitoring',
  SUSPENDED_LOAD = 'suspended_load',
}

export enum SiteStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SETUP = 'setup',
}

export enum ViolationStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive',
}
