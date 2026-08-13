# SPDX-License-Identifier: MIT
"""Check nhanh logic rẽ nhánh của get_video_source() — không mở webcam/mạng thật.

Chạy: python3 ai-engine/test_video_source.py
"""

from unittest.mock import MagicMock, patch

from yolo_inference import get_video_source, RTSPStream


def demo():
    with patch("yolo_inference.cv2.VideoCapture", return_value=MagicMock()) as fake_cv2_cap, \
         patch.object(RTSPStream, "__init__", return_value=None) as fake_rtsp_init:

        # rtsp:// -> phải đi qua RTSPStream, KHÔNG gọi cv2.VideoCapture trực tiếp
        result = get_video_source("rtsp://admin:pass@192.168.1.64:554/stream1")
        assert isinstance(result, RTSPStream), "chuỗi rtsp:// phải trả về RTSPStream"
        assert fake_rtsp_init.called, "RTSPStream(url) phải được gọi cho nguồn rtsp"
        assert not fake_cv2_cap.called, "rtsp:// không được mở thẳng bằng cv2.VideoCapture"

        # webcam theo index (số) -> cv2.VideoCapture(index), KHÔNG qua RTSPStream
        fake_cv2_cap.reset_mock()
        fake_rtsp_init.reset_mock()
        result = get_video_source(0)
        assert not isinstance(result, RTSPStream), "webcam index không được đi qua RTSPStream"
        fake_cv2_cap.assert_called_once_with(0)

        # đường dẫn file mp4 -> cv2.VideoCapture(path), giữ nguyên hành vi cũ
        fake_cv2_cap.reset_mock()
        result = get_video_source("public/videos/test1.mp4")
        assert not isinstance(result, RTSPStream)
        fake_cv2_cap.assert_called_once_with("public/videos/test1.mp4")

    print("OK: get_video_source() rẽ nhánh đúng cho rtsp / webcam / file.")


if __name__ == "__main__":
    demo()
