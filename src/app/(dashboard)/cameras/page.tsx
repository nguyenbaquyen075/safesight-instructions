'use client';
// SPDX-License-Identifier: MIT


import * as React from 'react';
import Link from 'next/link';
import {
  Camera as CameraIcon,
  Search,
  Filter,
  MoreVertical,
  Building2,
  Activity,
  Wifi,
  WifiOff,
  AlertCircle,
  Plus,
  Maximize2,
  RefreshCw,
  X,
  History,
  PlayCircle,
  Clock,
  ShieldAlert,
  Bell,
  Terminal,
  ChevronRight,
  Cpu,
  ShieldCheck,
  Zap,
  Radio
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useYolo, Detection } from '@/hooks/useYolo';
import { mockCameras } from '@/data/mock-cameras';
import { mockViolations } from '@/data/mock-violations';
import { CameraStatus, Severity } from '@/types/enums';
import cameraVideos from '@/data/camera-videos.json';
import { MicButton } from '@/components/cameras/MicButton';
import { WebcamPreview } from '@/components/cameras/WebcamPreview';
import { useCameras } from '@/hooks/use-cameras';
import { parseCameraSource } from '@/lib/camera-source';
import { DEMO_CAMERA_IDS } from '@/lib/camera-shape';

// --- Video của từng camera ---
// Đọc từ NGUỒN DUY NHẤT src/data/camera-videos.json (YOLO cũng đọc chính file này).
// Gán video nào cho 1 ô -> ô đó chiếu đúng video ĐÓ và YOLO tự phân tích -> tự bắt lỗi.
function videoForCamera(cameraId: string): string {
  const file = (cameraVideos as Record<string, string>)[cameraId] || '210321.mp4';
  return `/videos/${file}`;
}

// --- Sub-components ---

