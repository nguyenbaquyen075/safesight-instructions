# SPDX-License-Identifier: MIT
"""python3 -m unittest ai-engine/test_clips.py — không cần torch/cv2."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from clips import FrameRing, PendingClip


class FakeWriter:
    """Thay cv2.VideoWriter trong test: chỉ đếm khung đã ghi và lần đóng."""

    def __init__(self):
        self.frames = []
        self.closed = 0

    def write(self, frame):
        self.frames.append(frame)

    def close(self):
        self.closed += 1


class FrameRingTest(unittest.TestCase):
    def test_an_empty_ring_has_no_frames(self):
        self.assertEqual(FrameRing().snapshot(), [])

    def test_the_ring_keeps_only_the_last_twenty_frames_in_order(self):
        ring = FrameRing()
        for i in range(25):
            ring.push(i)
        self.assertEqual(ring.snapshot(), list(range(5, 25)))

    def test_the_ring_length_is_configurable(self):
        ring = FrameRing(maxlen=3)
        for i in range(5):
            ring.push(i)
        self.assertEqual(ring.snapshot(), [2, 3, 4])

    def test_the_snapshot_is_a_copy_so_later_frames_do_not_change_it(self):
        ring = FrameRing(maxlen=2)
        ring.push("a")
        taken = ring.snapshot()
        ring.push("b")
        ring.push("c")
        self.assertEqual(taken, ["a"])


class PendingClipTest(unittest.TestCase):
    def test_each_frame_counts_down_and_the_clip_closes_on_the_last_one(self):
        writer = FakeWriter()
        pending = PendingClip(writer, remaining_after=3)
        self.assertFalse(pending.feed("f1"))
        self.assertFalse(pending.feed("f2"))
        self.assertTrue(pending.feed("f3"))
        self.assertEqual(writer.frames, ["f1", "f2", "f3"])
        self.assertEqual(writer.closed, 1)

    def test_feeding_a_finished_clip_writes_nothing_and_does_not_close_twice(self):
        writer = FakeWriter()
        pending = PendingClip(writer, remaining_after=1)
        self.assertTrue(pending.feed("f1"))
        self.assertTrue(pending.feed("f2"))
        self.assertEqual(writer.frames, ["f1"])
        self.assertEqual(writer.closed, 1)

    def test_a_clip_without_frames_after_closes_immediately(self):
        writer = FakeWriter()
        self.assertTrue(PendingClip(writer, remaining_after=0).feed("f1"))
        self.assertEqual(writer.frames, [])
        self.assertEqual(writer.closed, 1)


if __name__ == "__main__":
    unittest.main()
