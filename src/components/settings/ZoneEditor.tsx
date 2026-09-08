'use client';
// SPDX-License-Identifier: MIT

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useCameraZones, useSaveCameraZones } from '@/hooks/use-cameras';
import type { ZonePoint } from '@/lib/zone-shape';

const MAX_ZONES = 10;      // khớp zonesPayloadSchema
const MAX_POINTS = 20;     // khớp zonePolygonSchema

// Mỗi vùng một màu để phân biệt khi chồng nhau; quay vòng khi quá 4 vùng.
const ZONE_COLORS = ['var(--primary)', 'var(--success)', 'var(--warning)', 'var(--danger)'];

/** Trình vẽ VÙNG LÀM VIỆC trên ảnh xem trước của camera.
 *
 * Nền là public/snapshots/preview_<id>.jpg do AI engine ghi mỗi 30s. Lớp vẽ là
 * SVG (không phải <canvas>): đa giác và từng điểm là phần tử thật nên kéo/xoá
 * điểm dùng thẳng sự kiện chuột của trình duyệt, không phải tự vẽ lại và tự dò
 * xem con trỏ trúng điểm nào.
 *
 * Toạ độ lưu theo TỈ LỆ 0–1 của khung hình nên ảnh xem trước hiển thị to nhỏ thế
 * nào cũng không ảnh hưởng.
 */
