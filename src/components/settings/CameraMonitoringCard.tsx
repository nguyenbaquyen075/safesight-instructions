'use client';
// SPDX-License-Identifier: MIT

import { useState } from 'react';
import { Plus, Pencil, Trash2, Webcam, Radio, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import { SectionHeader, SettingCard } from './ui';
import { useCameras, useDeleteCamera } from '@/hooks/use-cameras';
import { CameraEditDialog } from './CameraEditDialog';
import { parseCameraSource } from '@/lib/camera-source';
import { mockCameras } from '@/data/mock-cameras';
import { CameraStatus } from '@/types/enums';
import type { Camera } from '@/types/models';

const DEMO_IDS = new Set(mockCameras.map((c) => c.id));

function SourceBadge({ rtspUrl }: { rtspUrl: string }) {
  const parsed = parseCameraSource(rtspUrl);
  if (parsed.type === 'webcam') {
    return (
      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--primary-muted)] text-[var(--primary-light)]">
        <Webcam className="w-2.5 h-2.5" /> Webcam #{parsed.index}
      </span>
    );
  }
  if (parsed.type === 'rtsp') {
    return (
      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[var(--success-muted)] text-[var(--success)]">
        <Radio className="w-2.5 h-2.5" /> RTSP
      </span>
    );
  }
  return null;
}

interface CameraMonitoringCardProps {
  /** 'mic' đổi toàn bộ nhãn "camera" -> "mic" khi nhúng vào trang Loa công trường; dữ liệu/logic bên dưới vẫn thao tác trên camera vì mic gắn liền với camera tại vị trí đó. */
  variant?: 'camera' | 'mic';
}

export function CameraMonitoringCard({ variant = 'camera' }: CameraMonitoringCardProps) {
  const isMic = variant === 'mic';
  const noun = isMic ? 'mic' : 'camera';
  const { data: allCameras, isLoading } = useCameras({ includeDemo: true });
  const deleteCamera = useDeleteCamera();
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const realCameras = allCameras?.filter((c) => !DEMO_IDS.has(c.id));
  const demoCameras = allCameras?.filter((c) => DEMO_IDS.has(c.id));

  const handleAdd = () => {
    setEditingCamera(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (camera: Camera) => {
    setEditingCamera(camera);
    setIsDialogOpen(true);
  };

  const handleDelete = async (camera: Camera) => {
    const isDemo = DEMO_IDS.has(camera.id);
    const warning = isDemo
      ? `Xoá ${noun} mẫu "${camera.name}"? Sẽ mất luôn lịch sử vi phạm demo gắn với ${noun} này, không phục hồi được. Cần khởi động lại hệ thống để có tác dụng.`
      : `Xoá ${noun} "${camera.name}"? Cần khởi động lại hệ thống để AI engine bỏ luồng này.`;
    if (!confirm(warning)) return;
    try {
      await deleteCamera.mutateAsync(camera.id);
      toast(`Đã xoá ${noun}`, 'success');
    } catch {
      toast(`Xoá ${noun} thất bại`, 'error');
    }
  };

  const onlineReal = realCameras?.filter(c => c.status === CameraStatus.ONLINE).length ?? 0;

  return (
    <SettingCard>
      <div className="flex items-center justify-between mb-6">
        <SectionHeader
          title={isMic ? 'Giám sát mic' : 'Giám sát camera'}
          description={isMic
            ? 'Camera tại vị trí này phát cảnh báo giọng nói — kết nối webcam để test hoặc camera IP thật (RTSP) làm mic, quản lý riêng với camera mẫu ở trang Cameras.'
            : 'Kết nối webcam để test hoặc camera IP thật (RTSP), quản lý riêng với các camera mẫu ở trang Cameras.'}
        />
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-hover)] shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Thêm {noun}
        </button>
      </div>

      {/* Báo cáo nhanh */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{isMic ? 'Mic thật' : 'Camera thật'}</p>
          <p className="text-xl font-black text-[var(--text-primary)]">{realCameras?.length ?? 0}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">Đang trực tuyến</p>
          <p className="text-xl font-black text-[var(--success)]">{onlineReal}</p>
        </div>
        <div className="p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
          <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{isMic ? 'Mic mẫu (demo)' : 'Camera mẫu (demo)'}</p>
          <p className="text-xl font-black text-[var(--text-muted)]">{demoCameras?.length ?? mockCameras.length}</p>
        </div>
      </div>

      {/* Camera thật */}
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-[var(--text-muted)] text-center py-6">Đang tải...</p>}
        {realCameras?.map((camera) => (
          <div key={camera.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                camera.status === CameraStatus.ONLINE ? "bg-[var(--success-muted)] text-[var(--success)]" : "bg-[var(--border)] text-[var(--text-muted)]"
              )}>
                {camera.status === CameraStatus.ONLINE ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">{camera.name}</h4>
                  <SourceBadge rtspUrl={camera.rtspUrl} />
                </div>
                <p className="text-[10px] text-[var(--text-muted)] mt-1 truncate">
                  {camera.siteName} · {camera.location}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => handleEdit(camera)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)]">
                <Pencil className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => handleDelete(camera)} className="p-2 rounded-lg hover:bg-[var(--surface-hover)]">
                <Trash2 className="w-4 h-4 text-[var(--danger)]" />
              </button>
            </div>
          </div>
        ))}
        {!isLoading && realCameras?.length === 0 && (
          <p className="text-sm text-[var(--text-muted)] text-center py-6">
            Chưa có {noun} thật nào — bấm "Thêm {noun}" để kết nối webcam hoặc camera IP.
          </p>
        )}
      </div>

      {/* Camera mẫu (demo) — sửa được tên/vị trí/loại/trạng thái, không đổi được nguồn
          video. Xoá được, nhưng mất luôn theo là lịch sử vi phạm demo gắn với nó, và
          biến mất khỏi lưới xem trực tiếp lẫn AI engine — không phục hồi được. */}
      <div className="mt-8 pt-6 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-[var(--text-muted)]" />
          <h4 className="text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">{isMic ? 'Mic mẫu trên trang Cameras (demo)' : 'Camera mẫu trên trang Cameras (demo)'}</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {demoCameras?.map((cam) => (
            <div key={cam.id} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--background)] border border-dashed border-[var(--border)]">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--text-secondary)] truncate">{cam.name}</p>
                <p className="text-[9px] text-[var(--text-muted)] truncate">ID Demo · {cam.id}</p>
              </div>
              <button onClick={() => handleEdit(cam)} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] shrink-0">
                <Pencil className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              </button>
              <button onClick={() => handleDelete(cam)} className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] shrink-0">
                <Trash2 className="w-3.5 h-3.5 text-[var(--danger)]" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <CameraEditDialog
        camera={editingCamera}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        variant={variant}
      />
    </SettingCard>
  );
}
