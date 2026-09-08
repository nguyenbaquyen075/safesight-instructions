// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportSummary } from '@/lib/report-shape';
import type { Violation } from '@/types/models';
import { Severity, ViolationStatus, ViolationType } from '@/types/enums';

// buildReportSummary là phần thuần của GET /api/reports/violations (route handler
// cần ngữ cảnh Next request + auth() nên không test trực tiếp được).

function violation(over: Partial<Violation>): Violation {
  return {
    id: 'v', cameraId: 'cam-1', cameraName: 'Cam 1', siteId: 'site-1', siteName: 'Site 1',
    type: ViolationType.HARD_HAT, severity: Severity.HIGH, confidence: 0.9, bboxData: [],
    snapshotUrl: '/x.jpg', status: ViolationStatus.OPEN, detectedAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z', ...over,
  };
}

test('buildReportSummary groups per camera and splits real, false positive and open', () => {
  const rows = [
    violation({ id: '1', status: ViolationStatus.RESOLVED }),
    violation({ id: '2', status: ViolationStatus.FALSE_POSITIVE }),
    violation({ id: '3', status: ViolationStatus.OPEN }),
    violation({ id: '4', status: ViolationStatus.UNDER_REVIEW }),
  ];
  const [row] = buildReportSummary(rows);
  assert.equal(row.cameraId, 'cam-1');
  assert.equal(row.cameraName, 'Cam 1');
  assert.equal(row.siteName, 'Site 1');
  assert.deepEqual({ total: row.total, real: row.real, falsePositive: row.falsePositive, open: row.open }, { total: 4, real: 1, falsePositive: 1, open: 2 });
  assert.equal(row.total, row.real + row.falsePositive + row.open, 'tổng phải bằng tổng ba nhóm');
});

test('buildReportSummary sorts by total desc then by camera name', () => {
  const rows = [
    violation({ id: '1', cameraId: 'b', cameraName: 'Cam B' }),
    violation({ id: '2', cameraId: 'c', cameraName: 'Cam C' }),
    violation({ id: '3', cameraId: 'c', cameraName: 'Cam C' }),
    violation({ id: '4', cameraId: 'a', cameraName: 'Cam A' }),
  ];
  assert.deepEqual(buildReportSummary(rows).map(r => r.cameraId), ['c', 'a', 'b']);
});

test('buildReportSummary returns an empty list for no rows', () => {
  assert.deepEqual(buildReportSummary([]), []);
});
