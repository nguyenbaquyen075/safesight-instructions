# SPDX-License-Identifier: MIT
"""DEMO: chạy Roboflow Workflow trên một nguồn video để xem có ỔN ĐỊNH không.

Đây là công cụ ĐO ĐẠC, KHÔNG phải pipeline production. Vòng lặp camera thật vẫn
chạy model local ppe_multiclass.pt (xem yolo_inference.py) — script này chỉ lấy
MẪU vài frame theo nhịp rồi gọi cloud, để trả lời: gọi có trượt không, trễ bao
nhiêu, kết quả có đều không.

⚠️  MỖI FRAME GỬI ĐI = 1 CREDIT Roboflow. Mặc định 20 frame -> 20 credit.

Chạy thử:
    .venv/bin/python ai-engine/demo_roboflow_stream.py                      # video mẫu
    .venv/bin/python ai-engine/demo_roboflow_stream.py --source 0           # webcam
    .venv/bin/python ai-engine/demo_roboflow_stream.py --frames 50 --save-dir /tmp/rf
    .venv/bin/python ai-engine/demo_roboflow_stream.py --source rtsp://...  # camera IP

Thoát 0 nếu mọi lần gọi đều thành công, thoát 1 nếu có lần trượt.
"""

import argparse
import os
import sys
import time
from collections import Counter

import cv2

from roboflow_workflow import RoboflowWorkflowError, detect_ppe

DEFAULT_SOURCE = "public/videos/samples1.mp4"

# Mặc định LƯU ẢNH luôn — mục đích của demo là nhìn ảnh để biết tình trạng, không
# phải xem video. Nằm trong public/snapshots/* nên đã được .gitignore (khỏi lỡ commit)
# mà vẫn mở được qua dashboard tại /snapshots/roboflow/...
# clear_snapshots() của yolo_inference chỉ xoá violation_*.jpg ở thư mục cha nên
# ảnh ở đây không bị dọn nhầm.
DEFAULT_SAVE_DIR = "public/snapshots/roboflow"


def _open_source(source):
    """webcam theo index ("0") hoặc đường dẫn file / URL rtsp — giống quy ước
    rtspUrl trong DB (xem load_real_camera_overrides ở yolo_inference.py).

    Dùng thẳng cv2.VideoCapture thay vì mượn get_video_source() của
    yolo_inference: import module đó kéo theo ultralytics VÀ đăng ký atexit
    clear_snapshots() -> thoát demo sẽ XOÁ ảnh vi phạm thật. Không đáng.
    """
    return cv2.VideoCapture(int(source) if source.isdigit() else source)


def _draw(frame, detections):
    """Khoanh khung + nhãn cho ảnh lưu ra, đọc bbox % giống _bbox_pct()."""
    h, w = frame.shape[:2]
    for d in detections:
        b = d["bbox"]
        x = int(float(b["left"].rstrip("%")) / 100 * w)
        y = int(float(b["top"].rstrip("%")) / 100 * h)
        bw = int(float(b["width"].rstrip("%")) / 100 * w)
        bh = int(float(b["height"].rstrip("%")) / 100 * h)
        cv2.rectangle(frame, (x, y), (x + bw, y + bh), (0, 200, 0), 2)
        cv2.putText(frame, f"{d['class']} {d['confidence']:.2f}", (x, max(y - 8, 18)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 0), 2, cv2.LINE_AA)
    return frame


def _percentile(sorted_values, q):
    """Phân vị đơn giản — statistics.quantiles cần >=2 mẫu, demo có thể chỉ 1."""
    return sorted_values[min(int(q * (len(sorted_values) - 1) + 0.5), len(sorted_values) - 1)]


