# SPDX-License-Identifier: MIT
"""python3 -m unittest ai-engine/test_zones.py — không cần torch/cv2."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from zones import filter_persons_in_zones, foot_point, parse_polygon, point_in_polygon

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


if __name__ == '__main__':
    unittest.main()
