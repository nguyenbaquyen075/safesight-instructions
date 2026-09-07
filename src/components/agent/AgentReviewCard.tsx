// SPDX-License-Identifier: MIT
import { BandBadge } from './BandBadge';
import { OBSERVATION_LABELS, type AgentReview } from '@/types/agent';

export function AgentReviewCard({ review }: { review: AgentReview | null }) {
  if (!review) return <p className="text-sm text-[var(--text-muted)]">Agent chưa review vi phạm này. Nếu agent đang chạy, kết quả thường có trong 1–2 phút.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap"><BandBadge review={review} /><span className="text-[10px] text-[var(--text-muted)]">{new Date(review.reviewedAt).toLocaleString('vi-VN')}</span></div>
      <div className="flex flex-wrap gap-1">
        {(review.observations ?? []).map(o => <span key={o} className="px-2 py-0.5 rounded-md border border-[var(--border)] text-[10px] text-[var(--text-secondary)]">{OBSERVATION_LABELS[o] ?? o}</span>)}
      </div>
      <p className="text-sm text-[var(--text-primary)] break-words">{review.note}</p>
    </div>
  );
}
