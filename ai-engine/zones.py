# SPDX-License-Identifier: MIT
"""Hình học vùng nhận diện (Zone/ROI) theo camera.

Tách riêng khỏi ppe_tracker.py để test chạy được bằng `python3 -m unittest` mà
KHÔNG cần torch/cv2/numpy — chỉ dùng thư viện chuẩn.

Toạ độ vùng là TỈ LỆ 0–1 theo khung hình (không phải pixel) nên đổi độ phân giải
camera vẫn dùng lại được vùng đã vẽ trên web.
"""

import json
import time
from collections import namedtuple


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


# Vùng NGUY HIỂM (RESTRICTED/WARNING/SUSPENDED_LOAD): chỉ cần người bước chân vào
# là vi phạm, không liên quan tới PPE. Khác vùng MONITORING — vùng đó chỉ dùng để
# LỌC bớt người ngoài phạm vi làm việc.
DangerZone = namedtuple('DangerZone', 'zone_id type polygon')


def intrusions(persons, danger_zones, width, height):
    """Người đang đứng trong vùng nguy hiểm -> [(person, zone_id, type)].

    Mỗi người chỉ báo MỘT vùng (vùng khớp đầu tiên): hai vùng cấm chồng nhau thì
    một lần bước chân vẫn là một vi phạm, không phải hai.
    """
    if not danger_zones:
        return []
    found = []
    for p in persons:
        x, y = foot_point(p['box'], width, height)
        for zone_id, zone_type, polygon in danger_zones:
            if point_in_polygon(x, y, polygon):
                found.append((p, zone_id, zone_type))
                break
    return found


class IntrusionTracker:
    """Chốt vi phạm xâm nhập theo THỜI GIAN, không theo từng khung hình.

    Một khung lọt vào mép vùng (hoặc bbox nhảy) không phải là xâm nhập: phải đứng
    trong vùng liên tục >= confirm_seconds mới chốt, giống CONFIRM_DELAY của PPE.
    Còn đứng đó thì cứ repeat_seconds báo lại một lần với occurrenceCount tăng dần
    (khớp cách REPORT_INTERVAL của yolo_inference.py báo lại vi phạm PPE).
    """

    def __init__(self, confirm_seconds=3.0, repeat_seconds=60.0, now=time.time):
        self.confirm_seconds = confirm_seconds
        self.repeat_seconds = repeat_seconds
        self._now = now
        self._state = {}   # (cam_id, track_id, zone_id) -> {'since', 'last', 'count'}

    def update(self, cam_id, found, track_id_of):
        """found = kết quả intrusions() -> [(person, zone_id, type, occurrence_count)] đã chốt."""
        now = self._now()
        seen = set()
        confirmed = []
        for person, zone_id, zone_type in found:
            track_id = track_id_of(person)
            if track_id is None:
                continue    # không bám vết được người này -> không tính thời gian liên tục
            key = (cam_id, track_id, zone_id)
            seen.add(key)
            state = self._state.get(key)
            if state is None:
                self._state[key] = {'since': now, 'last': 0.0, 'count': 0}
                continue
            if now - state['since'] < self.confirm_seconds:
                continue
            if state['count'] and now - state['last'] < self.repeat_seconds:
                continue
            state['count'] += 1
            state['last'] = now
            confirmed.append((person, zone_id, zone_type, state['count']))
        # Rời vùng (hoặc rời khung hình) -> quên luôn, lần sau bước vào phải đủ 3s lại từ đầu.
        # Chỉ đụng trạng thái CỦA camera này: các camera khác cập nhật ở lượt riêng.
        for key in [k for k in self._state if k[0] == cam_id and k not in seen]:
            del self._state[key]
        return confirmed
