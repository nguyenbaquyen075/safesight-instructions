// SPDX-License-Identifier: MIT

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

export function formatPercentage(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getSeverityColor(severity: string): string {
  const map: Record<string, string> = {
    critical: 'var(--severity-critical)',
    high: 'var(--severity-high)',
    medium: 'var(--severity-medium)',
    low: 'var(--severity-low)',
  };
  return map[severity.toLowerCase()] || 'var(--text-muted)';
}

const VIOLATION_TYPE_LABELS: Record<string, string> = {
  hard_hat: 'Thiếu mũ bảo hộ',
  safety_vest: 'Thiếu áo phản quang',
  safety_harness: 'Thiếu dây an toàn',
  protective_eyewear: 'Thiếu kính bảo hộ',
  safety_gloves: 'Thiếu găng tay bảo hộ',
  safety_footwear: 'Thiếu giày bảo hộ',
  respiratory: 'Thiếu khẩu trang/mặt nạ chống độc',
  zone_intrusion: 'Xâm nhập khu vực cấm',
  vehicle_proximity: 'Đến gần phương tiện nguy hiểm',
  suspended_load: 'Đứng dưới vật treo/cẩu',
  fall_detected: 'Phát hiện té ngã',
  fire_smoke: 'Phát hiện cháy/khói',
  phone_use: 'Sử dụng điện thoại khi làm việc',
  running: 'Chạy trong khu vực nguy hiểm',
  unauthorized_climbing: 'Trèo/leo trái phép',
  crowd_density: 'Tụ tập đông người',
};

export function getViolationTypeLabel(type: string): string {
  return VIOLATION_TYPE_LABELS[type.toLowerCase()] || type.replace(/_/g, ' ');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