def run_demo(source=DEFAULT_SOURCE, frames=20, interval=1.0, retries=1,
             save_dir=DEFAULT_SAVE_DIR):
    cap = _open_source(source)
    if not cap.isOpened():
        print(f"❌ Không mở được nguồn '{source}'")
        return 1

    if save_dir:
        os.makedirs(save_dir, exist_ok=True)

    print(f"📹 Nguồn: {source}")
    print(f"🎯 Gửi {frames} frame, cách nhau {interval}s -> tốn ~{frames} credit Roboflow\n")

    latencies, errors, class_counter = [], [], Counter()
    empty_frames = 0

    for i in range(1, frames + 1):
        ok, frame = cap.read()
        if not ok:
            # File hết -> tua lại đầu (giống yolo_inference). Nguồn sống -> chờ frame kế.
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ok, frame = cap.read()
            if not ok:
                print(f"[{i}/{frames}] ⚠️  không đọc được frame, bỏ qua")
                continue

        started = time.monotonic()
        try:
            detections = detect_ppe(frame, retries=retries)
        except RoboflowWorkflowError as e:
            elapsed = (time.monotonic() - started) * 1000
            errors.append(str(e))
            print(f"[{i}/{frames}] ❌ {elapsed:6.0f}ms  {e}")
        else:
            elapsed = (time.monotonic() - started) * 1000
            latencies.append(elapsed)
            classes = Counter(d["class"] for d in detections)
            class_counter.update(classes)
            if not detections:
                empty_frames += 1
            summary = ", ".join(f"{c}×{n}" for c, n in classes.most_common()) or "—"
            print(f"[{i}/{frames}] ✅ {elapsed:6.0f}ms  {len(detections):2d} detection  {summary}")

            if save_dir:
                # Gắn số detection vào tên -> lướt thư mục là biết frame nào bắt được gì,
                # khỏi phải mở từng ảnh.
                path = os.path.join(save_dir, f"rf_{i:03d}_{len(detections)}det.jpg")
                cv2.imwrite(path, _draw(frame.copy(), detections))

        time.sleep(interval)

    cap.release()
    return _report(latencies, errors, class_counter, empty_frames, save_dir)


def _report(latencies, errors, class_counter, empty_frames, save_dir):
    total = len(latencies) + len(errors)
    print("\n" + "─" * 58)
    if not total:
        print("❌ Không gọi được lần nào.")
        return 1

    rate = len(latencies) / total * 100
    print(f"Thành công     : {len(latencies)}/{total}  ({rate:.0f}%)")

    if latencies:
        s = sorted(latencies)
        print(f"Độ trễ (ms)    : min {s[0]:.0f} | trung vị {_percentile(s, 0.5):.0f} "
              f"| p95 {_percentile(s, 0.95):.0f} | max {s[-1]:.0f}")
        print(f"Tốc độ thực tế : ~{1000 / (sum(s) / len(s)):.2f} lần gọi/giây "
              f"(1 luồng, chưa tính nhịp chờ)")
        print(f"Frame trắng    : {empty_frames} (không có detection nào)")
        print(f"Lớp bắt được   : "
              f"{', '.join(f'{c}×{n}' for c, n in class_counter.most_common()) or '—'}")

    if errors:
        print(f"\n⚠️  {len(errors)} lần trượt:")
        for msg, n in Counter(errors).most_common():
            print(f"   ×{n}  {msg[:110]}")

    if save_dir:
        print(f"\n🖼️  Ảnh đã khoanh khung: {save_dir}/")

    print("─" * 58)
    if errors:
        print("KẾT LUẬN: CHƯA ổn định — xem lỗi ở trên trước khi tin dùng.")
        return 1
    print("KẾT LUẬN: Ổn định trong lần chạy này.")
    return 0


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--source", default=DEFAULT_SOURCE,
                   help='file mp4, index webcam ("0"), hoặc rtsp://... (mặc định: video mẫu)')
    p.add_argument("--frames", type=int, default=20, help="số frame gửi đi = số credit (mặc định 20)")
    p.add_argument("--interval", type=float, default=1.0, help="giây chờ giữa 2 lần gọi (mặc định 1.0)")
    p.add_argument("--retries", type=int, default=1, help="số lần thử lại mỗi frame (mặc định 1)")
    p.add_argument("--save-dir", default=DEFAULT_SAVE_DIR,
                   help=f"thư mục lưu ảnh đã khoanh khung (mặc định {DEFAULT_SAVE_DIR}, "
                        'truyền "" để không lưu)')
    args = p.parse_args()
    return run_demo(args.source, args.frames, args.interval, args.retries, args.save_dir)


if __name__ == "__main__":
    sys.exit(main())
