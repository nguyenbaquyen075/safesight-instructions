# SPDX-License-Identifier: MIT
"""Chấm điểm QUYẾT ĐỊNH của hệ thống, không chấm điểm khung detect.

Chỉ số của model (mAP, "bao nhiêu % khung có giày") KHÔNG phải mục tiêu sản phẩm.
Mục tiêu là: kết luận đúng ai thiếu đồ bảo hộ, và KHÔNG đổ oan cho ai.

    BÁO OAN = người ĐANG đeo mà hệ thống bảo thiếu   <- chỉ số phải kéo về ~0
    BỎ LỌT  = người KHÔNG đeo mà hệ thống bảo đủ

Chấm trên detech_ppe valid+test (283 ảnh gán nhãn đủ 11 lớp). KHÔNG dùng
data_train/merged: 88% ảnh ở đó thiếu nhãn Person/vest/boots nên "sự thật" sai.

Chỉ chấm người mà người gán nhãn ĐÃ đánh dấu bộ phận đó (có gloves hoặc no_gloves).
Người không được đánh dấu -> không biết sự thật -> loại khỏi phép đo, không đoán bừa.

Dùng:  .venv/bin/python ai-engine/eval_ppe_decision.py [gloves|boots|helmet|vest]
"""
import glob
import os
import sys

import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ppe_tracker import PPEViolationTracker

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NAMES = ['Person', 'boots', 'gloves', 'goggles', 'helmet', 'no_boots', 'no_gloves',
         'no_goggle', 'no_helmet', 'none', 'vest']
VN = {'gloves': 'GĂNG', 'boots': 'GIÀY', 'helmet': 'MŨ', 'vest': 'ÁO'}


def _load_gt(lbl_path, w, h):
    persons, items = [], []
    for line in open(lbl_path):
        p = line.split()
        if len(p) < 5:
            continue
        cx, cy, bw, bh = (float(x) for x in p[1:5])
        box = [(cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h]
        name = NAMES[int(p[0])]
        (persons if name == 'Person' else items).append((name, box))
    return persons, items


def _center_inside(inner, outer):
    cx, cy = (inner[0] + inner[2]) / 2, (inner[1] + inner[3]) / 2
    return outer[0] <= cx <= outer[2] and outer[1] <= cy <= outer[3]


def _iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    if x2 <= x1 or y2 <= y1:
        return 0.0
    inter = (x2 - x1) * (y2 - y1)
    return inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter)


def _pct_to_box(bb, w, h):
    f = lambda s: float(s.rstrip('%'))
    left, top = f(bb['left']) * w / 100, f(bb['top']) * h / 100
    return [left, top, left + f(bb['width']) * w / 100, top + f(bb['height']) * h / 100]


def evaluate(ppe, model_path='ppe_multiclass.pt', verbose=True):
    # Ảnh tĩnh rời rạc -> tắt cửa sổ bằng chứng theo thời gian (chỉ có nghĩa với video),
    # nếu không track id bị dùng lại giữa 2 ảnh sẽ mang bằng chứng của người khác sang.
    PPEViolationTracker.EVIDENCE_WINDOW = 0.0
    tracker = PPEViolationTracker(model_path=os.path.join(REPO, model_path),
                                  confidence=0.15, min_height_ratio=0.0,
                                  required_ppe=(ppe,), imgsz=640)
    r = {'oan': 0, 'lot': 0, 'dung_du': 0, 'dung_thieu': 0, 'khong_thay_nguoi': 0}
    for split in ('valid', 'test'):
        pattern = os.path.join(REPO, 'data_train/detech_ppe', split, 'images/*.jpg')
        for img_path in sorted(glob.glob(pattern)):
            lbl = img_path.replace('/images/', '/labels/').replace('.jpg', '.txt')
            if not os.path.exists(lbl):
                continue
            img = cv2.imread(img_path)
            if img is None:
                continue
            h, w = img.shape[:2]
            gt_persons, gt_items = _load_gt(lbl, w, h)
            if not gt_persons:
                continue
            try:                      # mỗi ảnh độc lập, không phải video
                tracker.model.predictor.trackers[0].reset()
            except Exception:
                pass
            dets = tracker.process_frame(img)
            preds = [(d, _pct_to_box(d['bbox'], w, h))
                     for d in dets if d.get('type') == 'person']

            for _, gbox in gt_persons:
                has = any(n == ppe and _center_inside(b, gbox) for n, b in gt_items)
                hasnt = any(n == 'no_' + ppe and _center_inside(b, gbox) for n, b in gt_items)
                if has == hasnt:      # không đánh dấu hoặc mâu thuẫn -> bỏ qua
                    continue
                match = max(preds, key=lambda x: _iou(x[1], gbox), default=None)
                if match is None or _iou(match[1], gbox) < 0.4:
                    r['khong_thay_nguoi'] += 1
                    continue
                bao_thieu = bool(match[0].get('isViolation'))
                if has and bao_thieu:
                    r['oan'] += 1
                elif has:
                    r['dung_du'] += 1
                elif bao_thieu:
                    r['dung_thieu'] += 1
                else:
                    r['lot'] += 1

    n = r['oan'] + r['lot'] + r['dung_du'] + r['dung_thieu']
    r['n'] = n
    r['ty_le_oan'] = r['oan'] / n if n else 0.0
    r['ty_le_lot'] = r['lot'] / n if n else 0.0
    if verbose:
        print(f"\n===== {VN.get(ppe, ppe.upper())} =====")
        print(f"  ra quyết định trên     : {n} người")
        print(f"  không thấy người       : {r['khong_thay_nguoi']}")
        print(f"  BÁO OAN                : {r['oan']:4d}  ({r['ty_le_oan']*100:5.1f}%)")
        print(f"  BỎ LỌT                 : {r['lot']:4d}  ({r['ty_le_lot']*100:5.1f}%)")
        print(f"  đúng 'đủ' / đúng 'thiếu': {r['dung_du']} / {r['dung_thieu']}")
    return r


# Ngưỡng để được phép bật món PPE đó vào required_ppe (bắt đầu phạt người thật).
NGUONG_OAN_TOI_DA = 0.01

if __name__ == '__main__':
    targets = sys.argv[1:] or ['gloves', 'boots']
    for ppe in targets:
        res = evaluate(ppe)
        dat = res['ty_le_oan'] <= NGUONG_OAN_TOI_DA
        print(f"  => {'ĐẠT' if dat else 'CHƯA ĐẠT'} ngưỡng báo oan "
              f"{NGUONG_OAN_TOI_DA*100:.0f}% -> "
              f"{'có thể' if dat else 'CHƯA được'} bật '{ppe}' vào required_ppe")
