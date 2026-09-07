'use client';
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';

interface WebcamPreviewProps {
  deviceIndex: number;
  className?: string;
}

function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError') return 'Trình duyệt chưa được cấp quyền Camera.';
    if (err.name === 'NotReadableError') return 'Camera đang bị chương trình khác (AI engine) giữ độc quyền — không mở song song được trên máy này.';
    if (err.name === 'NotFoundError') return 'Không tìm thấy thiết bị camera theo chỉ số đã chọn.';
    return `${err.name}: ${err.message}`;
  }
  return err instanceof Error ? err.message : 'Không mở được webcam';
}

/** Hiện trực tiếp webcam của MÁY ĐANG XEM TRÌNH DUYỆT (getUserMedia) — không qua
 * server. LƯU Ý: AI engine (Python) cũng mở CÙNG thiết bị vật lý này để phân tích —
 * nhiều hệ điều hành/driver camera chỉ cho 1 tiến trình độc quyền truy cập tại 1
 * thời điểm, nên xem trước ở đây có thể báo lỗi "đang bị giữ" dù AI vẫn phân tích
 * bình thường phía sau. */
export function WebcamPreview({ deviceIndex, className }: WebcamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  // Đổi thiết bị -> về trạng thái "đang kết nối" ngay trong render (mẫu "adjust state
  // on prop change" của React) thay vì setState trong effect.
  const [prevDeviceIndex, setPrevDeviceIndex] = useState(deviceIndex);
  if (prevDeviceIndex !== deviceIndex) {
    setPrevDeviceIndex(deviceIndex);
    setStatus('connecting');
    setError(null);
  }

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) { setError('Trình duyệt này không hỗ trợ truy cập camera (getUserMedia).'); setStatus('error'); }
        return;
      }
      try {
        // Mở webcam MẶC ĐỊNH trước để trình duyệt xin quyền — deviceId đầy đủ chỉ
        // lộ ra SAU khi có quyền, nên chưa thể enumerateDevices() chọn đúng máy ngay.
        let s = await navigator.mediaDevices.getUserMedia({ video: true });
        if (deviceIndex > 0) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter(d => d.kind === 'videoinput');
          const target = videoInputs[deviceIndex];
          if (target) {
            s.getTracks().forEach(t => t.stop());
            s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: target.deviceId } } });
          }
        }
        if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          try {
            await videoRef.current.play();
          } catch {
            // autoplay có thể bị chặn — thẻ vẫn có srcObject, người dùng bấm vào video để phát
          }
        }
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (!cancelled) { setError(describeError(err)); setStatus('error'); }
      }
    }
    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [deviceIndex]);

  if (status === 'error') {
    return (
      <div className={className + ' flex flex-col items-center justify-center gap-2 bg-black text-white/40'}>
        <WifiOff className="w-6 h-6" />
        <p className="text-[10px] text-center px-4">{error}</p>
        <p className="text-[9px] text-center px-4 text-white/25">Kiểm tra quyền Camera cho trình duyệt trong System Settings &gt; Privacy &amp; Security &gt; Camera</p>
      </div>
    );
  }

  return (
    <>
      {status === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white/40 z-10">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
      <video ref={videoRef} autoPlay muted playsInline className={className} />
    </>
  );
}
