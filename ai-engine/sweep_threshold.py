# SPDX-License-Identifier: MIT
"""Quét ngưỡng PART_MIN_CONF: chạy model MỘT lần, thử mọi ngưỡng trên khung đã lưu.

Vì sao cần: so hai model bằng MỘT điểm là sai. Ngưỡng điều khiển trực tiếp cán
cân báo oan/bỏ lọt — chỉnh một dòng, không cần train. Model tốt hơn là model có
CẢ ĐƯỜNG CONG nằm trong hơn, không phải model có một con số đẹp hơn.

Đã cứu dự án này 2 lần: một model phụ cho giày trông như thắng (oan 5.9% so với
9.1%) nhưng quét ra mới thấy nó TỆ GẤP ĐÔI model gốc tại cùng mức bỏ lọt.

Dùng:  .venv/bin/python ai-engine/sweep_threshold.py <model.pt> <lớp> [model_phụ.pt]
"""
import glob
import os
import sys

import cv2
from ultralytics import YOLO

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eval_ppe_decision import _load_gt, _center_inside, _iou, REPO

NGUONG = (0.05, 0.10, 0.15, 0.20, 0.25, 0.35, 0.45, 0.60)


def thu_thap(model_path, ppe, parts_path=None):
    """Chạy model 1 lần -> [(sự thật có đeo, [conf của các hộp PPE trên người đó])]"""
    m = YOLO(os.path.join(REPO, model_path))
    # NGƯỜI luôn lấy từ model chính; PPE lấy từ model phụ nếu có (kiến trúc 2 model)
    mp = YOLO(os.path.join(REPO, parts_path)) if parts_path else m
    out, khong_thay = [], 0
    for split in ('valid', 'test'):
        for ip in sorted(glob.glob(os.path.join(REPO, 'data_train/detech_ppe',
                                                split, 'images/*.jpg'))):
            lp = ip.replace('/images/', '/labels/').replace('.jpg', '.txt')
            if not os.path.exists(lp):
                continue
            img = cv2.imread(ip)
            if img is None:
                continue
            h, w = img.shape[:2]
            gtp, gti = _load_gt(lp, w, h)
            if not gtp:
                continue
            r = m.predict(img, conf=0.05, imgsz=640, augment=True, iou=0.5, verbose=False)[0]
            P = [b for b, c in zip(r.boxes.xyxy.tolist(), r.boxes.cls.int().tolist())
                 if m.names[c] == 'Person']
            rp = (mp.predict(img, conf=0.05, imgsz=640, augment=True, iou=0.5,
                             verbose=False)[0] if parts_path else r)
            I = [(b, cf) for b, c, cf in zip(rp.boxes.xyxy.tolist(),
                                            rp.boxes.cls.int().tolist(),
                                            rp.boxes.conf.tolist())
                 if mp.names[c] == ppe]
            for _, gb in gtp:
                has = any(n == ppe and _center_inside(bb, gb) for n, bb in gti)
                hasnt = any(n == 'no_' + ppe and _center_inside(bb, gb) for n, bb in gti)
                if has == hasnt:
                    continue
                pb = max(P, key=lambda b: _iou(b, gb), default=None)
                if pb is None or _iou(pb, gb) < 0.4:
                    khong_thay += 1
                    continue
                out.append((has, [cf for b, cf in I if _center_inside(b, pb)]))
    return out, khong_thay


if __name__ == '__main__':
    model, ppe = sys.argv[1], sys.argv[2]
    parts = sys.argv[3] if len(sys.argv) > 3 else None
    data, kt = thu_thap(model, ppe, parts)
    ten = f'{os.path.basename(model)}' + (f' + {os.path.basename(parts)}' if parts else '')
    print(f'\n### {ten} / {ppe} — {len(data)} người, {kt} không thấy')
    print(f'{"ngưỡng":>8} | {"báo oan":>8} | {"bỏ lọt":>8} | đạt cả hai?')
    for th in NGUONG:
        oan = lot = 0
        for has, confs in data:
            thay = any(c >= th for c in confs)
            if has and not thay:
                oan += 1
            elif not has and thay:
                lot += 1
        n = max(len(data), 1)
        o, l = oan / n, lot / n
        print(f'{th:8.2f} | {o*100:7.1f}% | {l*100:7.1f}% | '
              f'{"ĐẠT" if (o <= 0.01 and l <= 0.02) else ""}')
