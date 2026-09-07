// SPDX-License-Identifier: MIT
export const OBSERVATION_KINDS = [
  'snapshot.no-person', 'snapshot.ppe-visible', 'snapshot.ppe-clearly-missing', 'track.confirmed-repeat',
  'history.camera-false-positive-prone', 'snapshot.occluded-or-backlit', 'snapshot.person-outside-work-zone', 'contradiction',
] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

type Direction = 'false_positive' | 'violation' | 'neutral' | 'contra';

export const WEIGHTS: Record<ObservationKind, { weight: number; primary: boolean; label: string; direction: Direction }> = {
  'snapshot.no-person':                  { weight: 0.95, primary: true,  direction: 'false_positive', label: 'khung đỏ không có người (vật/bóng/xe)' },
  'snapshot.ppe-visible':                { weight: 0.90, primary: true,  direction: 'false_positive', label: 'món bị báo thiếu nhìn thấy rõ trên đúng người' },
  'snapshot.ppe-clearly-missing':        { weight: 0.90, primary: true,  direction: 'violation',      label: 'thấy rõ người và thấy rõ thiếu' },
  'track.confirmed-repeat':              { weight: 0.70, primary: true,  direction: 'violation',      label: 'cùng người tái phạm (occurrenceCount ≥ 2)' },
  'history.camera-false-positive-prone': { weight: 0.40, primary: false, direction: 'false_positive', label: 'camera này báo oan > 50% trong 7 ngày' },
  'snapshot.occluded-or-backlit':        { weight: 0.35, primary: false, direction: 'false_positive', label: 'che khuất / ngược sáng, không kết luận được' },
  'snapshot.person-outside-work-zone':   { weight: 0.50, primary: false, direction: 'false_positive', label: 'người đi đường phía nền, không phải công nhân khu vực' },
  'contradiction':                       { weight: 0.60, primary: false, direction: 'contra',         label: 'bằng chứng mâu thuẫn nhau' },
};

export type Band = 'VERIFIED' | 'PROBABLE' | 'POSSIBLE';
export const BAND_FLOOR = { VERIFIED: 0.85, PROBABLE: 0.55, POSSIBLE: 0.3 } as const;

function combine(weights: number[]): number {
  return 1 - weights.reduce((acc, w) => acc * (1 - w), 1);
}

export function scoreEvidence(input: ObservationKind[]): { verdict: 'false_positive' | 'violation' | 'undecided'; score: number; band: Band | null; hasPrimary: boolean; rationale: string } {
  const kinds = [...new Set(input)]; // cùng một quan sát lặp lại không được cộng dồn
  const fp = kinds.filter(k => WEIGHTS[k].direction === 'false_positive');
  const vi = kinds.filter(k => WEIGHTS[k].direction === 'violation');
  const contra = kinds.filter(k => WEIGHTS[k].direction === 'contra');
  const labels = (ks: ObservationKind[]) => ks.map(k => WEIGHTS[k].label).join('; ');
  const fpScore = combine(fp.map(k => WEIGHTS[k].weight));
  const viScore = combine(vi.map(k => WEIGHTS[k].weight));
  if (fpScore === 0 && viScore === 0) {
    return { verdict: 'undecided', score: 0, band: null, hasPrimary: false,
      rationale: contra.length ? 'chỉ có bằng chứng mâu thuẫn, không có quan sát định hướng' : 'không có quan sát nào' };
  }
  if (fpScore === viScore) {
    // Hai phía ngang nhau: không thiên vị, liệt kê cả hai để người đọc thấy đủ.
    return { verdict: 'undecided', score: Math.round(fpScore * 1000) / 1000, band: null, hasPrimary: false,
      rationale: `mâu thuẫn ngang nhau — báo oan: ${labels(fp)} | vi phạm: ${labels(vi)}` };
  }
  const verdict = fpScore > viScore ? 'false_positive' : 'violation';
  const winners = verdict === 'false_positive' ? fp : vi;
  let score = Math.max(fpScore, viScore) - Math.min(fpScore, viScore) * 0.5;
  for (const k of contra) score *= 1 - WEIGHTS[k].weight;
  const hasPrimary = winners.some(k => WEIGHTS[k].primary);
  let band: Band | null = null;
  if (score >= BAND_FLOOR.VERIFIED && hasPrimary) band = 'VERIFIED';
  else if (score >= BAND_FLOOR.PROBABLE) band = 'PROBABLE';
  else if (score >= BAND_FLOOR.POSSIBLE) band = 'POSSIBLE';
  const rationale = labels(winners.concat(contra));
  return { verdict, score: Math.round(score * 1000) / 1000, band, hasPrimary, rationale };
}
