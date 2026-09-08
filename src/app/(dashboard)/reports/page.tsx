'use client';
// SPDX-License-Identifier: MIT

import { useMemo, useState } from 'react';
import { Download, FileText, Printer } from 'lucide-react';
import { SectionHeader, SettingCard, InputGroup } from '@/components/settings/ui';
import { useSites } from '@/hooks/use-sites';
import { useCameras } from '@/hooks/use-cameras';
import { useViolationReport } from '@/hooks/use-reports';
import { useAgentEvents } from '@/hooks/use-agent';
import { getViolationTypeLabel } from '@/lib/utils';
import { ViolationStatus } from '@/types/enums';
import type { Violation } from '@/types/models';

const STATUS_LABELS: Record<string, string> = {
  [ViolationStatus.OPEN]: 'Đang mở',
  [ViolationStatus.UNDER_REVIEW]: 'Đang xem xét',
  [ViolationStatus.RESOLVED]: 'Vi phạm thật',
  [ViolationStatus.FALSE_POSITIVE]: 'Báo oan',
};
const SEVERITY_LABELS: Record<string, string> = { critical: 'Nghiêm trọng', high: 'Cao', medium: 'Trung bình', low: 'Thấp' };

// ponytail: bảng chi tiết chỉ vẽ 200 dòng mới nhất để DOM không phình khi khoảng
// ngày rộng; CSV vẫn xuất đủ số dòng API trả về. Cần xem hết trên màn hình thì
// thêm phân trang sau.
const MAX_TABLE_ROWS = 200;

