// SPDX-License-Identifier: MIT

/* ===== SafeSight AI — Mock Data: Alerts ===== */

import { AlertChannel, AlertStatus } from '@/types/enums';
import type { Alert } from '@/types/models';
import { mockViolations } from './mock-violations';

export const mockAlerts: Alert[] = [
  {
    id: 'alert-001', violationId: 'viol-001', violation: mockViolations[0],
    channel: AlertChannel.IN_APP, recipient: 'Nguyễn Văn An', status: AlertStatus.NEW,
    sentAt: '2026-04-22T16:58:25Z', createdAt: '2026-04-22T16:58:25Z',
  },
  {
    id: 'alert-002', violationId: 'viol-002', violation: mockViolations[1],
    channel: AlertChannel.SMS, recipient: '+84 901 234 567', status: AlertStatus.NEW,
    sentAt: '2026-04-22T16:55:02Z', createdAt: '2026-04-22T16:55:02Z',
  },
  {
    id: 'alert-003', violationId: 'viol-004', violation: mockViolations[3],
    channel: AlertChannel.SIREN, recipient: 'Siren #3 - Rooftop', status: AlertStatus.ACKNOWLEDGED,
    sentAt: '2026-04-22T16:30:03Z', acknowledgedBy: 'user-003', acknowledgedByName: 'Phạm Minh Đức',
    acknowledgedAt: '2026-04-22T16:31:00Z', createdAt: '2026-04-22T16:30:03Z',
  },
  {
    id: 'alert-004', violationId: 'viol-005', violation: mockViolations[4],
    channel: AlertChannel.IN_APP, recipient: 'All Safety Officers', status: AlertStatus.ESCALATED,
    sentAt: '2026-04-22T16:20:02Z', escalatedAt: '2026-04-22T16:25:02Z', createdAt: '2026-04-22T16:20:02Z',
  },
  {
    id: 'alert-005', violationId: 'viol-005', violation: mockViolations[4],
    channel: AlertChannel.SMS, recipient: '+84 912 345 678', status: AlertStatus.NEW,
    sentAt: '2026-04-22T16:25:05Z', createdAt: '2026-04-22T16:25:05Z',
  },
  {
    id: 'alert-006', violationId: 'viol-006', violation: mockViolations[5],
    channel: AlertChannel.IN_APP, recipient: 'Trần Thị Bích', status: AlertStatus.ACKNOWLEDGED,
    sentAt: '2026-04-22T16:10:02Z', acknowledgedBy: 'user-002', acknowledgedByName: 'Trần Thị Bích',
    acknowledgedAt: '2026-04-22T16:12:00Z', notes: 'Đã thông báo công nhân rời khỏi khu vực.', createdAt: '2026-04-22T16:10:02Z',
  },
  {
    id: 'alert-007', violationId: 'viol-007', violation: mockViolations[6],
    channel: AlertChannel.EMAIL, recipient: 'an.nguyen@safesight.ai', status: AlertStatus.RESOLVED,
    sentAt: '2026-04-22T15:30:05Z', acknowledgedBy: 'user-001', acknowledgedByName: 'Nguyễn Văn An',
    acknowledgedAt: '2026-04-22T15:32:00Z', createdAt: '2026-04-22T15:30:05Z',
  },
  {
    id: 'alert-008', violationId: 'viol-008', violation: mockViolations[7],
    channel: AlertChannel.IN_APP, recipient: 'Phạm Minh Đức', status: AlertStatus.NEW,
    sentAt: '2026-04-22T15:15:03Z', createdAt: '2026-04-22T15:15:03Z',
  },
];

export function getMockAlert(id: string): Alert | undefined {
  return mockAlerts.find((a) => a.id === id);
}
