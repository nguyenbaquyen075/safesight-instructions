# Voice Alert (Mic → Loa) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mic button to violating camera cards on `/cameras` that records a short voice clip and either plays it back locally (Demo mode) or broadcasts it via Socket.IO to a new `/site-speaker` receiver page (Thật mode).

**Architecture:** Browser `MediaRecorder`/`getUserMedia` records audio client-side. Demo mode plays the resulting `Blob` back immediately with the Web Audio `Audio` element. Thật mode ships the `Blob` as an `ArrayBuffer` over a new `voice-broadcast` Socket.IO event; `ai-engine/yolo_bridge.js` relays it to the existing per-camera room (`camera-${cameraId}`, already used for `yolo-data`); a new `/site-speaker` page joins that room and plays whatever it receives.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React client components, socket.io-client 4.8 (already a dependency), lucide-react icons (already a dependency), browser `MediaRecorder`/`getUserMedia` (native, no new dependency).

## Global Constraints

- No new npm dependencies — everything needed (socket.io-client, lucide-react) is already installed.
- Spec: `docs/superpowers/specs/2026-08-05-voice-alert-design.md` — no recording history/persistence, no continuous walkie-talkie streaming, one recording capped at 30s.
- This repo has **no automated test runner** (no jest/vitest/testing-library in `package.json`). Every other page in this codebase is verified manually in the browser. This plan follows that existing pattern: each task's verification step is a manual browser check, not an automated test run. Do not add a test framework as part of this plan — that would be a new, unrequested dependency.
- All new UI text is Vietnamese, matching the rest of the app (see any existing string in `src/app/(dashboard)/cameras/page.tsx` for tone/casing conventions).
- `NEXT_PUBLIC_YOLO_SERVER_URL` (from `.env.local`) is the Socket.IO bridge URL already used by `useYolo` — reuse the same env var, don't hardcode a URL.

---

### Task 1: Recording + Demo playback on the cameras page

**Files:**
- Create: `src/hooks/useVoiceRecorder.ts`
- Create: `src/components/cameras/MicButton.tsx`
- Modify: `src/app/(dashboard)/cameras/page.tsx` (state + toggle UI near the existing violation filter button added at lines ~424-442, and render `MicButton` inside the camera card loop added at lines ~450-489)

**Interfaces:**
- Produces (used by Task 2 too): `useVoiceRecorder(): { isRecording: boolean; error: string | null; start: () => Promise<void>; stop: () => Promise<Blob | null> }`
- Produces (used by Task 2): `MicButton({ cameraId: string; mode: 'demo' | 'broadcast' }): JSX.Element`
- Consumes: `hasViolation` boolean already computed per-camera in `src/app/(dashboard)/cameras/page.tsx` (see the `onlineCameras` array built inside the `(() => { ... })()` IIFE that also holds the violation filter — added when the camera filter feature was built).

- [ ] **Step 1: Create `useVoiceRecorder` hook**

Create `src/hooks/useVoiceRecorder.ts`:

```ts
// SPDX-License-Identifier: MIT

import { useCallback, useRef, useState } from 'react';

const MAX_RECORDING_MS = 30_000; // tự dừng sau 30s phòng quên bấm dừng

export interface UseVoiceRecorderResult {
  isRecording: boolean;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<Blob | null>;
}

export function useVoiceRecorder(): UseVoiceRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopResolveRef = useRef<((blob: Blob | null) => void) | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      stopResolveRef.current = resolve;
      recorder.stop();
    });
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
        stopResolveRef.current?.(blob);
        stopResolveRef.current = null;
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

  return { isRecording, error, start, stop };
}
```

- [ ] **Step 2: Create `MicButton` component**

Create `src/components/cameras/MicButton.tsx`:

```tsx
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
```

- [ ] **Step 3: Wire the mode toggle and `MicButton` into the cameras page**

In `src/app/(dashboard)/cameras/page.tsx`:

1. Add the import near the other local imports:

```tsx
import { MicButton } from '@/components/cameras/MicButton';
```

2. Add state next to `showViolationsOnly` (find `const [showViolationsOnly, setShowViolationsOnly] = React.useState(false);`):

```tsx
const [voiceMode, setVoiceMode] = React.useState<'demo' | 'broadcast'>('demo');
```

3. In the filter toggle row (the `<div className="flex items-center gap-3">` that holds the "Lọc: chỉ vi phạm" button), add a second control right after the existing `{showViolationsOnly && (...)}` block:

```tsx
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
```

4. Inside the camera card loop (`visibleCameras.map(({ cam, detections, hasViolation, videoUrl }, idx) => (`), find the bottom action row:

```tsx
<div className="absolute bottom-4 left-6 right-6 flex justify-between items-end z-40">
  <div>
    <p className="text-[10px] font-bold text-white/60 uppercase tracking-tighter">{cam.siteName}</p>
  </div>
  <button
    onClick={() => setSelectedCamera({ cam, videoUrl })}
    className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[var(--primary)] backdrop-blur-md flex items-center justify-center text-white transition-all"
  >
    <Maximize2 className="w-4 h-4" />
  </button>
</div>
```

