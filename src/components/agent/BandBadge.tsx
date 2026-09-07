// SPDX-License-Identifier: MIT
import { cn } from '@/lib/utils';
import type { AgentReview } from '@/types/agent';

export function BandBadge({ review, className }: { review: AgentReview | null; className?: string }) {
  if (!review || !review.band) return <span className={cn('px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-white/5 text-[var(--text-muted)]', className)}>Chưa review</span>;
  const tone = review.band === 'VERIFIED' ? (review.verdict === 'false_positive' ? 'bg-[var(--success-muted)] text-[var(--success)]' : 'bg-[var(--danger-muted)] text-[var(--danger)]')
    : review.band === 'PROBABLE' ? 'bg-[var(--warning-muted)] text-[var(--warning)]' : 'bg-[var(--info-muted)] text-[var(--info)]';
  const text = `${review.band} · ${review.verdict === 'false_positive' ? 'báo oan' : review.verdict === 'violation' ? 'vi phạm thật' : 'chưa rõ'}`;
  return <span className={cn('px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest', tone, className)}>{text}</span>;
}
