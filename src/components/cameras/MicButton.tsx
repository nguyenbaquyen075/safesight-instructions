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
}

export function MicButton({ cameraId, mode }: MicButtonProps) {
  const { isRecording, error, start, stop } = useVoiceRecorder();
  const [sending, setSending] = React.useState(false);

  const sendBroadcast = async (blob: Blob) => {
    setSending(true);
    const audioBuffer = await blob.arrayBuffer();
    const socket = io(YOLO_SERVER_URL);
    socket.on('connect', () => {
      socket.emit('voice-broadcast', { cameraId, mimeType: blob.type, audio: audioBuffer });
      setTimeout(() => {
        socket.disconnect();
        setSending(false);
      }, 300);
    });
    socket.on('connect_error', () => {
      socket.disconnect();
      setSending(false);
    });
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRecording) {
      const blob = await stop();
      if (!blob) return;
      if (mode === 'demo') {
        new Audio(URL.createObjectURL(blob)).play();
      } else {
        sendBroadcast(blob);
      }
    } else {
      start();
    }
  };

  if (error) {
    return (
      <div
        title={error}
        className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur-md flex items-center justify-center text-white/40"
      >
        <MicOff className="w-4 h-4" />
      </div>
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
