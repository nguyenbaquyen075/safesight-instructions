'use client';
// SPDX-License-Identifier: MIT

import * as React from 'react';
import { io, Socket } from 'socket.io-client';
import { Volume2, Wifi, WifiOff, ChevronDown, MapPin, Building2, Power, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockCameras } from '@/data/mock-cameras';
import { CameraStatus } from '@/types/enums';
import { CameraMonitoringCard } from '@/components/settings/CameraMonitoringCard';

const YOLO_SERVER_URL = process.env.NEXT_PUBLIC_YOLO_SERVER_URL || '';
// WAV câm 1 mẫu — phát 1 lần trong thao tác bấm của người dùng để "mở khoá"
// quyền tự động phát audio của trình duyệt (cần cho tablet/Safari).
const SILENT_AUDIO_SRC = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export default function SiteSpeakerPage() {
  const [cameraId, setCameraId] = React.useState('');
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastPlayedAt, setLastPlayedAt] = React.useState<number | null>(null);
  const [playError, setPlayError] = React.useState<string | null>(null);
  const [activated, setActivated] = React.useState(false);

  const onlineCameras = mockCameras.filter((c) => c.status === CameraStatus.ONLINE);
  const selectedCamera = onlineCameras.find((c) => c.id === cameraId);

  React.useEffect(() => {
    if (!cameraId || !YOLO_SERVER_URL) return;

    const socket: Socket = io(YOLO_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('subscribe-camera', cameraId);
    });
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('voice-broadcast', (data: { cameraId: string; audio: ArrayBuffer; mimeType: string }) => {
      if (data.cameraId !== cameraId) return;
      const blob = new Blob([data.audio], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url));
      audio
        .play()
        .then(() => {
          setPlayError(null);
          setLastPlayedAt(Date.now());
        })
        .catch(() => {
          URL.revokeObjectURL(url);
          setPlayError('Không phát được cảnh báo vừa nhận — kiểm tra âm thanh thiết bị này.');
        });
    });

    return () => {
      socket.disconnect();
    };
  }, [cameraId]);

  const activate = () => {
    new Audio(SILENT_AUDIO_SRC).play().catch(() => {});
    setActivated(true);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Header — cùng phong cách badge + tiêu đề lớn với trang Camera */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className={cn(
                "px-2 py-1 rounded text-white text-[10px] font-black uppercase tracking-widest transition-all",
                !cameraId
                  ? "bg-[var(--text-muted)]/40 text-[var(--text-primary)]"
                  : isConnected ? "bg-[var(--success)]" : "bg-[var(--danger)] animate-pulse"
              )}
            >
              {!cameraId ? 'Chưa chọn loa' : isConnected ? 'Đã kết nối' : 'Mất kết nối'}
            </div>
            <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter">LOA CÔNG TRƯỜNG</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm max-w-xl">
            Chọn mic đại diện cho vị trí loa này — mọi cảnh báo giọng nói AI gửi tới mic đó sẽ tự động phát ở thiết bị này.
          </p>
        </div>
      </div>

      <CameraMonitoringCard variant="mic" />

      {/* Cách hoạt động — 3 bước, giúp người vận hành hiểu quy trình */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
        <h2 className="flex items-center gap-2 text-xs font-black text-[var(--text-muted)] uppercase tracking-widest mb-4">
          <ListChecks className="w-3.5 h-3.5" /> Cách hoạt động
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: '1', text: 'Chọn mic đại diện cho vị trí đặt loa này.' },
            { n: '2', text: 'Bấm "Kích hoạt loa" một lần để mở quyền phát âm thanh trên thiết bị.' },
            { n: '3', text: 'Loa tự động phát mọi cảnh báo giọng nói AI gửi tới mic đã chọn.' },
          ].map((step) => (
            <div key={step.n} className="flex items-start gap-3">
              <span className="shrink-0 w-6 h-6 rounded-lg bg-[var(--primary-muted)] text-[var(--primary)] text-xs font-black flex items-center justify-center">
                {step.n}
              </span>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chọn mic */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs font-black text-[var(--text-muted)] uppercase tracking-widest">
          <Volume2 className="w-3.5 h-3.5" /> Mic đại diện
        </label>
        <div className="relative">
          <select
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            className="w-full p-4 pr-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] text-sm font-bold appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 focus:border-[var(--primary)] transition-all"
          >
            <option value="">— Chọn mic —</option>
            {onlineCameras.map((cam) => (
              <option key={cam.id} value={cam.id}>
                {cam.name} ({cam.siteName})
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-[var(--text-muted)] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {selectedCamera && (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)]">
            <div className="p-2.5 rounded-lg bg-[var(--primary-muted)] text-[var(--primary)]">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)] truncate">{selectedCamera.siteName}</p>
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 shrink-0" /> {selectedCamera.location}
              </p>
            </div>
          </div>
        )}
      </div>

      {!cameraId ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 rounded-[2rem] border border-dashed border-[var(--border)] text-[var(--text-muted)]">
          <Volume2 className="w-8 h-8 text-[var(--text-muted)]" />
          <p className="text-sm font-bold">Chưa chọn mic</p>
          <p className="text-xs max-w-xs text-center">Chọn 1 mic ở trên để bắt đầu nhận cảnh báo giọng nói tại đây.</p>
        </div>
      ) : !YOLO_SERVER_URL ? (
        <div className="p-6 rounded-2xl bg-[var(--danger-muted)] border border-[var(--danger)]/30 text-sm text-[var(--danger)]">
          Chưa cấu hình máy chủ YOLO (NEXT_PUBLIC_YOLO_SERVER_URL) — không thể nhận cảnh báo.
        </div>
      ) : (
        <div className="space-y-3">
          {!activated && (
            <button
              onClick={activate}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-bold transition-all"
            >
              <Power className="w-4 h-4" />
              Kích hoạt loa (bấm 1 lần trước khi dùng trên máy tính bảng)
            </button>
          )}
          <div className="flex items-center gap-4 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
            <div
              className={cn(
                "p-3 rounded-xl",
                isConnected ? "bg-[var(--success-muted)] text-[var(--success)]" : "bg-[var(--danger-muted)] text-[var(--danger)]"
              )}
            >
              {isConnected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {isConnected && <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />}
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {isConnected ? 'Đã kết nối — sẵn sàng nhận cảnh báo' : 'Đang kết nối...'}
                </p>
              </div>
              {lastPlayedAt && (
                <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Vừa phát lúc {new Date(lastPlayedAt).toLocaleTimeString()}
                </p>
              )}
              {playError && (
                <p className="text-xs text-[var(--danger)] mt-1">{playError}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