Replace the right-hand button group so it also renders `MicButton` when that card `hasViolation`:

```tsx
<div className="absolute bottom-4 left-6 right-6 flex justify-between items-end z-40">
  <div>
    <p className="text-[10px] font-bold text-white/60 uppercase tracking-tighter">{cam.siteName}</p>
  </div>
  <div className="flex items-center gap-2">
    {hasViolation && <MicButton cameraId={cam.id} mode={voiceMode} />}
    <button
      onClick={() => setSelectedCamera({ cam, videoUrl })}
      className="w-8 h-8 rounded-lg bg-white/10 hover:bg-[var(--primary)] backdrop-blur-md flex items-center justify-center text-white transition-all"
    >
      <Maximize2 className="w-4 h-4" />
    </button>
  </div>
</div>
```

- [ ] **Step 4: Manual verification (demo mode)**

Run: `npm run dev` (kills stale ports and starts frontend + bridge + YOLO per `dev-all.sh`), then open `http://localhost:3000/cameras`, log in if prompted.

Expected:
- Mode toggle shows "Mic: Demo" selected by default.
- Any camera card with a red border (violation) shows a mic icon next to the expand button; cards without a violation do not.
- Click the mic icon → it turns red and pulses. Speak. Click again → icon returns to normal and you hear your own voice played back through your computer's speakers within ~1 second.
- In Chrome, deny the mic permission prompt (test via `chrome://settings/content/microphone` or the site's per-page permission icon) → mic icon becomes a crossed-out `MicOff` icon with a tooltip explaining the missing permission; no crash, no red console error boundary.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useVoiceRecorder.ts src/components/cameras/MicButton.tsx "src/app/(dashboard)/cameras/page.tsx"
git commit -m "feat(cameras): add mic button with demo record/playback on violating cameras"
```

---

### Task 2: Broadcast relay + Site Speaker receiver page

**Files:**
- Modify: `ai-engine/yolo_bridge.js` (add `voice-broadcast` relay inside the existing `io.on('connection', ...)` handler)
- Create: `src/app/(dashboard)/site-speaker/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (add nav entry)

**Interfaces:**
- Consumes: `MicButton`'s `mode="broadcast"` path (Task 1) emits `socket.emit('voice-broadcast', { cameraId: string, mimeType: string, audio: ArrayBuffer })` to `NEXT_PUBLIC_YOLO_SERVER_URL`.
- Produces: bridge relays that same payload shape to room `camera-${cameraId}` — this is what the new `/site-speaker` page listens for.

- [ ] **Step 1: Add the relay handler to the YOLO bridge**

In `ai-engine/yolo_bridge.js`, inside the existing `io.on('connection', (socket) => { ... })` block (which already has `subscribe-camera` and `subscribe-all` handlers), add:

```js
  socket.on('voice-broadcast', ({ cameraId, audio, mimeType }) => {
    io.to(`camera-${cameraId}`).emit('voice-broadcast', { cameraId, audio, mimeType });
  });
```

Place it right after the existing `socket.on('subscribe-all', ...)` handler, still inside the same `io.on('connection', ...)` callback.

- [ ] **Step 2: Create the Site Speaker receiver page**

Create `src/app/(dashboard)/site-speaker/page.tsx`:

```tsx
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
```

- [ ] **Step 3: Add the nav link**

In `src/components/layout/Sidebar.tsx`:

1. Add `Volume2` to the `lucide-react` import list (find the existing multi-line import from `'lucide-react'`).
2. In the `navItems` array, add a new entry right after the `Camera` entry:

```tsx
{ label: 'Loa công trường', href: '/site-speaker', icon: Volume2 },
```

- [ ] **Step 4: Manual verification (broadcast mode, two tabs)**

Run: `npm run dev` if not already running (it restarts the bridge along with everything else, picking up the Step 1 change).

Expected, using two browser tabs (or two devices on the same LAN):
- Tab A: `http://localhost:3000/site-speaker` → select the same camera that has an active violation in Tab B (e.g. "Cổng chính - Entrance A"). Status shows "Đã kết nối — sẵn sàng nhận cảnh báo".
- Tab B: `http://localhost:3000/cameras` → switch the mic mode toggle to "Mic: Thật" → click the mic icon on that camera's card, speak, click again to stop.
- Tab A plays the recorded clip within ~1 second and updates "Vừa phát lúc HH:MM:SS".
- Selecting a *different* camera in Tab A and repeating the broadcast on the original camera in Tab B → Tab A does **not** play anything (room isolation works).
- Sidebar shows a "Loa công trường" entry with a speaker icon between "Camera" and "Thông báo".

- [ ] **Step 5: Commit**

```bash
git add ai-engine/yolo_bridge.js "src/app/(dashboard)/site-speaker/page.tsx" src/components/layout/Sidebar.tsx
git commit -m "feat(site-speaker): relay voice broadcasts to a per-camera speaker page"
```
