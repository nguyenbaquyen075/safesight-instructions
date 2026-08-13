// SPDX-License-Identifier: MIT

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface Detection {
  id: string;
  type: string;
  label: string;
  confidence: number;
  isViolation: boolean;
  trackId?: number | null;   // mã theo dõi từng người (dùng chống ghi trùng vi phạm 1 đối tượng)
  missingPpe?: string[];     // đồ bảo hộ đang thiếu, vd ['helmet','gloves'] (do ppe_tracker.py gửi)
  bbox: {
    top: string;
    left: string;
    width: string;
    height: string;
  };
}

const YOLO_SERVER_URL =
  process.env.NEXT_PUBLIC_YOLO_SERVER_URL || '';

/**
 * cameraId: chỉ nhận detection của 1 camera (room riêng, đỡ băng thông) — dùng cho CameraCard.
 * Bỏ trống: nhận TẤT CẢ camera (room 'all-cameras') — dùng cho trang cần quét toàn bộ (vd danh sách).
 */
export const useYolo = (cameraId?: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [detectionsMap, setDetectionsMap] = useState<Record<string, Detection[]>>({});
  const socketRef = useRef<Socket | null>(null);
  // Thời điểm cuối mỗi camera có detection (để giữ khung "dính" tránh nhấp nháy)
  const lastSeenRef = useRef<Record<string, number>>({});
  const STICKY_MS = 500; // giữ khung 0.5s sau lần bắt cuối (đủ chống nhấp nháy, ít trễ)

  useEffect(() => {
    // Skip connection if no YOLO server URL is configured
    if (!YOLO_SERVER_URL) {
      setLastEvent('YOLO server not configured (NEXT_PUBLIC_YOLO_SERVER_URL)');
      return;
    }

    const socket = io(YOLO_SERVER_URL, {
      reconnection: true,
      reconnectionAttempts: Infinity,   // thử lại MÃI — tự nối khi bridge chạy
      reconnectionDelay: 1500,
      reconnectionDelayMax: 4000,
      timeout: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setLastEvent('Connected to AI Inference Bridge');
      // Join lại room mỗi lần (re)connect — bridge chỉ nhớ room theo socket hiện tại
      if (cameraId) socket.emit('subscribe-camera', cameraId);
      else socket.emit('subscribe-all');
    });

    socket.on('connect_error', () => {
      setIsConnected(false);
      setLastEvent('Đang chờ YOLO Bridge... (tự kết nối lại khi bridge chạy)');
      // KHÔNG ngắt kết nối -> để socket tự thử lại tới khi bridge lên, khỏi cần F5
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('yolo-data', (data: { cameraId: string; detections: Detection[] }) => {
      // Chỉ cập nhật khi CÓ vật; frame trống thì GIỮ khung cũ (chống nhấp nháy)
      if (data.detections.length > 0) {
        lastSeenRef.current[data.cameraId] = Date.now();
        setDetectionsMap(prev => ({
          ...prev,
          [data.cameraId]: data.detections,
        }));
        setLastEvent(`Processed frame: ${data.detections.length} objects`);
      }
    });

    // Dọn khung "dính" đã quá hạn (không còn vật thật sự sau STICKY_MS)
    const sweep = setInterval(() => {
      const now = Date.now();
      setDetectionsMap(prev => {
        let changed = false;
        const next: Record<string, Detection[]> = {};
        for (const [camId, dets] of Object.entries(prev)) {
          if (now - (lastSeenRef.current[camId] || 0) > STICKY_MS) {
            if (dets.length > 0) changed = true; // sẽ xóa
          } else {
            next[camId] = dets;
          }
        }
        return changed ? next : prev;
      });
    }, 500);

    socket.on('new-violation', (data: any) => {
      setLastEvent(`🚨 VIOLATION: ${data.label}`);
    });

    return () => {
      clearInterval(sweep);
      socket.disconnect();
    };
  }, [cameraId]);

  const getDetectionsForCamera = useCallback(
    (cameraId: string) => detectionsMap[cameraId] || [],
    [detectionsMap]
  );

  return { isConnected, lastEvent, getDetectionsForCamera };
};
