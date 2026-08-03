'use client';
// SPDX-License-Identifier: MIT


import { Camera as CameraIcon, Activity, AlertTriangle, WifiOff, Settings2, Maximize2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CameraStatus } from '@/types/enums';
import type { Camera } from '@/types/models';
import { useYolo } from '@/hooks/useYolo';

interface CameraCardProps {
  camera: Camera;
}

export function CameraCard({ camera }: CameraCardProps) {
  const { getDetectionsForCamera } = useYolo(camera.id);
  const detections = getDetectionsForCamera(camera.id);
  
  const isOnline = camera.status === CameraStatus.ONLINE;
  const isDegraded = camera.status === CameraStatus.DEGRADED;
  const isOffline = camera.status === CameraStatus.OFFLINE;

  return (
    <div className="group relative overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border)] transition-all duration-300 hover:border-[var(--primary)]/50 hover:shadow-xl animate-fade-up">
      {/* Thumbnail / Live Preview Area */}
      <div className="relative aspect-video bg-black overflow-hidden">
        {camera.videoUrl ? (
          <video
            src={camera.videoUrl}
            autoPlay
            muted
            loop
            playsInline
            className={cn(
              "w-full h-full object-cover transition-transform duration-700 group-hover:scale-105",
              isOffline && "grayscale opacity-50"
            )}
          />
        ) : camera.thumbnailUrl ? (
          <img
            src={camera.thumbnailUrl}
            alt={camera.name}
            className={cn(
              "w-full h-full object-cover transition-transform duration-700 group-hover:scale-105",
              isOffline && "grayscale opacity-50"
            )}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)]">
            <CameraIcon className="w-12 h-12 mb-2 opacity-20" />
            <span className="text-xs">No Signal</span>
          </div>
        )}

        {/* Detection Boxes Overlay */}
        {isOnline && detections.map((det) => (
          <div
            key={det.id}
            className={cn(
              "absolute border-2 rounded-sm transition-all duration-300 pointer-events-none",
              det.isViolation 
                ? "border-red-500 bg-red-500/10" 
                : "border-emerald-500 bg-emerald-500/10"
            )}
            style={{
              top: det.bbox.top,
              left: det.bbox.left,
              width: det.bbox.width,
              height: det.bbox.height,
              zIndex: 10
            }}
          >
            {/* Label Badge */}
            <div className={cn(
              "absolute -top-6 left-0 px-2 py-0.5 rounded text-[9px] font-black whitespace-nowrap flex items-center gap-1 shadow-lg",
              det.isViolation ? "bg-red-500 text-white" : "bg-emerald-500 text-white"
            )}>
              {det.isViolation ? <ShieldAlert className="w-2.5 h-2.5" /> : <ShieldCheck className="w-2.5 h-2.5" />}
              {det.label.toUpperCase()}
              <span className="opacity-70 ml-1">{(det.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}

        {/* Status Overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md border",
            isOnline ? "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/30" :
            isDegraded ? "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/30" :
            "bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/30"
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              isOnline ? "bg-[var(--success)] animate-pulse-live" :
              isDegraded ? "bg-[var(--warning)]" :
              "bg-[var(--danger)]"
            )} />
            {isOnline ? "TRỰC TUYẾN" : 
             isDegraded ? "SUY GIẢM" : 
             isOffline ? "NGOẠI TUYẾN" : "BẢO TRÌ"}
          </div>
          
          {isOnline && (
            <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-black/40 text-white backdrop-blur-md border border-white/10">
              {camera.fps} FPS
            </div>
          )}
        </div>

        {/* Actions Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button className="p-2.5 rounded-full bg-white/10 hover:bg-[var(--primary)] text-white backdrop-blur-md transition-all border border-white/20 transform translate-y-4 group-hover:translate-y-0 duration-300">
            <Maximize2 className="w-5 h-5" />
          </button>
          <button className="p-2.5 rounded-full bg-white/10 hover:bg-[var(--primary)] text-white backdrop-blur-md transition-all border border-white/20 transform translate-y-4 group-hover:translate-y-0 duration-300 delay-75">
            <Settings2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Info Area */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--primary-light)] transition-colors line-clamp-1">
              {camera.name}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
              <Activity className="w-3 h-3" />
              {camera.siteName} • {camera.location}
            </p>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] text-right">
            ID: {camera.id.split('-')[1]}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/50">
          <div className="flex items-center gap-2">
            {isOnline ? (
               <div className="flex -space-x-1">
                  {[1,2].map(i => (
                    <div key={i} className="w-5 h-5 rounded-full bg-[var(--primary-muted)] border border-[var(--surface)] flex items-center justify-center">
                       <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                    </div>
                  ))}
               </div>
            ) : (
               < WifiOff className="w-4 h-4 text-[var(--text-muted)]" />
            )}
            <span className="text-[10px] text-[var(--text-muted)] font-medium">
              {isOnline ? "A.I. Hoạt động" : "A.I. Tạm dừng"}
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">
            {camera.resolution}
          </span>
        </div>
      </div>
    </div>
  );
}
