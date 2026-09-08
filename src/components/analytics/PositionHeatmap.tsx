'use client';
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { InputGroup } from '@/components/settings/ui';
import { bboxCenters } from '@/lib/heatmap-shape';
import type { BoundingBox, Camera } from '@/types/models';

const CANVAS_W = 800;
const CANVAS_H = 450;
const DOT_RADIUS = 18;
const DOT_ALPHA = 0.25;

interface PositionHeatmapRow {
  cameraId: string;
  type: string;
  bboxData: BoundingBox[];
}

/**
 * Chọn camera, hiện ảnh xem trước và chấm mờ tại tâm bbox từng vi phạm của camera đó.
 *
 * Cùng cấu trúc lớp nền + lớp vẽ chồng lên với ZoneEditor (`src/components/settings/ZoneEditor.tsx`):
 * `<img>` là ảnh nền, browser tự bắn onLoad/onError — không cần effect để tải ảnh.
 * `<canvas>` trong suốt phủ lên trên chỉ vẽ các chấm; nếu ảnh lỗi, nền `--surface`
 * của container lộ ra thay ảnh, chấm vẫn vẽ bình thường.
 */
export function PositionHeatmap({ cameras, violations }: { cameras: Camera[]; violations: PositionHeatmapRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraId, setCameraId] = useState('');
  const [preview, setPreview] = useState<'loading' | 'ready' | 'missing'>('loading');

  // Suy ra camera đang chọn thay vì đồng bộ qua effect: nếu chưa chọn (hoặc camera
  // đã chọn không còn trong danh sách), rơi về camera đầu tiên.
  const activeCameraId = cameras.some((c) => c.id === cameraId) ? cameraId : (cameras[0]?.id ?? '');
  const centers = bboxCenters(violations.filter((v) => v.cameraId === activeCameraId));

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    for (const { x, y } of centers) {
      const cx = x * CANVAS_W;
      const cy = y * CANVAS_H;
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, DOT_RADIUS);
      gradient.addColorStop(0, `rgba(220, 38, 38, ${DOT_ALPHA})`);
      gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [centers]);

  if (!cameras.length) {
    return <p className="text-sm text-[var(--text-muted)]">Chưa có camera nào.</p>;
  }

  return (
    <div className="space-y-4">
      <InputGroup label="Camera">
        <select
          value={activeCameraId}
          onChange={(e) => { setCameraId(e.target.value); setPreview('loading'); }}
          className="w-full sm:w-64 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] px-3 py-2 text-sm"
        >
          {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </InputGroup>

      <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh do AI engine ghi lúc chạy, không qua next/image */}
        <img
          key={activeCameraId}
          src={`/snapshots/preview_${activeCameraId}.jpg`}
          alt={`Ảnh xem trước camera ${activeCameraId}`}
          className={cn('absolute inset-0 w-full h-full', preview === 'ready' ? '' : 'hidden')}
          onLoad={() => setPreview('ready')}
          onError={() => setPreview('missing')}
        />
        {preview !== 'ready' && (
          <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-[var(--text-muted)]">
            {preview === 'loading'
              ? 'Đang tải ảnh xem trước...'
              : 'Chưa có ảnh xem trước — chạy AI engine trước (npm run dev), engine chụp lại mỗi 30 giây.'}
          </p>
        )}
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {centers.length === 0 && (
        <p className="text-xs text-[var(--text-muted)]">Chưa có vi phạm nào của camera này trong khoảng đã chọn.</p>
      )}

      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.6) 0%, rgba(220,38,38,0) 70%)' }}
        />
        Đốm đỏ = tâm vị trí vi phạm; càng đậm càng nhiều vi phạm chồng vị trí
      </div>
    </div>
  );
}
