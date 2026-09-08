# SPDX-License-Identifier: MIT
"""Clip bằng chứng ngắn cho mỗi vi phạm đã chốt.

Một clip = 20 khung TRƯỚC lúc chốt (giữ sẵn trong FrameRing) + 12 khung SAU
(ghi dần ở các vòng lặp kế tiếp). Ở 4 fps là khoảng 8 giây, đủ để người quản lý
thấy bối cảnh trước/sau thay vì một tấm ảnh đứng yên.

FrameRing và PendingClip KHÔNG dùng cv2 (chỉ giữ tham chiếu khung + đếm) nên
`python3 -m unittest ai-engine/test_clips.py` chạy được bằng python hệ thống.
Chỉ ClipWriter mới cần cv2, và nó import lúc khởi tạo.
"""

from collections import deque

CLIP_FPS = 4
FRAMES_BEFORE = 20
FRAMES_AFTER = 12


class FrameRing:
    """Giữ N khung gần nhất của một luồng để làm phần đầu của clip.

    ponytail: giữ nguyên khung gốc -> 20 khung 720p ≈ 55MB mỗi luồng. Nếu chạy
    nhiều luồng độ phân giải cao thì thu nhỏ khung trước khi push (clip bằng
    chứng không cần nét bằng ảnh snapshot).
    """

    def __init__(self, maxlen=FRAMES_BEFORE):
        self._frames = deque(maxlen=maxlen)

    def push(self, frame):
        self._frames.append(frame)

    def snapshot(self):
        """Bản chụp danh sách khung hiện có — push tiếp không đụng vào bản này."""
        return list(self._frames)


class ClipWriter:
    """Bọc cv2.VideoWriter để phần còn lại của module không phụ thuộc cv2."""

    def __init__(self, path, size, fps=CLIP_FPS):
        import cv2
        self._writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), fps, size)

    def write(self, frame):
        self._writer.write(frame)

    def close(self):
        self._writer.release()


class PendingClip:
    """Clip đã ghi phần đầu, còn chờ `remaining_after` khung nữa rồi đóng."""

    def __init__(self, writer, remaining_after=FRAMES_AFTER):
        self.writer = writer
        self.remaining = remaining_after
        self.closed = False

    def feed(self, frame):
        """Ghi thêm một khung. Trả True khi clip đã đủ khung và đã đóng."""
        if self.remaining > 0:
            self.writer.write(frame)
            self.remaining -= 1
        if not self.closed and self.remaining <= 0:
            self.writer.close()
            self.closed = True
        return self.closed


def start_clip(path, frames, fps=CLIP_FPS, remaining_after=FRAMES_AFTER):
    """Mở clip tại `path`, ghi ngay các khung trước vi phạm, trả PendingClip.

    Trả None khi chưa có khung nào (không suy ra được kích thước video).
    """
    if not frames:
        return None
    height, width = frames[0].shape[:2]
    writer = ClipWriter(path, (width, height), fps)
    for frame in frames:
        writer.write(frame)
    return PendingClip(writer, remaining_after)