function AIDetectionBox({ detection }: { detection: Detection }) {
  const { label, confidence, bbox, isViolation, type } = detection;
  const isPerson = type === 'person';

  // Vẽ CẢ HAI: 🟢 xanh khi an toàn (đủ đồ bảo hộ), 🔴 đỏ khi vi phạm.
  // Khung NGƯỜI to -> CHỈ viền, KHÔNG tô nền (tránh mảng đỏ/xanh loang cả thân,
  // gây cảm giác "nhiều khung"). Khung bộ phận nhỏ (mũ/áo/giày) -> tô nền nhẹ cho dễ thấy.
  return (
    <div
      className={cn(
        // transition-colors: đổi màu mượt, NHƯNG vị trí khung nhảy tức thì -> bám sát chuyển động
        "absolute border-2 transition-colors duration-150 pointer-events-none z-10",
        isViolation ? "border-red-500" : "border-emerald-500",
        !isPerson && (isViolation ? "bg-red-500/15" : "bg-emerald-500/10")
      )}
      style={{
        top: bbox.top,
        left: bbox.left,
        width: bbox.width,
        height: bbox.height
      }}
    >
      <div className={cn(
        "absolute -top-4 left-0 px-1.5 py-0.5 text-[9px] font-black text-white whitespace-nowrap uppercase rounded-sm shadow-lg",
        isViolation ? "bg-red-500" : "bg-emerald-500"
      )}>
        {label} {(confidence * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function LiveLog({ lastEvent }: { lastEvent: string | null }) {
  const [logs, setLogs] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (lastEvent) {
      setLogs(prev => [lastEvent, ...prev.slice(0, 5)]);
    }
  }, [lastEvent]);

  React.useEffect(() => {
    if (logs.length === 0) {
      setLogs(['[HỆ THỐNG] Đang khởi tạo mô hình AI...', '[HỆ THỐNG] Đang kết nối tới YOLO Bridge...']);
    }
  }, []);

  return (
    <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 h-48 overflow-hidden font-mono text-[10px] text-[var(--success)] shadow-2xl">
      <div className="flex items-center gap-2 mb-3 text-white/40 border-b border-white/5 pb-2">
        <Terminal className="w-3 h-3" />
        <span className="uppercase tracking-widest font-black">Nhật ký Xử lý AI trực tiếp</span>
      </div>
      <div className="space-y-2 overflow-y-auto h-full scrollbar-none">
        {logs.map((log, i) => (
          <div key={i} className="animate-fade-in flex gap-2">
            <span className="text-white/20 select-none">{">"}</span>
            <span className={cn(i === 0 ? "text-white" : "text-[var(--success)]/60")}>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- NEW: Camera Expansion Modal ---
function LiveEventModal({ camera, detections, onClose, videoUrl }: { camera: any, detections: Detection[], onClose: () => void, videoUrl: string }) {
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  // Lịch sử vi phạm ĐÃ GHI NHẬN của camera này (đọc từ feed thật, tự cập nhật khi có bản ghi mới)
  const [history, setHistory] = React.useState<any[]>([]);

  React.useEffect(() => {
    const load = () => {
      try {
        const all = JSON.parse(localStorage.getItem('safesight_alerts') || '[]');
        setHistory(all.filter((a: any) => a.cameraName === camera?.name));
      } catch {
        setHistory([]);
      }
    };
    load();
    window.addEventListener('new-alert', load); // có vi phạm mới -> nạp lại ngay (real-time)
    return () => window.removeEventListener('new-alert', load);
  }, [camera?.name]);

  if (!camera) return null;

  // --- DANH SÁCH ĐỘNG: (1) YOLO đang bắt trong khung hình + (2) vi phạm đã ghi nhận ---
  const liveItems = detections.map(d => ({
    key: `live-${d.id}`,
    title: d.label,
    desc: `🔴 ĐANG TRONG KHUNG HÌNH • Độ tin cậy ${(d.confidence * 100).toFixed(0)}%`,
    isViolation: d.isViolation,
    live: true,
  }));
  // Đối tượng ĐANG trong khung hình -> bỏ bản ghi lịch sử trùng đối tượng đó
  // (tránh 1 người vừa hiện ở "live" vừa hiện lại ở "đã ghi nhận" cùng lúc).
  const liveTrackIds = new Set(detections.filter(d => d.trackId != null).map(d => d.trackId));
  const historyItems = history
    .filter((h: any) => h.trackId == null || !liveTrackIds.has(h.trackId))
    .map((h: any, i: number) => ({
      key: `his-${h.id ?? i}`,
      title: h.type,
      desc: `Đã ghi nhận lúc ${h.time} ${h.date} • ${h.siteName}`,
      isViolation: true,
      live: false,
    }));
  const items = [...liveItems, ...historyItems];

  // --- Thống kê nhanh của khung hình hiện tại ---
  const persons = detections.filter(d => d.type === 'person');
  const violators = persons.filter(d => d.isViolation);
  const missingCounts = { helmet: 0, gloves: 0, boots: 0 };
  persons.forEach(p => {
    p.missingPpe?.forEach(m => {
      if (m in missingCounts) missingCounts[m as keyof typeof missingCounts]++;
    });
  });
  const current = items.find(it => it.key === selectedKey) ?? items[0]
    ?? { title: 'Chưa có phát hiện', desc: 'YOLO chưa bắt được đối tượng nào trong khung hình của camera này.', isViolation: false, live: false, key: 'none' };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
      <div className="relative w-full max-w-7xl max-h-[90vh] flex flex-col lg:flex-row gap-6">

        {/* ==== Cột trái: video + tiêu đề/mô tả bên dưới ==== */}
        <div className="flex-1 flex flex-col bg-[#0b1220] rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl">
          <div className="relative aspect-video bg-black">
            <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary)] flex items-center justify-center text-white shadow-glow-primary">
                  <CameraIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white tracking-tight uppercase">{camera.name}</h2>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                    <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest">GIÁM SÁT AI TRỰC TIẾP • {camera.siteName}</p>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-3 rounded-xl bg-white/10 hover:bg-red-500 text-white transition-all transform hover:rotate-90">
                <X className="w-5 h-5" />
              </button>
            </div>

            <video
              src={videoUrl}
              autoPlay muted loop playsInline
              className="w-full h-full object-fill opacity-90"
            />

            <div className="absolute inset-0 pointer-events-none">
              {detections.map(d => (
                <AIDetectionBox key={d.id} detection={d} />
              ))}
            </div>

            <div className="absolute bottom-4 left-4 px-4 py-3 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 flex items-center gap-6 z-50">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Đối tượng</span>
                <span className="text-lg font-black text-white">{detections.length}</span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Độ chính xác AI</span>
                <span className="text-lg font-black text-[var(--success)]">98.4%</span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Độ trễ</span>
                <span className="text-lg font-black text-[var(--primary)]">12ms</span>
              </div>
            </div>
          </div>

          {/* Tiêu đề + mô tả của phát hiện đang chọn (dữ liệu thật) */}
          <div className="p-6 border-t border-white/5">
            <h3 className={cn(
              "text-xl font-black tracking-tight",
              current.isViolation ? "text-red-400" : "text-white"
            )}>{current.title}</h3>
            <p className="text-sm text-white/50 mt-1">{current.desc}</p>
          </div>
        </div>

        {/* ==== Cột phải: PHÁT HIỆN THẬT của camera này (live + lịch sử) ==== */}
        <div className="w-full lg:w-[380px] flex flex-col min-h-0">
          {/* Thống kê nhanh: số lỗi, số người trong khung, số người thiếu đồ bảo hộ */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Số lỗi ghi nhận</p>
              <p className="text-lg font-black text-white">{items.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Người trong khung</p>
              <p className="text-lg font-black text-white">{persons.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Người vi phạm</p>
              <p className="text-lg font-black text-red-400">{violators.length}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/[0.04] border border-white/10">
              <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Thiếu đồ bảo hộ</p>
              <p className="text-[11px] font-bold text-white/70 leading-tight mt-0.5">
                Mũ {missingCounts.helmet} · Găng {missingCounts.gloves} · Giày {missingCounts.boots}
              </p>
            </div>
          </div>

          <h4 className="text-sm font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
            Phát hiện ( {items.length} )
          </h4>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-none">
            {items.length === 0 && (
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-sm text-white/40">
                Chưa có phát hiện nào — chờ YOLO bắt đối tượng trong khung hình...
              </div>
            )}
            {items.map(it => (
              <button
                key={it.key}
                onClick={() => setSelectedKey(it.key)}
                className={cn(
                  "w-full flex items-center gap-4 p-3 rounded-2xl border text-left transition-all",
                  it.key === current.key
                    ? "bg-[var(--primary)]/15 border-[var(--primary)]/50"
                    : "bg-white/[0.04] border-white/10 hover:bg-white/[0.08]"
                )}
              >
                {/* Ảnh nhỏ: khung hình video camera này, viền đỏ nếu vi phạm */}
                <video src={videoUrl} muted playsInline preload="metadata"
                  className={cn(
                    "w-16 h-12 rounded-lg object-cover shrink-0 bg-black border-2",
                    it.isViolation ? "border-red-500" : "border-emerald-500/60"
                  )} />
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-bold truncate",
                    it.isViolation ? "text-red-400" : "text-emerald-400"
                  )}>{it.title}</p>
                  <p className="text-xs text-white/40 truncate">{it.desc}</p>
                </div>
                {it.live && (
                  <span className="shrink-0 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-red-500 text-white animate-pulse">
                    Live
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function CamerasPage() {
  const [selectedCamera, setSelectedCamera] = React.useState<any>(null);
  const [mounted, setMounted] = React.useState(false);
  const [notification, setNotification] = React.useState<any>(null);
  const [showViolationsOnly, setShowViolationsOnly] = React.useState(false);
  const [voiceMode, setVoiceMode] = React.useState<'demo' | 'broadcast'>('demo');

  const { isConnected, lastEvent, getDetectionsForCamera } = useYolo();
  const { data: allCameras, isLoading: camerasLoading } = useCameras({ includeDemo: true });
  const realCameras = allCameras?.filter(c => !DEMO_CAMERA_IDS.has(c.id));
  // Camera demo đã bị xoá (qua Cài đặt > Giám sát) sẽ mất khỏi đây -> không hiện
  // trên lưới nữa. Trong lúc đang tải, coi như còn đủ để khỏi nhấp nháy mất rồi hiện lại.
  const existingDemoIds = camerasLoading
    ? DEMO_CAMERA_IDS
    : new Set((allCameras ?? []).filter(c => DEMO_CAMERA_IDS.has(c.id)).map(c => c.id));

  const showNotification = (title: string, desc: string, type: 'success' | 'danger' | 'warning' = 'success') => {
    setNotification({ id: Math.random(), title, desc, type });
    setTimeout(() => setNotification(null), 5000);
  };

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // --- Ghi nhận vi phạm THỜI GIAN THỰC, nhưng MỖI ĐỐI TƯỢNG chỉ 1 LẦN ---
  // Cùng 1 người (trackId) xuất hiện ở nhiều khung hình -> chỉ lưu 1 lần duy nhất
  // (đó là cùng 1 đối tượng + tránh làm đầy dữ liệu). Người MỚI (trackId khác) -> ghi mới.
  const recordedViolationsRef = React.useRef<Set<string>>(new Set());

  // Nạp lại danh sách đối tượng đã ghi (để F5 không lưu trùng)
  React.useEffect(() => {
    if (!mounted) return;
    try {
      const saved = JSON.parse(localStorage.getItem('safesight_recorded_violations') || '[]');
      recordedViolationsRef.current = new Set(saved);
    } catch {
      recordedViolationsRef.current = new Set();
    }
  }, [mounted]);

  React.useEffect(() => {
    if (!mounted) return;

    const activeCams = mockCameras.filter(c => c.status === CameraStatus.ONLINE);
    activeCams.forEach(cam => {
      const detections = getDetectionsForCamera(cam.id);
      // Chỉ xét khung NGƯỜI vi phạm có mã theo dõi (trackId) -> đại diện đúng 1 đối tượng
      const violators = detections.filter(
        d => d.isViolation && d.type === 'person' && d.trackId != null
      );

      violators.forEach(v => {
        const key = `${cam.id}:${v.trackId}`;
        if (recordedViolationsRef.current.has(key)) return; // đối tượng này ĐÃ ghi -> bỏ qua
        recordedViolationsRef.current.add(key);

        // Lưu danh sách key (giới hạn 500 gần nhất để không phình localStorage)
        const keysArr = Array.from(recordedViolationsRef.current).slice(-500);
        localStorage.setItem('safesight_recorded_violations', JSON.stringify(keysArr));

        showNotification('Phát hiện Vi phạm AI', `${v.label} tại ${cam.name}`, 'danger');

        const now = Date.now();
        const aiAlert = {
          id: `ai-${cam.id}-${v.trackId}-${now}`,
          trackId: v.trackId,
          type: v.label,
          severity: 'CRITICAL',
          cameraId: cam.id,
          siteName: cam.siteName,
          cameraName: cam.name,
          date: new Date().toLocaleDateString(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          timestamp: now,
          clipUrl: videoForCamera(cam.id),   // video vi phạm ĐÚNG của camera này (chỉ trả 1 lần)
          description: `AI phát hiện ${v.label} tại khu vực ${cam.name}.`
        };

        const existingAlerts = JSON.parse(localStorage.getItem('safesight_alerts') || '[]');
        localStorage.setItem('safesight_alerts', JSON.stringify([aiAlert, ...existingAlerts.slice(0, 49)]));

        // Báo cho các trang khác (Vi phạm, Phân tích) cập nhật real-time
        window.dispatchEvent(new Event('new-alert'));
      });
    });
  }, [getDetectionsForCamera, mounted]);

  if (!mounted) return null;

  // Danh sách camera online (thật + demo) + phát hiện AI hiện tại — dùng chung cho
  // lưới xem trực tiếp bên dưới VÀ bảng tổng quan tuân thủ PPE cuối trang.
  const demoTiles = mockCameras.filter(c => c.status === CameraStatus.ONLINE && existingDemoIds.has(c.id)).slice(0, 6).map(cam => {
    const detections = getDetectionsForCamera(cam.id);
    return { id: cam.id, cam, isDemo: true as const, detections, hasViolation: detections.some(d => d.isViolation), videoUrl: videoForCamera(cam.id) };
  });
  const realTiles = (realCameras ?? []).filter(c => c.status === CameraStatus.ONLINE).map(cam => {
    const parsed = parseCameraSource(cam.rtspUrl);
    const detections = getDetectionsForCamera(cam.id);
    return { id: cam.id, cam, isDemo: false as const, detections, hasViolation: detections.some(d => d.isViolation), parsed };
  });
  const onlineCameraTiles = [...realTiles, ...demoTiles];
  const violationCount = onlineCameraTiles.filter(c => c.hasViolation).length;
  const visibleCameras = showViolationsOnly ? onlineCameraTiles.filter(c => c.hasViolation) : onlineCameraTiles;

  const framePersons = onlineCameraTiles.flatMap(t => t.detections).filter(d => d.type === 'person');
  const frameViolators = framePersons.filter(d => d.isViolation);
  const missingPpeCounts: Record<string, number> = { helmet: 0, gloves: 0, boots: 0 };
  framePersons.forEach(p => {
    p.missingPpe?.forEach(m => {
      if (m in missingPpeCounts) missingPpeCounts[m]++;
    });
  });

  return (
    <div className="space-y-8 pb-20 relative">
      {/* Notifications */}
      {notification && (
        <div className="fixed top-24 right-10 z-[300] animate-slide-in-right">
          <div className={cn(
            "p-4 rounded-[1.5rem] border shadow-2xl flex items-center gap-4 backdrop-blur-2xl max-w-sm border-white/10",
            notification.type === 'danger' ? "bg-red-500/20 border-red-500/40" : "bg-[var(--success-muted)] border-[var(--success)]/40"
          )}>
            <div className={cn("p-3 rounded-xl bg-white/10", notification.type === 'danger' ? "text-red-500" : "text-[var(--success)]")}>
              {notification.type === 'danger' ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-white">{notification.title}</h4>
              <p className="text-xs text-white/60">{notification.desc}</p>
            </div>
          </div>
        </div>
      )}

      {selectedCamera && (
        <LiveEventModal
          camera={selectedCamera.cam}
          detections={getDetectionsForCamera(selectedCamera.cam.id)}
          onClose={() => setSelectedCamera(null)}
          videoUrl={selectedCamera.videoUrl}
        />
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn(
              "px-2 py-1 rounded text-white text-[10px] font-black uppercase tracking-widest transition-all",
              isConnected ? "bg-[var(--success)]" : "bg-[var(--danger)] animate-pulse"
            )}>
              {isConnected ? 'YOLO Đã kết nối' : 'YOLO Mất kết nối'}
            </div>
            <h1 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter">TRUNG TÂM GIÁM SÁT AI</h1>
          </div>
          <p className="text-[var(--text-muted)] text-sm max-w-xl">Hệ thống giám sát thông minh thời gian thực xử lý 16 luồng trực tiếp với phân tích AI hành vi.</p>
        </div>
        <div className="w-full lg:w-80">
          <LiveLog lastEvent={lastEvent} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Luồng hoạt động', value: '16', icon: Wifi, color: 'success' },
          { label: 'Bộ xử lý AI', value: '4/4', icon: Cpu, color: 'primary' },
          { label: 'Độ trễ', value: '8ms', icon: Activity, color: 'info' },
          { label: 'Tiêu chuẩn Mũ', value: 'Xanh (CRC)', icon: ShieldCheck, color: 'success' },
        ].map(stat => (
          <div key={stat.label} className="bg-[var(--surface)] border border-[var(--border)] p-4 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className={cn("p-2 rounded-lg bg-[var(--surface-elevated)]", stat.color === 'success' ? 'text-[var(--success)]' : 'text-[var(--primary)]')}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">{stat.label}</p>
              <p className="text-sm font-black text-[var(--text-primary)]">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--primary-muted)] border border-[var(--primary)]/20">
        <p className="text-xs text-[var(--primary-light)]">
          Lưới bên dưới gồm cả camera <strong>mẫu (demo)</strong> để minh hoạ và camera <strong>thật</strong> của bạn. Thêm/sửa/đóng camera thật ở Cài đặt.
        </p>
        <Link
          href="/settings"
          className="shrink-0 px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[var(--primary-hover)] transition-all"
        >
          Quản lý camera thật
        </Link>
      </div>

      {(() => {
        return (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowViolationsOnly(v => !v)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-black uppercase tracking-widest transition-all",
                  showViolationsOnly
                    ? "bg-red-500 border-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]"
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                {showViolationsOnly ? `Đang vi phạm (${violationCount})` : `Lọc: chỉ vi phạm (${violationCount})`}
              </button>
              {showViolationsOnly && (
                <span className="text-xs text-[var(--text-muted)]">
                  Hiển thị {visibleCameras.length} / {onlineCameraTiles.length} luồng
                </span>
              )}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                <button
                  onClick={() => setVoiceMode('demo')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    voiceMode === 'demo' ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"
                  )}
                >
                  Mic: Demo
                </button>
                <button
                  onClick={() => setVoiceMode('broadcast')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                    voiceMode === 'broadcast' ? "bg-[var(--primary)] text-white" : "text-[var(--text-muted)]"
                  )}
                >
                  Mic: Thật
                </button>
              </div>
            </div>

            {visibleCameras.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 rounded-[2rem] border border-dashed border-[var(--border)] text-[var(--text-muted)]">
                <ShieldCheck className="w-8 h-8 text-[var(--success)]" />
                <p className="text-sm font-bold">Không có camera nào đang vi phạm</p>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {visibleCameras.map((tile, idx) => {
                const { cam, detections, hasViolation, isDemo } = tile;
                const videoUrl = isDemo ? tile.videoUrl : undefined;
                return (
            <div
              key={cam.id}
              className={cn(
                "group relative bg-black rounded-[2rem] overflow-hidden border-2 transition-all duration-500 hover:shadow-2xl animate-fade-up h-[320px]",
                hasViolation ? "border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.4)]" : isDemo ? "border-white/5" : "border-[var(--primary)]/40"
              )}
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="absolute top-0 left-0 right-0 h-8 bg-black/80 flex items-center justify-center gap-2 z-50">
                <span className="text-white text-[10px] font-black uppercase tracking-widest">{cam.name}</span>
                {isDemo ? (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-white/10 text-white/50" title={`ID Demo: ${cam.id}`}>
                    ID Demo · {cam.id}
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-[var(--success)]/20 text-[var(--success)]">
                    Thật
                  </span>
                )}
              </div>

              {isDemo ? (
                <video
                  src={videoUrl}
                  autoPlay muted loop playsInline
                  className="absolute inset-0 w-full h-full object-fill opacity-70 group-hover:scale-105 transition-transform duration-1000"
                />
              ) : tile.parsed.type === 'webcam' ? (
                <WebcamPreview deviceIndex={tile.parsed.index} className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/30">
                  <Radio className="w-6 h-6" />
                  <p className="text-[10px] text-center px-6">Camera IP (RTSP) — chưa hỗ trợ xem trước trong trình duyệt. AI vẫn phân tích, xem vi phạm ở trang Vi phạm.</p>
                </div>
              )}

              <div className="absolute inset-0 pointer-events-none">
                {detections.map(d => (
                  <AIDetectionBox key={d.id} detection={d} />
                ))}
              </div>

              <div className="absolute bottom-4 left-6 right-6 flex justify-between items-end z-40">
                <div>
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-tighter">{cam.siteName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <MicButton
                    cameraId={cam.id}
                    mode={voiceMode}
                    hasViolation={hasViolation}
                    onError={(msg) => showNotification('Cảnh báo giọng nói lỗi', msg, 'danger')}
                  />
                  {isDemo && (
                    <button
                      onClick={() => setSelectedCamera({ cam, videoUrl })}
                      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[var(--primary)] backdrop-blur-md flex items-center justify-center text-white transition-all"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
                );
              })}
            </div>
            )}
          </>
        );
      })()}

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[2rem] p-8 mt-4 animate-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse shrink-0" />
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Tổng quan tuân thủ PPE trực tiếp</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl mb-6">
          Số liệu thật từ AI đang phân tích {onlineCameraTiles.length} camera hoạt động — xác minh mũ bảo hộ, áo phản quang và giày bảo hộ theo thời gian thực.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Người trong khung', value: framePersons.length, color: 'primary' },
            { label: 'Đang vi phạm', value: frameViolators.length, color: frameViolators.length > 0 ? 'danger' : 'success' },
            { label: 'Camera giám sát', value: onlineCameraTiles.length, color: 'primary' },
            { label: 'Camera có vi phạm', value: violationCount, color: violationCount > 0 ? 'danger' : 'success' },
          ].map(stat => (
            <div key={stat.label} className="p-4 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
              <p className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">{stat.label}</p>
              <p className={cn(
                "text-2xl font-black",
                stat.color === 'danger' ? 'text-[var(--danger)]' : stat.color === 'success' ? 'text-[var(--success)]' : 'text-[var(--text-primary)]'
              )}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { key: 'helmet', label: 'Thiếu mũ bảo hộ', value: missingPpeCounts.helmet },
            { key: 'gloves', label: 'Thiếu găng tay', value: missingPpeCounts.gloves },
            { key: 'boots', label: 'Thiếu giày bảo hộ', value: missingPpeCounts.boots },
          ].map(item => (
            <div key={item.key} className={cn(
              "flex items-center justify-between p-3 rounded-xl border",
              item.value > 0 ? "bg-[var(--danger-muted)] border-[var(--danger)]/30" : "bg-[var(--background-secondary)] border-[var(--border)]"
            )}>
              <span className="text-xs font-bold text-[var(--text-secondary)]">{item.label}</span>
              <span className={cn("text-sm font-black", item.value > 0 ? "text-[var(--danger)]" : "text-[var(--text-muted)]")}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