// Ngày theo giờ máy người dùng (toISOString sẽ lệch một ngày ở múi giờ +07).
function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function exportCsv(rows: Violation[], from: string, to: string) {
  const header = ['Thời gian phát hiện', 'Công trường', 'Camera', 'Loại vi phạm', 'Mức độ', 'Trạng thái', 'Độ tin cậy'];
  const lines = rows.map(v => [
    new Date(v.detectedAt).toLocaleString('vi-VN'),
    v.siteName, v.cameraName, getViolationTypeLabel(v.type),
    SEVERITY_LABELS[v.severity] ?? v.severity,
    STATUS_LABELS[v.status] ?? v.status,
    `${Math.round(v.confidence * 100)}%`,
  ]);
  const csv = [header, ...lines].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  // BOM để Excel bản tiếng Việt không đọc hỏng dấu.
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `bao-cao-vi-pham-${from}-den-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Báo cáo tuần của agent là markdown; hiện theo đoạn thay vì render thô.
function reportParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).map(p => p.replace(/^#{1,6}\s*/gm, '').replace(/\*\*/g, '').trim()).filter(Boolean);
}

export default function ReportsPage() {
  const today = useMemo(() => new Date(), []);
  const [siteId, setSiteId] = useState('');
  const [cameraId, setCameraId] = useState('');
  const [from, setFrom] = useState(toDateInput(new Date(today.getTime() - 6 * 86_400_000)));
  const [to, setTo] = useState(toDateInput(today));

  const { data: sites = [] } = useSites();
  const { data: cameras = [] } = useCameras(siteId ? { siteId } : undefined);
  const { data: report, isLoading, isError } = useViolationReport({ siteId, cameraId, from, to });
  const { data: reportEvents = [] } = useAgentEvents({ type: 'report', limit: 1 });

  const rows = report?.rows ?? [];
  const byCamera = report?.byCamera ?? [];
  const totals = byCamera.reduce(
    (acc, r) => ({ total: acc.total + r.total, real: acc.real + r.real, falsePositive: acc.falsePositive + r.falsePositive, open: acc.open + r.open }),
    { total: 0, real: 0, falsePositive: 0, open: 0 },
  );
  const weekly = reportEvents[0];
  const weeklyText = typeof weekly?.data.text === 'string' ? weekly.data.text : '';

  return (
    <div className="space-y-8 pb-20 animate-fade-up">
      <SectionHeader title="Báo cáo vi phạm" description="Tổng hợp vi phạm theo camera trong một khoảng thời gian, xuất CSV hoặc in ra PDF." />

      <SettingCard className="no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
          <InputGroup label="Công trường">
            <select
              value={siteId}
              onChange={e => { setSiteId(e.target.value); setCameraId(''); }}
              className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm"
            >
              <option value="">Tất cả công trường</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </InputGroup>
          <InputGroup label="Camera">
            <select
              value={cameraId}
              onChange={e => setCameraId(e.target.value)}
              className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm"
            >
              <option value="">Tất cả camera</option>
              {cameras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </InputGroup>
          <InputGroup label="Từ ngày">
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm" />
          </InputGroup>
          <InputGroup label="Đến ngày">
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="w-full rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm" />
          </InputGroup>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportCsv(rows, from, to)}
              disabled={rows.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" /> Xuất CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
            >
              <Printer className="w-4 h-4" /> In / PDF
            </button>
          </div>
        </div>
      </SettingCard>

      {isError ? (
        <SettingCard><p className="text-sm text-[var(--danger)]">Không tải được báo cáo. Thử lại sau.</p></SettingCard>
      ) : isLoading ? (
        <div className="h-64 rounded-2xl bg-[var(--surface-elevated)] animate-pulse" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Tổng vi phạm</p><p className="text-2xl font-black mt-1">{totals.total}</p></SettingCard>
            <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Vi phạm thật</p><p className="text-2xl font-black mt-1 text-[var(--danger)]">{totals.real}</p></SettingCard>
            <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Báo oan</p><p className="text-2xl font-black mt-1 text-[var(--success)]">{totals.falsePositive}</p></SettingCard>
            <SettingCard><p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Còn mở</p><p className="text-2xl font-black mt-1 text-[var(--warning)]">{totals.open}</p></SettingCard>
          </div>

          <SettingCard>
            <h3 className="font-black flex items-center gap-2 mb-4"><FileText className="w-4 h-4" /> Tổng hợp theo camera</h3>
            {byCamera.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Không có vi phạm nào trong khoảng đã chọn.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="text-left py-2 pr-4">Camera</th>
                      <th className="text-left py-2 pr-4">Công trường</th>
                      <th className="text-right py-2 pr-4">Tổng</th>
                      <th className="text-right py-2 pr-4">Thật</th>
                      <th className="text-right py-2 pr-4">Báo oan</th>
                      <th className="text-right py-2">Còn mở</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCamera.map(r => (
                      <tr key={r.cameraId} className="data-row border-b border-[var(--border-subtle)]">
                        <td className="py-2 pr-4 font-medium text-[var(--text-primary)]">{r.cameraName}</td>
                        <td className="py-2 pr-4 text-[var(--text-secondary)]">{r.siteName}</td>
                        <td className="py-2 pr-4 text-right font-bold">{r.total}</td>
                        <td className="py-2 pr-4 text-right text-[var(--danger)]">{r.real}</td>
                        <td className="py-2 pr-4 text-right text-[var(--success)]">{r.falsePositive}</td>
                        <td className="py-2 text-right text-[var(--warning)]">{r.open}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SettingCard>

          <SettingCard>
            <div className="flex items-baseline justify-between flex-wrap gap-2 mb-4">
              <h3 className="font-black">Chi tiết vi phạm</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {rows.length === 0 ? 'Không có dòng nào' : `Hiển thị ${Math.min(rows.length, MAX_TABLE_ROWS)} / ${rows.length} dòng — CSV xuất đủ`}
              </p>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Không có vi phạm nào trong khoảng đã chọn.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] border-b border-[var(--border)]">
                      <th className="text-left py-2 pr-4">Thời gian</th>
                      <th className="text-left py-2 pr-4">Camera</th>
                      <th className="text-left py-2 pr-4">Loại</th>
                      <th className="text-left py-2 pr-4">Mức độ</th>
                      <th className="text-left py-2">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, MAX_TABLE_ROWS).map(v => (
                      <tr key={v.id} className="data-row border-b border-[var(--border-subtle)]">
                        <td className="py-2 pr-4 whitespace-nowrap text-[var(--text-secondary)]">{new Date(v.detectedAt).toLocaleString('vi-VN')}</td>
                        <td className="py-2 pr-4">{v.cameraName}</td>
                        <td className="py-2 pr-4">{getViolationTypeLabel(v.type)}</td>
                        <td className="py-2 pr-4">{SEVERITY_LABELS[v.severity] ?? v.severity}</td>
                        <td className="py-2">{STATUS_LABELS[v.status] ?? v.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SettingCard>
        </>
      )}

      <SettingCard>
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-black">Báo cáo tuần của agent</h3>
          {weekly && <span className="text-xs text-[var(--text-muted)]">{new Date(weekly.emittedAt).toLocaleString('vi-VN')}</span>}
        </div>
        {weeklyText ? (
          <div className="space-y-3 text-sm text-[var(--text-secondary)]">
            {reportParagraphs(weeklyText).map((p, i) => <p key={i} className="whitespace-pre-line break-words">{p}</p>)}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">Chưa có báo cáo tuần nào. Agent sẽ gửi vào giờ đặt ở trang Agent.</p>
        )}
      </SettingCard>
    </div>
  );
}
