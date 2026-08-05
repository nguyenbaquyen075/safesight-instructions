'use client';
// SPDX-License-Identifier: MIT

import * as React from 'react';
import { io, Socket } from 'socket.io-client';
import { Volume2, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockCameras } from '@/data/mock-cameras';
import { CameraStatus } from '@/types/enums';

const YOLO_SERVER_URL = process.env.NEXT_PUBLIC_YOLO_SERVER_URL || '';

export default function SiteSpeakerPage() {
  const [cameraId, setCameraId] = React.useState('');
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastPlayedAt, setLastPlayedAt] = React.useState<number | null>(null);

  const onlineCameras = mockCameras.filter((c) => c.status === CameraStatus.ONLINE);

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
      new Audio(URL.createObjectURL(blob)).play();
      setLastPlayedAt(Date.now());
    });

    return () => {
      socket.disconnect();
    };
  }, [cameraId]);

  return (
    <div className="max-w-xl mx-auto space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tighter">LOA CÔNG TRƯỜNG</h1>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          Chọn camera đại diện cho vị trí loa này — mọi cảnh báo giọng nói gửi tới camera đó sẽ tự phát ở đây.
        </p>
      </div>

      <select
        value={cameraId}
        onChange={(e) => setCameraId(e.target.value)}
        className="w-full p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)]"
      >
        <option value="">— Chọn camera —</option>
        {onlineCameras.map((cam) => (
          <option key={cam.id} value={cam.id}>
            {cam.name} ({cam.siteName})
          </option>
        ))}
      </select>

      {cameraId && (
        <div className="flex items-center gap-4 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)]">
          <div
            className={cn(
              "p-3 rounded-xl",
              isConnected ? "bg-[var(--success-muted)] text-[var(--success)]" : "bg-[var(--danger-muted)] text-[var(--danger)]"
            )}
          >
            {isConnected ? <Wifi className="w-6 h-6" /> : <WifiOff className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {isConnected ? 'Đã kết nối — sẵn sàng nhận cảnh báo' : 'Đang kết nối...'}
            </p>
            {lastPlayedAt && (
              <p className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-1">
                <Volume2 className="w-3 h-3" /> Vừa phát lúc {new Date(lastPlayedAt).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
