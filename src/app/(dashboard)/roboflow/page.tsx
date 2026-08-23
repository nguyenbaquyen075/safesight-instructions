'use client';
// SPDX-License-Identifier: MIT

import * as React from 'react';
import { UploadCloud, Loader2, AlertTriangle, Timer, ScanSearch } from 'lucide-react';
import { cn } from '@/lib/utils';

// Model phía Roboflow vốn chạy ở 640 nên gửi ảnh 1920 chỉ tốn băng thông: đo thực tế
// cho thấy payload 287KB -> 61KB và độ trễ trung vị 8447ms -> 1618ms, bbox không đổi
// vì trả theo phần trăm. Giống MAX_IMAGE_SIDE trong ai-engine/roboflow_workflow.py.
const MAX_IMAGE_SIDE = 640;

// Khớp allowlist trong src/app/api/roboflow/route.ts — route chỉ nhận 2 key này.
const WORKFLOW_LABELS = {
  'detech-ppe': 'Detech PPE (yolo26n)',
  'ppes-kaxsi': 'PPEs kaxsi (yolo11n)',
} as const;
type WorkflowKey = keyof typeof WORKFLOW_LABELS;

interface Detection {
  class: string;
  confidence: number;
  bbox: { left: string; top: string; width: string; height: string };
}

/** Thu nhỏ + encode JPEG ngay trên trình duyệt. Dùng canvas sẵn có của nền tảng,
 *  không kéo thêm thư viện xử lý ảnh nào. */
function toResizedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Trình duyệt không tạo được canvas'));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không đọc được ảnh — file có đúng định dạng ảnh không?'));
    };
    img.src = url;
  });
}

export default function RoboflowPage() {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [detections, setDetections] = React.useState<Detection[] | null>(null);
  const [latencyMs, setLatencyMs] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [workflow, setWorkflow] = React.useState<WorkflowKey>('detech-ppe');
  const inputRef = React.useRef<HTMLInputElement>(null);
  // Giữ lại file vừa thả để bấm đổi model là chạy lại được, khỏi kéo thả lần nữa.
  // Dùng state chứ không phải ref: giá trị này được ĐỌC TRONG RENDER (hiện dòng nhắc
  // tốn credit), mà ref đổi thì React không re-render -> dòng nhắc sẽ không hiện ra.
  const [lastFile, setLastFile] = React.useState<File | null>(null);

  async function handleFile(file: File, wf: WorkflowKey = workflow) {
    setLastFile(file);
    setError(null);
    setDetections(null);
    setLatencyMs(null);
    setLoading(true);
    try {
      const dataUrl = await toResizedDataUrl(file);
      setPreview(dataUrl);

      const resp = await fetch('/api/roboflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, workflow: wf }),
      });
      const body = await resp.json();
      if (!resp.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Gọi Roboflow thất bại');

      setDetections(body.detections);
      setLatencyMs(body.latencyMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
          <ScanSearch className="w-6 h-6 text-[var(--primary)]" />
          Kiểm thử Roboflow
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Chạy một ảnh tĩnh qua Roboflow Workflow để đối chiếu với model local{' '}
          <code className="text-xs">ppe_multiclass.pt</code>. Luồng camera trực tiếp vẫn dùng
          model local — trang này chỉ để xem model cloud nhận diện ra sao.{' '}
          <strong className="text-[var(--warning)]">Mỗi lần chạy tốn 1 credit Roboflow.</strong>
        </p>
      </header>

      {/* Chọn model cloud */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--text-secondary)]">Model:</span>
        {(Object.keys(WORKFLOW_LABELS) as WorkflowKey[]).map((key) => (
          <button
            key={key}
            onClick={() => {
              setWorkflow(key);
              if (lastFile) handleFile(lastFile, key);
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              workflow === key
                ? 'bg-[var(--primary-muted)] text-[var(--primary-light)] border-[var(--primary)]'
                : 'text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--surface)]'
            )}
          >
            {WORKFLOW_LABELS[key]}
          </button>
        ))}
        {lastFile && (
          <span className="text-xs text-[var(--text-muted)]">
            (đổi model sẽ chạy lại ảnh hiện tại — tốn thêm 1 credit)
          </span>
        )}
      </div>

      {/* Vùng thả ảnh */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-2 py-10 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors',
          dragging
            ? 'border-[var(--primary)] bg-[var(--primary-muted)]'
            : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--surface)]'
        )}
      >
        <UploadCloud className="w-8 h-8 text-[var(--text-muted)]" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Kéo thả ảnh vào đây, hoặc bấm để chọn file
        </span>
        <span className="text-xs text-[var(--text-muted)]">
          Ảnh được thu nhỏ về {MAX_IMAGE_SIDE}px trước khi gửi
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = ''; // cho phép chọn lại đúng file vừa chọn
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[var(--danger-muted)] text-[var(--danger)] text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {/* Ảnh + khung detection */}
          <div className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Ảnh đang kiểm thử" className="w-full block" />

            {detections?.map((det, i) => (
              <div
                key={i}
                className="absolute border-2 rounded-sm border-emerald-500 bg-emerald-500/10 pointer-events-none"
                style={{ ...det.bbox, zIndex: 10 }}
              >
                <div className="absolute -top-6 left-0 px-2 py-0.5 rounded text-[9px] font-black whitespace-nowrap shadow-lg bg-emerald-500 text-white">
                  {det.class.toUpperCase()}
                  <span className="opacity-70 ml-1">{(det.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}

            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            )}
          </div>

          {/* Kết quả */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">Kết quả</h2>
              {latencyMs !== null && (
                <span className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <Timer className="w-3.5 h-3.5" />
                  {latencyMs}ms
                </span>
              )}
            </div>

            {loading && <p className="text-sm text-[var(--text-muted)]">Đang gọi Roboflow…</p>}

            {detections?.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">
                Không có detection nào — model cloud không thấy gì trong ảnh này.
              </p>
            )}

            {detections?.map((det, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)]"
              >
                <span className="text-sm font-medium text-[var(--text-primary)]">{det.class}</span>
                <span className="text-xs font-mono text-[var(--text-secondary)]">
                  {(det.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
