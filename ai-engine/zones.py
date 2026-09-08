# SPDX-License-Identifier: MIT
"""Hình học vùng nhận diện (Zone/ROI) theo camera.

Tách riêng khỏi ppe_tracker.py để test chạy được bằng `python3 -m unittest` mà
KHÔNG cần torch/cv2/numpy — chỉ dùng thư viện chuẩn.

Toạ độ vùng là TỈ LỆ 0–1 theo khung hình (không phải pixel) nên đổi độ phân giải
camera vẫn dùng lại được vùng đã vẽ trên web.
"""

import json


def parse_polygon(raw):
    """Zone.polygonData ('[{"x":0.1,"y":0.2}, ...]') -> [(x, y), ...].

    Trả None khi chuỗi hỏng hoặc chưa đủ 3 điểm — vùng như vậy coi như không có,
    engine sẽ xét cả khung thay vì lọc theo một đa giác vô nghĩa.
    """
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if not isinstance(data, list) or len(data) < 3:
        return None
    points = []
    for p in data:
        try:
            points.append((float(p["x"]), float(p["y"])))
        except (TypeError, KeyError, IndexError, ValueError):
            return None
    return points


def point_in_polygon(x, y, polygon):
    """Ray casting: bắn tia ngang sang phải từ (x, y), số cạnh cắt lẻ = nằm trong."""
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        # Chỉ xét cạnh bắc qua đường y (dùng > cho cả hai đầu -> đỉnh không bị đếm 2 lần)
        if (y1 > y) != (y2 > y):
            x_cat = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < x_cat:
                inside = not inside
    return inside


def foot_point(box, width, height):
    """Điểm CHÂN của người = giữa cạnh dưới bbox, đổi từ pixel sang tỉ lệ 0–1.

    Lấy điểm chân chứ không lấy tâm bbox: người đứng ở mép vùng thì phần thân
    trên hay tràn ra ngoài, nhưng chỗ họ ĐANG ĐỨNG mới quyết định thuộc vùng nào.
    """
    x1, _, x2, y2 = box
    return ((x1 + x2) / 2.0 / width, y2 / float(height))


def filter_persons_in_zones(persons, zones, width, height):
    """Giữ lại người có điểm chân nằm trong ít nhất một vùng.

    zones rỗng/None = camera chưa khai vùng nào -> giữ nguyên cả khung.
    """
    if not zones:
        return persons
    kept = []
    for p in persons:
        x, y = foot_point(p['box'], width, height)
        if any(point_in_polygon(x, y, z) for z in zones):
            kept.append(p)
    return kept