export function ZoneEditor({ cameraId }: { cameraId: string }) {
  const { data: zones, isLoading, isError } = useCameraZones(cameraId);
  const saveZones = useSaveCameraZones(cameraId);
  const svgRef = useRef<SVGSVGElement>(null);
  const draggedRef = useRef(false);
  const [preview, setPreview] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [dragging, setDragging] = useState<{ zone: number; point: number } | null>(null);
  const [active, setActive] = useState(0);

  // Nạp bản nháp từ server ngay trong render (mẫu "adjust state on prop change",
  // giống CameraEditDialog) — không setState trong effect.
  const [draft, setDraft] = useState<ZonePoint[][]>([]);
  // Tên vùng song song với draft theo chỉ số; undefined = vùng mới chưa đặt tên,
  // server tự sinh "Vùng N" khi lưu (defaultZoneName).
  const [names, setNames] = useState<(string | undefined)[]>([]);
  const [loadedFrom, setLoadedFrom] = useState<typeof zones>(undefined);
  if (zones && zones !== loadedFrom) {
    setLoadedFrom(zones);
    setDraft(zones.map((z) => z.points));
    setNames(zones.map((z) => z.name));
    setActive(0);
  }

  const toRatio = (e: { clientX: number; clientY: number }): ZonePoint | null => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)),
    };
  };

  const addPoint = (e: React.MouseEvent) => {
    // Thả chuột sau khi KÉO điểm cũng sinh ra click trên <svg> -> nuốt lần click đó,
    // không thì mỗi lần chỉnh điểm lại đẻ thêm một điểm mới.
    if (draggedRef.current) { draggedRef.current = false; return; }
    const p = toRatio(e);
    if (!p) return;
    const zi = draft[active] ? active : 0;
    const zone = draft[zi] ?? [];
    if (zone.length >= MAX_POINTS) {
      toast(`Mỗi vùng tối đa ${MAX_POINTS} điểm`, 'error');
      return;
    }
    const next = draft.length ? [...draft] : [[]];
    next[zi] = [...zone, p];
    setDraft(next);
  };

  const movePoint = (e: React.PointerEvent) => {
    if (!dragging) return;
    const p = toRatio(e);
    if (!p) return;
    draggedRef.current = true;
    setDraft((prev) => prev.map((zone, zi) => (zi !== dragging.zone ? zone
      : zone.map((pt, pi) => (pi === dragging.point ? p : pt)))));
  };

  const removePoint = (zi: number, pi: number) => {
    setDraft((prev) => prev.map((zone, i) => (i === zi ? zone.filter((_, p) => p !== pi) : zone)));
  };

  const handleSave = async () => {
    // Vùng dưới 3 điểm chưa thành đa giác -> bỏ, đỡ để API trả 400 vì một vùng đang vẽ dở.
    // Giữ tên vùng theo đúng chỉ số gốc (draft/names song song) khi lọc.
    const ready = draft
      .map((points, i) => ({ points, name: names[i] }))
      .filter((zone) => zone.points.length >= 3);
    if (ready.length !== draft.length) {
      toast('Vùng chưa đủ 3 điểm sẽ không được lưu', 'error');
    }
    try {
      await saveZones.mutateAsync(ready);
      toast(ready.length
        ? 'Đã lưu vùng nhận diện — AI áp dụng trong vòng 60 giây'
        : 'Đã xoá hết vùng — AI xét lại toàn khung hình', 'success');
    } catch {
      toast('Lưu vùng nhận diện thất bại', 'error');
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
        Vùng nhận diện
      </label>

      {isLoading ? (
        <div className="h-40 rounded-xl bg-[var(--surface-elevated)] animate-pulse" />
      ) : isError ? (
        <p className="text-xs text-[var(--danger)] px-4 py-2.5 rounded-xl bg-[var(--danger-muted)]">
          Không tải được danh sách vùng của camera này.
        </p>
      ) : (
        <>
          <div className="relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-secondary)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh do AI engine ghi lúc chạy, không qua next/image */}
            <img
              src={`/snapshots/preview_${cameraId}.jpg`}
              alt={`Ảnh xem trước camera ${cameraId}`}
              className={cn('block w-full', preview === 'ready' ? '' : 'hidden')}
              onLoad={() => setPreview('ready')}
              onError={() => setPreview('missing')}
            />
            {preview !== 'ready' && (
              <p className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                {preview === 'loading'
                  ? 'Đang tải ảnh xem trước...'
                  : 'Chưa có ảnh xem trước — chạy AI engine trước (npm run dev), engine chụp lại mỗi 30 giây.'}
              </p>
            )}

            {preview === 'ready' && (
              <svg
                ref={svgRef}
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
                onClick={addPoint}
                onPointerMove={movePoint}
                onPointerUp={() => setDragging(null)}
                onPointerLeave={() => setDragging(null)}
              >
                {draft.map((points, zi) => {
                  const color = ZONE_COLORS[zi % ZONE_COLORS.length];
                  return (
                    <g key={zi} opacity={zi === active ? 1 : 0.55}>
                      <polygon
                        points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill={color}
                        fillOpacity={0.18}
                        stroke={color}
                        strokeWidth={0.004}
                      />
                      {points.map((p, pi) => (
                        <circle
                          key={pi}
                          cx={p.x}
                          cy={p.y}
                          r={0.012}
                          fill={color}
                          stroke="#fff"
                          strokeWidth={0.003}
                          className="cursor-grab"
                          onPointerDown={(e) => { e.stopPropagation(); setActive(zi); setDragging({ zone: zi, point: pi }); }}
                          onClick={(e) => e.stopPropagation()}
                          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); removePoint(zi, pi); }}
                        />
                      ))}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {draft.map((points, zi) => (
              <span
                key={zi}
                className={cn(
                  'flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px]',
                  zi === active
                    ? 'border-[var(--primary)] bg-[var(--primary-muted)] text-[var(--primary-light)]'
                    : 'border-[var(--border)] bg-[var(--background)] text-[var(--text-secondary)]',
                )}
              >
                <button
                  type="button"
                  onClick={() => setActive(zi)}
                  className="focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded"
                >
                  Vùng {zi + 1} ({points.length} điểm)
                </button>
                <button
                  type="button"
                  aria-label={`Xoá vùng ${zi + 1}`}
                  onClick={() => {
                    setDraft((prev) => prev.filter((_, i) => i !== zi));
                    setNames((prev) => prev.filter((_, i) => i !== zi));
                    setActive(0);
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)] focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => {
                if (draft.length >= MAX_ZONES) { toast(`Tối đa ${MAX_ZONES} vùng`, 'error'); return; }
                setDraft((prev) => [...prev, []]);
                setNames((prev) => [...prev, undefined]);
                setActive(draft.length);
              }}
              className="rounded-lg border border-dashed border-[var(--primary)] px-2 py-1 text-[11px] text-[var(--primary-light)] hover:bg-[var(--primary-muted)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              + Thêm vùng
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveZones.isPending || preview !== 'ready'}
              className="ml-auto rounded-lg bg-[var(--primary)] px-3 py-1 text-[11px] font-bold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            >
              {saveZones.isPending ? 'Đang lưu...' : 'Lưu vùng'}
            </button>
          </div>

          <p className="text-[10px] text-[var(--text-muted)]">
            Bấm vào ảnh để thêm điểm, kéo điểm để chỉnh, bấm chuột phải lên điểm để xoá.
            Người có CHÂN ngoài mọi vùng sẽ không bị xét PPE. Không vẽ vùng nào = xét cả khung hình.
          </p>
        </>
      )}
    </div>
  );
}
