// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_FEEDBACK_CSV_HEADER, accuracyRange, agentAccuracy, csvRow, reviewFeedbackSchema } from '@/lib/agent-accuracy-shape';

// Phần thuần của GET /api/stats/agent-accuracy, PATCH /api/violations/[id]/feedback và
// GET /api/reports/agent-feedback (route handler cần auth() nên không test trực tiếp được,
// giống compliance.test.ts).

const review = (band: string) => JSON.stringify({ verdict: 'violation', band, score: 0.8, observations: [], note: '', rationale: '', sessionId: 's', reviewedAt: '2026-09-08T00:00:00.000Z' });
const feedback = (correct: boolean) => JSON.stringify({ correct, userId: 'u-1', at: '2026-09-08T01:00:00.000Z' });

const ROWS = [
  { cameraId: 'cam-a', cameraName: 'Cổng chính', type: 'hard_hat', agentReview: review('VERIFIED'), reviewFeedback: feedback(false) },
  { cameraId: 'cam-a', cameraName: 'Cổng chính', type: 'hard_hat', agentReview: review('PROBABLE'), reviewFeedback: feedback(true) },
  { cameraId: 'cam-a', cameraName: 'Cổng chính', type: 'safety_vest', agentReview: review('VERIFIED'), reviewFeedback: null },
  { cameraId: 'cam-b', cameraName: 'Bãi vật tư', type: 'safety_vest', agentReview: review('POSSIBLE'), reviewFeedback: feedback(false) },
];

test('agentAccuracy totals count reviewed violations, those with feedback and the wrong ones', () => {
  assert.deepEqual(agentAccuracy(ROWS).totals, { reviewed: 4, withFeedback: 3, wrong: 2 });
});

test('agentAccuracy groups by camera and by violation type', () => {
  const { byCamera, byType } = agentAccuracy(ROWS);
  assert.deepEqual(byCamera, [
    { cameraId: 'cam-a', name: 'Cổng chính', reviewed: 3, withFeedback: 2, wrong: 1 },
    { cameraId: 'cam-b', name: 'Bãi vật tư', reviewed: 1, withFeedback: 1, wrong: 1 },
  ]);
  assert.deepEqual(byType, [
    { type: 'hard_hat', reviewed: 2, withFeedback: 2, wrong: 1 },
    { type: 'safety_vest', reviewed: 2, withFeedback: 1, wrong: 1 },
  ]);
});

test('agentAccuracy reports wrong 0 when nobody has given feedback yet', () => {
  const rows = ROWS.map(r => ({ ...r, reviewFeedback: null }));
  assert.deepEqual(agentAccuracy(rows).totals, { reviewed: 4, withFeedback: 0, wrong: 0 });
  assert.equal(agentAccuracy(rows).byCamera[0].wrong, 0);
});

test('agentAccuracy skips violations the agent never reviewed and broken feedback JSON', () => {
  const rows = [
    { cameraId: 'cam-a', cameraName: 'Cổng chính', type: 'hard_hat', agentReview: null, reviewFeedback: feedback(false) },
    { cameraId: 'cam-a', cameraName: 'Cổng chính', type: 'hard_hat', agentReview: review('VERIFIED'), reviewFeedback: '{broken' },
  ];
  assert.deepEqual(agentAccuracy(rows).totals, { reviewed: 1, withFeedback: 0, wrong: 0 });
});

test('agentAccuracy on an empty list returns zeros and empty groups', () => {
  assert.deepEqual(agentAccuracy([]), { totals: { reviewed: 0, withFeedback: 0, wrong: 0 }, byCamera: [], byType: [] });
});

test('reviewFeedbackSchema requires a boolean verdict and caps the note at 300 characters', () => {
  assert.deepEqual(reviewFeedbackSchema.parse({ correct: true }), { correct: true });
  assert.equal(reviewFeedbackSchema.parse({ correct: false, note: '  người có mũ  ' }).note, 'người có mũ');
  assert.equal(reviewFeedbackSchema.safeParse({ correct: false, note: 'x'.repeat(300) }).success, true);
  assert.equal(reviewFeedbackSchema.safeParse({ correct: false, note: 'x'.repeat(301) }).success, false);
  assert.equal(reviewFeedbackSchema.safeParse({ correct: 'yes' }).success, false);
  assert.equal(reviewFeedbackSchema.safeParse({}).success, false);
});

test('csvRow quotes every cell and escapes commas, quotes and newlines', () => {
  assert.equal(csvRow(['a', 'b,c']), '"a","b,c"');
  assert.equal(csvRow(['nói "thật"']), '"nói ""thật"""');
  assert.equal(csvRow(['dòng 1\ndòng 2']), '"dòng 1\ndòng 2"');
  assert.equal(csvRow([null, undefined, 3]), '"","","3"');
  // Excel coi ô mở đầu bằng = + - @ là công thức -> thêm nháy đơn dẫn đầu.
  assert.equal(csvRow(['=SUM(A1)']), `"'=SUM(A1)"`);
});

test('the feedback dataset header matches the columns the retraining pipeline expects', () => {
  assert.deepEqual(AGENT_FEEDBACK_CSV_HEADER, ['violationId', 'cameraId', 'type', 'detectedAt', 'snapshotUrl', 'clipUrl', 'agentVerdict', 'band', 'humanCorrect', 'note']);
});

// Hai route thống kê/CSV dùng chung một cách hiểu khoảng ngày (trọn ngày theo UTC, có trần).
test('accuracyRange defaults to the last 30 whole days and clamps a range that is too wide or reversed', () => {
  const now = Date.parse('2026-09-08T10:00:00.000Z');
  assert.deepEqual(accuracyRange(null, null, now), { gte: new Date('2026-08-10T00:00:00.000Z'), lte: new Date('2026-09-08T23:59:59.999Z') });
  assert.deepEqual(accuracyRange('2026-09-01', '2026-09-03', now).gte, new Date('2026-09-01T00:00:00.000Z'));
  // from sau to -> thu về đúng ngày to, không trả khoảng âm.
  assert.deepEqual(accuracyRange('2026-09-05', '2026-09-01', now).gte, new Date('2026-09-01T00:00:00.000Z'));
  // Xin 10 năm -> chỉ quét tối đa 366 ngày.
  assert.deepEqual(accuracyRange('2016-01-01', '2026-09-08', now).gte, new Date('2025-09-07T00:00:00.000Z'));
});
