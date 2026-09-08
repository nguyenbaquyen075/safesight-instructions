// SPDX-License-Identifier: MIT
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { BandBadge } from './BandBadge';
import { useSubmitReviewFeedback } from '@/hooks/use-violations';
import { OBSERVATION_LABELS, type AgentReview, type ReviewFeedback } from '@/types/agent';

const MAX_NOTE = 300;
const BTN = 'flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-widest transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]';

/** Người chấm phán quyết của agent đúng/sai — nguồn dữ liệu cho thẻ độ chính xác ở /agent và
 *  cho bộ dữ liệu retrain. Giữ phản hồi vừa gửi trong state để hiện ngay, không phải chờ
 *  danh sách vi phạm refetch. */
function ReviewFeedbackRow({ violationId, feedback }: { violationId: string; feedback: ReviewFeedback | null }) {
  const submit = useSubmitReviewFeedback();
  const [saved, setSaved] = useState<ReviewFeedback | null>(feedback);
  const [editing, setEditing] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [note, setNote] = useState(feedback?.note ?? '');

  const send = (correct: boolean) =>
    submit.mutate(
      { id: violationId, correct, note: correct ? undefined : note.trim() || undefined },
      { onSuccess: v => { setSaved(v.reviewFeedback ?? null); setEditing(false); setWrong(false); } },
    );

  if (saved && !editing) {
    return (
      <div className="rounded-xl border border-[var(--border)] px-3 py-2 space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs text-[var(--text-secondary)] break-words min-w-0">
            {/* Phản hồi cũ (trước v0.11.0) không lưu tên người chấm -> không nêu tên bừa. */}
            {saved.userName ? `${saved.userName} đã đánh giá lúc ` : 'Đã đánh giá lúc '}
            <span className="text-[var(--text-muted)]">{new Date(saved.at).toLocaleString('vi-VN')}</span>
            : <strong className={saved.correct ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>{saved.correct ? 'Đúng' : 'Sai'}</strong>
          </span>
          <button type="button" onClick={() => { setEditing(true); setWrong(!saved.correct); }} className="text-xs font-bold text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded">Sửa</button>
        </div>
        {saved.note && <p className="text-xs text-[var(--text-muted)] break-words">{saved.note}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] px-3 py-3 space-y-2">
      <p className="text-xs font-bold text-[var(--text-secondary)]">Phán quyết này đúng không?</p>
      <div className="flex gap-2">
        <button type="button" onClick={() => send(true)} disabled={submit.isPending} className={`${BTN} border-[var(--success)]/40 text-[var(--success)] hover:bg-[var(--success)]/10`}>
          <Check className="w-3.5 h-3.5" /> Đúng
        </button>
        <button type="button" onClick={() => setWrong(true)} disabled={submit.isPending} className={`${BTN} ${wrong ? 'bg-[var(--danger)]/10' : ''} border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10`}>
          <X className="w-3.5 h-3.5" /> Sai
        </button>
      </div>
      {wrong && (
        <div className="space-y-2">
          <label htmlFor={`feedback-note-${violationId}`} className="text-xs text-[var(--text-muted)]">Sai ở đâu? (không bắt buộc)</label>
          <textarea
            id={`feedback-note-${violationId}`}
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={MAX_NOTE}
            rows={2}
            className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            placeholder="Ví dụ: người có đội mũ, bị cột che"
          />
          <button type="button" onClick={() => send(false)} disabled={submit.isPending} className={`${BTN} w-full border-[var(--border)] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]`}>
            {submit.isPending ? 'Đang gửi...' : 'Gửi đánh giá'}
          </button>
        </div>
      )}
      {submit.isError && <p className="text-xs text-[var(--danger)]">Không gửi được đánh giá. Thử lại sau.</p>}
    </div>
  );
}

export function AgentReviewCard({ review, violationId, feedback }: { review: AgentReview | null; violationId: string; feedback: ReviewFeedback | null }) {
  if (!review) return <p className="text-sm text-[var(--text-muted)]">Agent chưa review vi phạm này. Nếu agent đang chạy, kết quả thường có trong 1–2 phút.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap"><BandBadge review={review} /><span className="text-[10px] text-[var(--text-muted)]">{new Date(review.reviewedAt).toLocaleString('vi-VN')}</span></div>
      <div className="flex flex-wrap gap-1">
        {(review.observations ?? []).map(o => <span key={o} className="px-2 py-0.5 rounded-md border border-[var(--border)] text-[10px] text-[var(--text-secondary)]">{OBSERVATION_LABELS[o] ?? o}</span>)}
      </div>
      <p className="text-sm text-[var(--text-primary)] break-words">{review.note}</p>
      <ReviewFeedbackRow violationId={violationId} feedback={feedback} />
    </div>
  );
}
