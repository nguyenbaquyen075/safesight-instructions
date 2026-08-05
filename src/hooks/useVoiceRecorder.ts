// SPDX-License-Identifier: MIT

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_RECORDING_MS = 30_000; // tự dừng sau 30s phòng quên bấm dừng

export interface UseVoiceRecorderResult {
  isRecording: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
}

export function useVoiceRecorder(onStop: (blob: Blob) => void): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const unsupported =
      typeof window === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined';

    if (unsupported) {
      setError('Trình duyệt này không hỗ trợ ghi âm.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        cleanupStream();
        setIsRecording(false);
        onStopRef.current(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      stopTimeoutRef.current = setTimeout(() => {
        stop();
      }, MAX_RECORDING_MS);
    } catch {
      setError('Cần cấp quyền micro để dùng tính năng này.');
      setIsRecording(false);
    }
  }, [cleanupStream, stop]);

  // Dừng mic + nhả stream khi component unmount giữa chừng lúc đang ghi
  // (vd: camera hết vi phạm hoặc bị lọc khỏi lưới trong lúc đang ghi âm).
  useEffect(() => {
    return () => {
      if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
      mediaRecorderRef.current?.stop();
      cleanupStream();
    };
  }, [cleanupStream]);

  return { isRecording, error, start, stop };
}
