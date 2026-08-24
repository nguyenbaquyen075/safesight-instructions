# SPDX-License-Identifier: MIT
"""Đo model TRÊN ĐÚNG ĐIỀU KIỆN DEMO (webcam, người đứng gần) — không phải trên
ảnh công trường.

Chỉ số đo trên data_train (người ở xa, nhỏ, bị che) KHÔNG áp dụng cho demo webcam:
vật ở gần to gấp nhiều lần nên model bắt chắc tay hơn hẳn. Muốn biết demo có chạy
được không thì phải đo bằng chính webcam.

Dùng:  .venv/bin/python ai-engine/check_webcam.py [model.pt] [số giây]
Anh đứng trước webcam trong lúc nó chạy, đeo/không đeo món cần thử.
"""
import collections
import sys
import time

import cv2
from ultralytics import YOLO

MODEL = sys.argv[1] if len(sys.argv) > 1 else 'ppe_multiclass.pt'
GIAY = float(sys.argv[2]) if len(sys.argv) > 2 else 12.0
VN = {'Person': 'NGƯỜI', 'helmet': 'MŨ', 'vest': 'ÁO', 'gloves': 'GĂNG',
      'boots': 'GIÀY', 'goggles': 'KÍNH'}

m = YOLO(MODEL)
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print('❌ Không mở được webcam'); sys.exit(1)
for _ in range(10):
    cap.read()                       # bỏ vài khung đầu cho camera cân sáng

khung = 0
co = collections.Counter()           # số khung hình THẤY món đó
conf_max = collections.defaultdict(float)
t0 = time.time()
last = None
print(f'Đang đo bằng {MODEL} trong {GIAY:.0f}s — anh đứng vào khung hình...')
while time.time() - t0 < GIAY:
    ok, fr = cap.read()
    if not ok:
        continue
    khung += 1
    last = fr
    r = m.predict(fr, conf=0.15, imgsz=640, augment=True, iou=0.5, verbose=False)[0]
    thay = set()
    for c, cf in zip(r.boxes.cls.int().tolist(), r.boxes.conf.tolist()):
        n = m.names[c]
        thay.add(n)
        conf_max[n] = max(conf_max[n], cf)
    for n in thay:
        co[n] += 1
cap.release()

print(f'\n=== {khung} khung hình trong {GIAY:.0f}s ===')
print(f'{"món":<10} {"bắt được":>10}  {"conf cao nhất":>14}')
for n in ('Person', 'helmet', 'vest', 'gloves', 'boots', 'goggles'):
    if khung == 0:
        break
    ty = co[n] / khung * 100
    dau = '✅' if ty >= 80 else ('⚠️' if ty >= 30 else '❌')
    print(f'{VN.get(n, n):<10} {ty:8.0f}%  {conf_max[n]:14.2f}  {dau}')
print('\n✅ >=80% khung: dùng demo được | ⚠️ 30-80%: nhấp nháy | ❌ <30%: coi như không bắt được')

if last is not None:
    out = 'webcam_check.jpg'
    r = m.predict(last, conf=0.15, imgsz=640, augment=True, iou=0.5, verbose=False)[0]
    for b, c, cf in zip(r.boxes.xyxy.int().tolist(), r.boxes.cls.int().tolist(),
                        r.boxes.conf.tolist()):
        n = m.names[c]
        col = (0, 255, 0) if not n.startswith('no_') else (0, 0, 255)
        cv2.rectangle(last, (b[0], b[1]), (b[2], b[3]), col, 2)
        cv2.putText(last, f'{VN.get(n, n)} {cf:.2f}', (b[0], max(14, b[1] - 5)), 0, 0.6, col, 2)
    cv2.imwrite(out, last)
    print(f'Khung cuối đã vẽ khung: {out}')
