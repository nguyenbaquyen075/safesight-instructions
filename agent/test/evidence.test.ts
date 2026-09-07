// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreEvidence } from '../lib/evidence';

test('a strong false-positive primary observation yields VERIFIED false_positive', () => {
  const r = scoreEvidence(['snapshot.no-person']);
  assert.equal(r.verdict, 'false_positive'); assert.equal(r.band, 'VERIFIED'); assert.equal(r.hasPrimary, true);
});

test('clearly missing PPE plus a repeat offense yields VERIFIED violation', () => {
  const r = scoreEvidence(['snapshot.ppe-clearly-missing', 'track.confirmed-repeat']);
  assert.equal(r.verdict, 'violation'); assert.equal(r.band, 'VERIFIED');
});

test('secondary evidence only yields no VERIFIED band and no primary', () => {
  const r = scoreEvidence(['history.camera-false-positive-prone', 'snapshot.occluded-or-backlit']);
  assert.equal(r.hasPrimary, false); assert.notEqual(r.band, 'VERIFIED');
  assert.equal(r.verdict, 'false_positive');
});

test('a contradiction pulls the score down; no observations yields undecided', () => {
  const a = scoreEvidence(['snapshot.ppe-visible']);
  const b = scoreEvidence(['snapshot.ppe-visible', 'contradiction']);
  assert.ok(b.score < a.score);
  assert.equal(scoreEvidence([]).verdict, 'undecided');
  assert.equal(scoreEvidence([]).band, null);
});

test('contradiction alone yields undecided with an explicit rationale, not "no observations"', () => {
  const r = scoreEvidence(['contradiction']);
  assert.equal(r.verdict, 'undecided'); assert.equal(r.band, null); assert.match(r.rationale, /mâu thuẫn/);
});

test('a tie between both sides yields undecided with rationale listing both; duplicate kinds do not stack', () => {
  const tie = scoreEvidence(['track.confirmed-repeat', 'snapshot.person-outside-work-zone', 'history.camera-false-positive-prone']);
  assert.equal(tie.verdict, 'undecided'); assert.equal(tie.band, null);
  assert.match(tie.rationale, /tái phạm/); assert.match(tie.rationale, /báo oan/);
  assert.equal(scoreEvidence(['snapshot.ppe-visible', 'snapshot.ppe-visible']).score, scoreEvidence(['snapshot.ppe-visible']).score);
});
