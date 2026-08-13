'use client';
// SPDX-License-Identifier: MIT

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useSites } from '@/hooks/use-sites';
import { useCreateCamera, useUpdateCamera } from '@/hooks/use-cameras';
import { parseCameraSource } from '@/lib/camera-source';
import { mockCameras } from '@/data/mock-cameras';
import { CameraStatus } from '@/types/enums';
import type { Camera } from '@/types/models';

interface CameraEditDialogProps {
  camera: Camera | null;
  isOpen: boolean;
  onClose: () => void;
}

const CAMERA_TYPES: Camera['type'][] = ['fixed', 'ptz', 'dome', 'bullet'];

const EMPTY_FORM = {
  name: '',
  siteId: '',
  location: '',
  type: 'fixed' as Camera['type'],
  sourceKind: 'webcam' as 'webcam' | 'rtsp',
  webcamIndex: '0',
  rtspUrl: '',
  status: CameraStatus.OFFLINE as string,
};

export function CameraEditDialog({ camera, isOpen, onClose }: CameraEditDialogProps) {
  const { data: sites } = useSites();
  const [form, setForm] = useState(EMPTY_FORM);
  const [webcams, setWebcams] = useState<MediaDeviceInfo[] | null>(null);
  const createCamera = useCreateCamera();
  const updateCamera = useUpdateCamera();
  const isDemo = !!camera && mockCameras.some((m) => m.id === camera.id);

  // Liệt kê webcam THẬT của máy đang mở trình duyệt này — để chọn đúng thiết bị
  // thay vì đoán số (số webcam bên trình duyệt và bên AI engine/OpenCV thường
  // khớp thứ tự nhau trên cùng 1 máy, nhưng không đảm bảo 100% giữa mọi hệ điều hành).
  useEffect(() => {
    if (!isOpen || isDemo) return;
    let cancelled = false;
    (async () => {
      try {
        // Cần xin quyền 1 lần thì enumerateDevices() mới trả tên thiết bị đầy đủ.
        const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
        tmp.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        if (cancelled) return;
        setWebcams(videoInputs);
        // Index cũ đã lưu không còn khớp máy này (VD chỉ còn 1 webcam nhưng đang
        // lưu index 1) -> tự sửa về 0 để khỏi lưu nhầm 1 index không tồn tại.
        setForm((f) => (Number(f.webcamIndex) < videoInputs.length ? f : { ...f, webcamIndex: '0' }));
      } catch {
        if (!cancelled) setWebcams([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, isDemo]);

  useEffect(() => {
    if (!isOpen) return;
    if (!camera) {
      setForm({ ...EMPTY_FORM, siteId: sites?.[0]?.id ?? '' });
      return;
    }
    const parsed = parseCameraSource(camera.rtspUrl);
    setForm({
      name: camera.name,
      siteId: camera.siteId,
      location: camera.location,
      type: camera.type,
      sourceKind: parsed.type === 'rtsp' ? 'rtsp' : 'webcam',
      webcamIndex: parsed.type === 'webcam' ? String(parsed.index) : '0',
      rtspUrl: parsed.type === 'rtsp' ? parsed.url : '',
      status: camera.status,
    });
  }, [isOpen, camera, sites]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Nhập tên camera', 'error'); return; }
    if (!form.siteId) { toast('Chọn công trình', 'error'); return; }
    if (!form.location.trim()) { toast('Nhập vị trí lắp đặt', 'error'); return; }
    if (!isDemo && form.sourceKind === 'rtsp' && !form.rtspUrl.trim().startsWith('rtsp://')) {
      toast('URL RTSP phải bắt đầu bằng rtsp://', 'error');
      return;
    }

    const source = form.sourceKind === 'webcam'
      ? `webcam:${Math.max(0, Number(form.webcamIndex) || 0)}`
      : form.rtspUrl.trim();

    try {
      if (camera) {
        await updateCamera.mutateAsync({
          id: camera.id,
          data: { name: form.name, location: form.location, type: form.type, status: form.status, ...(isDemo ? {} : { source }) },
        });
      } else {
        await createCamera.mutateAsync({ name: form.name, siteId: form.siteId, location: form.location, type: form.type, source });
      }
      toast(
        isDemo
          ? 'Đã lưu thông tin camera mẫu'
          : 'Đã lưu camera — khởi động lại hệ thống (npm run dev) để AI engine nhận nguồn mới',
        'success'
      );
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Lưu camera thất bại', 'error');
    }
  };

  const isSaving = createCamera.isPending || updateCamera.isPending;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl rounded-xl max-h-[85vh] overflow-y-auto">
          <Dialog.Title className="text-lg font-bold text-[var(--text-primary)]">
            {isDemo ? 'Sửa camera mẫu (demo)' : camera ? 'Sửa camera' : 'Thêm camera'}
          </Dialog.Title>
          <Dialog.Description className="text-sm text-[var(--text-muted)]">
            {isDemo
              ? 'Camera mẫu dùng sẵn video demo cố định — sửa được tên/vị trí/loại/trạng thái, không đổi được nguồn video.'
              : 'Kết nối webcam để test, hoặc camera IP thật qua RTSP khi triển khai công trường.'}
          </Dialog.Description>

          <div className="grid gap-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Tên camera</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Webcam laptop test"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Công trình</label>
                <select
                  value={form.siteId}
                  onChange={(e) => setForm({ ...form, siteId: e.target.value })}
                  disabled={isDemo}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none disabled:opacity-50"
                >
                  <option value="" disabled>Chọn công trình...</option>
                  {sites?.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Loại camera</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as Camera['type'] })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                >
                  {CAMERA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--text-secondary)]">Vị trí lắp đặt</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="VD: Cổng chính"
                className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
              />
            </div>

            {isDemo ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Nguồn video</label>
                <p className="text-xs text-[var(--text-muted)] px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
                  Video mẫu cố định — không đổi được. Muốn dùng webcam/camera thật, bấm "Thêm camera" để tạo camera mới.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Nguồn video</label>
                <div className="flex gap-1.5">
                  {(['webcam', 'rtsp'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setForm({ ...form, sourceKind: kind })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg border text-[11px] font-medium",
                        form.sourceKind === kind
                          ? "bg-[var(--primary-muted)] border-[var(--primary)] text-[var(--primary-light)]"
                          : "bg-[var(--background)] border-[var(--border)] text-[var(--text-secondary)]"
                      )}
                    >
                      {kind === 'webcam' ? 'Webcam' : 'Camera IP (RTSP)'}
                    </button>
                  ))}
                </div>

                {form.sourceKind === 'webcam' ? (
                  <div className="space-y-1.5">
                    {webcams === null ? (
                      <p className="text-xs text-[var(--text-muted)] px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
                        Đang dò webcam của máy này — trình duyệt sẽ hỏi xin quyền Camera...
                      </p>
                    ) : webcams.length === 0 ? (
                      <p className="text-xs text-[var(--danger)] px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)]">
                        Không dò được webcam nào (chưa cấp quyền Camera cho trình duyệt, hoặc máy này không có webcam).
                      </p>
                    ) : (
                      <select
                        value={form.webcamIndex}
                        onChange={(e) => setForm({ ...form, webcamIndex: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                      >
                        {webcams.map((d, i) => (
                          <option key={d.deviceId || i} value={i}>{d.label || `Webcam #${i}`}</option>
                        ))}
                      </select>
                    )}
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Danh sách webcam THẬT dò được ngay trên máy đang mở trang này — chọn đúng camera cần dùng.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      value={form.rtspUrl}
                      onChange={(e) => setForm({ ...form, rtspUrl: e.target.value })}
                      placeholder="rtsp://user:pass@192.168.1.64:554/Streaming/Channels/101"
                      className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none font-mono"
                    />
                    <p className="text-[10px] text-[var(--text-muted)]">
                      Hikvision/Dahua/Tapo/ONVIF mỗi hãng 1 định dạng URL khác nhau — xem tài liệu hãng camera.
                    </p>
                  </div>
                )}
              </div>
            )}

            {camera && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Trạng thái</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--background-secondary)] border border-[var(--border)] text-sm outline-none"
                >
                  {Object.values(CameraStatus).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {isDemo
                    ? 'Đổi khác "online" để ẩn camera này khỏi lưới xem trực tiếp ở trang Camera.'
                    : 'Đổi khác "online" để ĐÓNG camera này — AI ngừng phân tích và ẩn khỏi lưới xem trực tiếp. Cần khởi động lại hệ thống (npm run dev) để có tác dụng.'}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm font-medium hover:bg-[var(--surface-hover)]">
              Huỷ
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-bold hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              Lưu
            </button>
          </div>

          <Dialog.Close className="absolute right-4 top-4">
            <X className="h-4 w-4 text-[var(--text-muted)]" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
