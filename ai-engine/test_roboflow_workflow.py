# SPDX-License-Identifier: MIT
"""Smoke test cho roboflow_workflow.detect_ppe() — GỌI MẠNG THẬT (tốn 1 credit).

Cần ROBOFLOW_API_KEY trong .env.local. Lấy 1 frame từ video mẫu có sẵn trong
repo làm ảnh đầu vào, nên không phải commit thêm ảnh test.

Chạy: .venv/bin/python ai-engine/test_roboflow_workflow.py
"""

import cv2

from roboflow_workflow import (OUTPUT_NAME, RoboflowWorkflowError,
                               _parse_detections, detect_ppe)

# Video ĐÃ commit trong repo -> test chạy được ngay sau khi clone, khỏi thêm ảnh mẫu.
SAMPLE_VIDEO = "public/videos/samples1.mp4"


def demo():
    # 1) Parse offline: đúng key output thật của workflow, bbox quy về % như ppe_tracker.
    entry = {OUTPUT_NAME: {
        "image": {"width": 1000, "height": 500},
        "predictions": [{"x": 500.0, "y": 250.0, "width": 100.0, "height": 50.0,
                         "confidence": 0.9, "class": "Person",
                         "detection_id": "bỏ-qua", "parent_id": "image"}],
    }}
    parsed = _parse_detections(entry)
    assert len(parsed) == 1, "1 prediction vào -> 1 detection ra"
    assert parsed[0]["class"] == "Person"
    assert parsed[0]["bbox"] == {"left": "45.0%", "top": "45.0%",
                                 "width": "10.0%", "height": "10.0%"}, parsed[0]["bbox"]
    assert "detection_id" not in parsed[0], "field không dùng phải bị loại cho payload nhẹ"

    # 1b) Frame KHÔNG detect được gì: Roboflow trả image {"width": null, "height": null}.
    # Phải coi là list rỗng, KHÔNG phải lỗi (nếu không mọi frame trắng bị tính là gọi hụt).
    empty = {OUTPUT_NAME: {"image": {"width": None, "height": None}, "predictions": []}}
    assert _parse_detections(empty) == [], "frame không có detection phải trả list rỗng"

    # Ngược lại: CÓ prediction mà thiếu kích thước ảnh -> thật sự không quy đổi được bbox.
    broken = {OUTPUT_NAME: {"image": {"width": None, "height": None},
                            "predictions": [{"x": 1, "y": 1, "width": 1, "height": 1}]}}
    try:
        _parse_detections(broken)
        raise AssertionError("thiếu kích thước ảnh mà có prediction thì phải raise")
    except RoboflowWorkflowError:
        pass

    # 2) Gọi thật 1 lần trên frame lấy từ video mẫu.
    cap = cv2.VideoCapture(SAMPLE_VIDEO)
    cap.set(cv2.CAP_PROP_POS_FRAMES, 30)
    ok, frame = cap.read()
    cap.release()
    assert ok, f"không đọc được frame từ {SAMPLE_VIDEO}"

    detections = detect_ppe(frame)
    assert isinstance(detections, list), "detect_ppe phải trả về list"
    for d in detections:
        assert {"class", "confidence", "bbox"} <= set(d), f"thiếu key trong {d}"
        assert set(d["bbox"]) == {"left", "top", "width", "height"}

    print(f"OK: workflow trả {len(detections)} detection — "
          f"{sorted({d['class'] for d in detections})}")


if __name__ == "__main__":
    demo()
