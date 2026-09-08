# SPDX-License-Identifier: MIT
"""python3 -m unittest ai-engine/test_zones.py — không cần torch/cv2."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from zones import (DangerZone, IntrusionTracker, filter_persons_in_zones, foot_point,
                   intrusions, parse_polygon, point_in_polygon)

SQUARE = [(0.2, 0.2), (0.8, 0.2), (0.8, 0.8), (0.2, 0.8)]


class ParsePolygonTest(unittest.TestCase):
    def test_a_valid_polygon_becomes_a_list_of_pairs(self):
        raw = '[{"x":0.1,"y":0.2},{"x":0.9,"y":0.2},{"x":0.5,"y":0.9}]'
        self.assertEqual(parse_polygon(raw), [(0.1, 0.2), (0.9, 0.2), (0.5, 0.9)])

    def test_broken_json_is_rejected(self):
        self.assertIsNone(parse_polygon('{not json'))
        self.assertIsNone(parse_polygon(None))

    def test_fewer_than_three_points_is_rejected(self):
        self.assertIsNone(parse_polygon('[{"x":0.1,"y":0.2},{"x":0.9,"y":0.2}]'))

    def test_a_point_without_coordinates_is_rejected(self):
        self.assertIsNone(parse_polygon('[{"x":0.1,"y":0.2},{"x":0.9},{"x":0.5,"y":0.9}]'))


class PointInPolygonTest(unittest.TestCase):
    def test_a_point_inside_the_square(self):
        self.assertTrue(point_in_polygon(0.5, 0.5, SQUARE))

    def test_points_outside_the_square_on_every_side(self):
        for x, y in ((0.1, 0.5), (0.9, 0.5), (0.5, 0.1), (0.5, 0.9)):
            self.assertFalse(point_in_polygon(x, y, SQUARE), (x, y))

    def test_a_concave_polygon_excludes_the_notch(self):
        # Chữ U: khoét rãnh ở giữa từ trên xuống
        u_shape = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.7, 1.0),
                   (0.7, 0.3), (0.3, 0.3), (0.3, 1.0), (0.0, 1.0)]
        self.assertTrue(point_in_polygon(0.5, 0.1, u_shape))
        self.assertFalse(point_in_polygon(0.5, 0.6, u_shape))


class FilterPersonsTest(unittest.TestCase):
    # Khung 1000x1000 -> điểm chân của mỗi bbox tính ra đúng tỉ lệ dễ đọc
    W = H = 1000

    def test_the_foot_point_is_the_bottom_center(self):
        self.assertEqual(foot_point([200, 100, 400, 600], 1000, 1000), (0.3, 0.6))

    def test_a_person_standing_inside_is_kept(self):
        inside = {'box': [400, 100, 600, 500], 'id': 1}
        self.assertEqual(filter_persons_in_zones([inside], [SQUARE], self.W, self.H), [inside])

    def test_a_person_standing_outside_is_dropped(self):
        # Thân người tràn vào vùng nhưng CHÂN ở ngoài (y2 = 0.9) -> bỏ
        outside = {'box': [400, 100, 600, 900], 'id': 2}
        self.assertEqual(filter_persons_in_zones([outside], [SQUARE], self.W, self.H), [])

    def test_a_person_inside_any_of_several_zones_is_kept(self):
        other = [(0.0, 0.85), (0.2, 0.85), (0.2, 0.95), (0.0, 0.95)]
        person = {'box': [50, 100, 150, 900], 'id': 3}
        self.assertEqual(filter_persons_in_zones([person], [SQUARE], self.W, self.H), [])
        self.assertEqual(filter_persons_in_zones([person], [SQUARE, other], self.W, self.H), [person])

    def test_no_zone_means_the_whole_frame(self):
        persons = [{'box': [0, 0, 10, 10], 'id': 4}]
        self.assertEqual(filter_persons_in_zones(persons, [], self.W, self.H), persons)
        self.assertEqual(filter_persons_in_zones(persons, None, self.W, self.H), persons)


# --- Xâm nhập vùng cấm (RESTRICTED/WARNING/SUSPENDED_LOAD) ---

RESTRICTED = DangerZone('z1', 'RESTRICTED', SQUARE)
LOAD = DangerZone('z2', 'SUSPENDED_LOAD', [(0.0, 0.85), (0.2, 0.85), (0.2, 0.95), (0.0, 0.95)])


def person(track_id, box):
    return {'box': box, 'trackId': track_id}


class IntrusionsTest(unittest.TestCase):
    W = H = 1000

    def test_a_person_standing_in_a_danger_zone_is_reported_with_its_id_and_type(self):
        inside = person(1, [400, 100, 600, 500])
        self.assertEqual(intrusions([inside], [RESTRICTED], self.W, self.H),
                         [(inside, 'z1', 'RESTRICTED')])

    def test_a_person_standing_outside_every_danger_zone_is_ignored(self):
        # Thân người tràn vào vùng nhưng CHÂN ở ngoài -> không tính
        self.assertEqual(intrusions([person(2, [400, 100, 600, 900])], [RESTRICTED], self.W, self.H), [])

    def test_each_person_is_reported_for_the_first_matching_zone_only(self):
        standing_in_load = person(3, [50, 100, 150, 900])
        self.assertEqual(intrusions([standing_in_load], [RESTRICTED, LOAD], self.W, self.H),
                         [(standing_in_load, 'z2', 'SUSPENDED_LOAD')])

    def test_no_danger_zone_means_no_intrusion(self):
        self.assertEqual(intrusions([person(4, [400, 100, 600, 500])], [], self.W, self.H), [])
        self.assertEqual(intrusions([person(4, [400, 100, 600, 500])], None, self.W, self.H), [])

    def test_a_plain_tuple_works_like_a_danger_zone(self):
        inside = person(5, [400, 100, 600, 500])
        self.assertEqual(intrusions([inside], [('z9', 'WARNING', SQUARE)], self.W, self.H),
                         [(inside, 'z9', 'WARNING')])


class IntrusionTrackerTest(unittest.TestCase):
    def setUp(self):
        self.clock = [1000.0]
        self.tracker = IntrusionTracker(confirm_seconds=3.0, repeat_seconds=60.0,
                                        now=lambda: self.clock[0])
        self.person = person(7, [400, 100, 600, 500])
        self.found = [(self.person, 'z1', 'RESTRICTED')]

    def update(self):
        return self.tracker.update('cam-001', self.found, lambda p: p['trackId'])

    def test_a_person_inside_for_less_than_the_confirm_delay_is_not_confirmed(self):
        self.assertEqual(self.update(), [])
        self.clock[0] += 2.9
        self.assertEqual(self.update(), [])

    def test_a_person_inside_for_the_confirm_delay_is_confirmed_once(self):
        self.update()
        self.clock[0] += 3.0
        self.assertEqual(self.update(), [(self.person, 'z1', 'RESTRICTED', 1)])
        self.clock[0] += 1.0
        self.assertEqual(self.update(), [])

    def test_a_person_still_inside_is_reported_again_after_the_repeat_delay(self):
        self.update()
        self.clock[0] += 3.0
        self.update()
        self.clock[0] += 59.0
        self.assertEqual(self.update(), [])
        self.clock[0] += 1.0
        self.assertEqual(self.update(), [(self.person, 'z1', 'RESTRICTED', 2)])

    def test_leaving_the_zone_resets_the_confirm_delay(self):
        self.update()
        self.clock[0] += 2.0
        self.assertEqual(self.tracker.update('cam-001', [], lambda p: p['trackId']), [])
        self.clock[0] += 2.0
        self.assertEqual(self.update(), [])          # đếm lại từ đầu, chưa đủ 3s
        self.clock[0] += 3.0
        self.assertEqual(self.update(), [(self.person, 'z1', 'RESTRICTED', 1)])

    def test_another_camera_does_not_clear_the_state_of_this_one(self):
        self.update()
        self.clock[0] += 3.0
        self.tracker.update('cam-002', [], lambda p: p['trackId'])
        self.assertEqual(self.update(), [(self.person, 'z1', 'RESTRICTED', 1)])

    def test_a_person_without_a_track_id_is_skipped(self):
        self.tracker.update('cam-001', [(person(None, [0, 0, 1, 1]), 'z1', 'RESTRICTED')],
                            lambda p: p['trackId'])
        self.clock[0] += 10.0
        self.assertEqual(self.tracker.update('cam-001', [(person(None, [0, 0, 1, 1]), 'z1', 'RESTRICTED')],
                                             lambda p: p['trackId']), [])


if __name__ == '__main__':
    unittest.main()
