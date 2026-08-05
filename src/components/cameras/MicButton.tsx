'use client';
// SPDX-License-Identifier: MIT

import * as React from 'react';
import { Mic, Square, MicOff } from 'lucide-react';
import { io } from 'socket.io-client';
import { cn } from '@/lib/utils';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

const YOLO_SERVER_URL = process.env.NEXT_PUBLIC_YOLO_SERVER_URL || '';

interface MicButtonProps {
  cameraId: string;
  mode: 'demo' | 'broadcast';
  hasViolation: boolean;
  onError?: (message: string) => void;
}

export function MicButton({ cameraId, mode, hasViolation, onError }: MicButtonProps) {
  const [sending, setSending] = React.useState(false);

  const sendBroadcast = (blob: Blob) => {
    if (!YOLO_SERVER_URL) {
      onError?.('Chưa cấu hình máy chủ YOLO (NEXT_PUBLIC_YOLO_SERVER_URL).');
      return;
    }
    setSending(true);
    blob.arrayBuffer().then((audioBuffer) => {
      const socket = io(YOLO_SERVER_URL, { transports: ['websocket'] });
      socket.on('connect', () => {
        socket.emit('voice-broadcast', { cameraId, mimeType: blob.type, audio: audioBuffer }, () => {
          socket.disconnect();
          setSending(false);
        });
      });
      socket.on('connect_error', () => {
        socket.disconnect();
        setSending(false);
        onError?.('Gửi cảnh báo thất bại — kiểm tra kết nối tới máy chủ YOLO.');
      });
    });
  };

  const { isRecording, error, start, stop } = useVoiceRecorder((blob) => {
    if (mode === 'demo') {
      const audio = new Audio(URL.createObjectURL(blob));
      audio.addEventListener('ended', () => URL.revokeObjectURL(audio.src));
      audio.play().catch(() => onError?.('Không phát lại được bản ghi.'));
    } else {
      sendBroadcast(blob);
    }
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRecording) {
      stop();
    } else {
      start();
    }
  };

  // Ẩn nút khi camera hết vi phạm — TRỪ khi đang ghi dở, để không cắt ngang
  // bản ghi khi trạng thái vi phạm (dữ liệu YOLO real-time) đổi giữa chừng.
  if (!hasViolation && !isRecording) {
    return null;
  }

  if (error) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          start();
        }}
        title={`${error} (bấm để thử lại)`}
        className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center text-white/40 hover:text-white/70 transition-all"
      >
        <MicOff className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={sending}
      title={isRecording ? 'Dừng và gửi' : 'Bấm để nói'}
      className={cn(
        "w-8 h-8 rounded-lg backdrop-blur-md flex items-center justify-center text-white transition-all disabled:opacity-50",
        isRecording ? "bg-red-500 animate-pulse" : "bg-white/10 hover:bg-[var(--primary)]"
      )}
    >
      {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
    </button>
  );
}
