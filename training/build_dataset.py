# SPDX-License-Identifier: MIT
"""Dựng dataset train PPE — chạy TRONG COLAB (máy anh chỉ còn 16GB đĩa).

Mục tiêu bám theo ai-engine/eval_ppe_decision.py: kéo BÁO OAN của găng (11.3%)
và giày (9.1%) về <=1%. Báo oan = model bỏ sót món đồ người ta ĐANG đeo, nên thứ
cần là RECALL của gloves/boots -> cần nhiều nhãn gloves/boots thật.

Nguồn:
  - aseiro-qlopd/ppe-detection-l0kc1  42.989 ảnh, boots 16.538, gloves 7.413,
    person 41.257 (0.96 nhãn person/ảnh -> KHÔNG đầu độc lớp Person)
  - ppe-detector-tcc/detech-ppe-7qydu  1.413 ảnh, dataset gốc của dự án (đúng miền)

CỐ TÌNH KHÔNG dùng data_train/ppes: 6.473 ảnh CCTV có người/áo/giày hiện rõ nhưng
chỉ gán nhãn glove/goggles -> dạy model "chỗ này không có người/giày/áo".

GHÉP THEO TÊN LỚP, không theo chỉ số. Dataset khác nhau xếp lớp khác thứ tự;
merge_datasets.py cũ hard-code chỉ số nên chỉ đúng với đúng 2 dataset đó.

Split test/valid của detech KHÔNG được đưa vào train — đó là tập chấm điểm
của eval_ppe_decision.py, dính vào là mọi con số sau này thành vô nghĩa.
"""
import argparse
import collections
import glob
import os
import random
import shutil

import yaml

# Thứ tự 11 lớp PHẢI giữ nguyên — khớp ppe_multiclass.pt đang chạy nên
# ai-engine/ppe_tracker.py không phải sửa dòng nào.
TARGET = ['Person', 'boots', 'gloves', 'goggles', 'helmet', 'no_boots',
          'no_gloves', 'no_goggle', 'no_helmet', 'none', 'vest']
TARGET_ID = {n: i for i, n in enumerate(TARGET)}

# Chuẩn hoá tên lớp. Dataset PPE ngoài đời viết đủ kiểu: "Hardhat", "NO-Safety Vest",
# "Safety Boot", "no_glove"... Không liệt kê tay từng biến thể (liệt kê thiếu là ăn
# lớp lạ im lặng) — chỉ khai tên DƯƠNG, còn tên âm suy ra bằng cách bóc tiền tố "no".
BASE = {
    'person': 'Person', 'human': 'Person', 'worker': 'Person',
    'boots': 'boots', 'boot': 'boots', 'shoes': 'boots', 'shoe': 'boots',
    'safetyboot': 'boots', 'safetyboots': 'boots', 'safetyshoes': 'boots',
    'protectiveboots': 'boots',
    'gloves': 'gloves', 'glove': 'gloves',
    'goggles': 'goggles', 'goggle': 'goggles', 'glasses': 'goggles', 'glass': 'goggles',
    'helmet': 'helmet', 'hardhat': 'helmet', 'hat': 'helmet',
    'vest': 'vest', 'safetyvest': 'vest',
    'none': 'none',
    'mask': None, 'suit': None,     # hệ thống không dùng -> bỏ box
}
# Lớp âm tương ứng. Không có trong bảng = bỏ box (schema 11 lớp không có no_vest,
# no_person). Bỏ nhãn một lớp KHÔNG hỏng lớp khác: vùng đó thành nền, model không
# bị bắt học gì ở đấy — khác hẳn việc để nguyên ảnh thiếu nhãn người/giày.
NEG = {'boots': 'no_boots', 'gloves': 'no_gloves',
       'goggles': 'no_goggle', 'helmet': 'no_helmet'}
DIRECT = {'unglove': 'no_gloves'}   # tên âm không mở đầu bằng "no"

UNKNOWN = '__UNKNOWN__'


def canon(name):
    """'NO-Safety Vest' -> None (bỏ). 'Hardhat' -> 'helmet'. Lớp lạ -> UNKNOWN.

    UNKNOWN được đếm và in ra, không nuốt im — dataset mới thêm lớp mà mình
    không biết thì phải thấy, chứ không âm thầm mất nhãn.
    """
    key = name.lower().replace('-', '').replace('_', '').replace(' ', '')
    if key in DIRECT:
        return DIRECT[key]
    if key in BASE:                 # 'none' nằm đây, xét trước nhánh "no" bên dưới
        return BASE[key]
    if key.startswith('no'):
        base = BASE.get(key[2:], UNKNOWN)
        if base is UNKNOWN:
            return UNKNOWN
        return NEG.get(base) if base else None
    return UNKNOWN


def read_names(ds_dir):
    with open(os.path.join(ds_dir, 'data.yaml')) as f:
        return yaml.safe_load(f)['names']


def remap_label(lines, names, stats):
    """Đổi id theo TÊN. Trả về [] nếu ảnh không còn nhãn nào dùng được."""
    out = []
    for line in lines:
        parts = line.split()
        if len(parts) < 5:
            continue
        src = names[int(parts[0])]
        tgt = canon(src)
        if tgt == UNKNOWN:
            stats['lop_la'][src] += 1
            continue
        if tgt is None:
            stats['bo_box'][src] += 1
            continue
        out.append(' '.join([str(TARGET_ID[tgt])] + parts[1:]))
    return out


def collect(ds_dir, split, want=None):
    """Đọc 1 split -> [(đường dẫn ảnh, các dòng nhãn đã đổi id, tập lớp có mặt)]."""
    names = read_names(ds_dir)
    stats = {'lop_la': collections.Counter(), 'bo_box': collections.Counter()}
    items = []
    img_dir = os.path.join(ds_dir, split, 'images')
    for img in sorted(glob.glob(os.path.join(img_dir, '*.jpg'))):
        lbl = img.replace('/images/', '/labels/').rsplit('.', 1)[0] + '.txt'
        if not os.path.exists(lbl):
            continue
        with open(lbl) as f:
            lines = [l.strip() for l in f if l.strip()]
        new = remap_label(lines, names, stats)
        if not new:
            continue
        present = {TARGET[int(l.split()[0])] for l in new}
        if want and not (present & want):
            continue
        items.append((img, new, present))
    if stats['lop_la']:
        print(f'  ! lớp không nhận ra ({ds_dir}/{split}):', dict(stats['lop_la']))
    if stats['bo_box']:
        print(f'  - box bỏ đi ({ds_dir}/{split}):', dict(stats['bo_box']))
    return items


def write(items, out_dir, split, prefix):
    di = os.path.join(out_dir, split, 'images')
    dl = os.path.join(out_dir, split, 'labels')
    os.makedirs(di, exist_ok=True)
    os.makedirs(dl, exist_ok=True)
    for img, lines, _ in items:
        stem = prefix + os.path.basename(img).rsplit('.', 1)[0]
        shutil.copy2(img, os.path.join(di, stem + '.jpg'))
        with open(os.path.join(dl, stem + '.txt'), 'w') as f:
            f.write('\n'.join(lines) + '\n')


def dem(out_dir, split):
    c = collections.Counter()
    n = 0
    for lbl in glob.glob(os.path.join(out_dir, split, 'labels', '*.txt')):
        n += 1
        for line in open(lbl):
            if line.strip():
                c[TARGET[int(line.split()[0])]] += 1
    return n, c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--big', default='PPE-Detection-1', help='thư mục dataset aseiro đã tải')
    ap.add_argument('--detech', default='Detech-PPE-1', help='thư mục dataset Detech đã tải')
    ap.add_argument('--out', default='ppe_train_v2')
    ap.add_argument('--cap', type=int, default=12000,
                    help='trần số ảnh lấy từ dataset lớn (Colab free ~4h/phiên)')
    a = ap.parse_args()

    random.seed(0)
    if os.path.exists(a.out):
        shutil.rmtree(a.out)

    # Chỉ lấy ảnh CÓ găng hoặc giày — thứ đang thiếu. Ảnh chỉ có mũ/áo không
    # giúp gì cho báo oan găng/giày mà vẫn tốn thời gian train.
    print('== dataset lớn (aseiro) ==')
    big = collect(a.big, 'train', want={'gloves', 'boots'})
    co_gang = [x for x in big if 'gloves' in x[2]]
    chi_giay = [x for x in big if 'gloves' not in x[2]]
    random.shuffle(chi_giay)
    # Găng hiếm hơn giày (7.413 vs 16.538) -> giữ TOÀN BỘ ảnh có găng trước.
    chosen = co_gang + chi_giay[:max(0, a.cap - len(co_gang))]
    print(f'  ảnh có găng {len(co_gang)}, chỉ có giày {len(chi_giay)} -> lấy {len(chosen)}')

    print('== dataset Detech (đúng miền) ==')
    det_train = collect(a.detech, 'train')
    det_valid = collect(a.detech, 'valid')
    det_test = collect(a.detech, 'test')
    print(f'  train {len(det_train)} | valid {len(det_valid)} | test {len(det_test)}')
    assert len(det_valid) + len(det_test) > 0, 'thiếu split valid/test của Detech'

    write(chosen, a.out, 'train', 'big_')
    write(det_train, a.out, 'train', 'det_')
    # val trong lúc train = valid của dataset lớn. KHÔNG dùng valid/test của
    # Detech: đó là tập chấm điểm cuối, dùng làm val thì best.pt sẽ được chọn
    # để vừa lòng chính tập mình sắp dùng để nghiệm thu.
    big_valid = collect(a.big, 'valid', want={'gloves', 'boots'})
    random.shuffle(big_valid)
    write(big_valid[:1500], a.out, 'valid', 'big_')

    with open(os.path.join(a.out, 'data.yaml'), 'w') as f:
        yaml.safe_dump({'path': os.path.abspath(a.out), 'train': 'train/images',
                        'val': 'valid/images', 'nc': len(TARGET), 'names': TARGET},
                       f, sort_keys=False, allow_unicode=True)

    print('\n===== KẾT QUẢ =====')
    for split in ('train', 'valid'):
        n, c = dem(a.out, split)
        print(f'{split}: {n} ảnh')
        for name in TARGET:
            if c[name]:
                print(f'    {name:10} {c[name]:6d}   ({c[name]/max(n,1):.2f}/ảnh)')
    print(f'\ndata.yaml -> {a.out}/data.yaml')


def selftest():
    assert canon('NO-Safety Vest') is None
    assert canon('Hardhat') == 'helmet'
    assert canon('NO-Hardhat') == 'no_helmet'
    assert canon('Safety Boot') == 'boots'
    assert canon('shoes') == 'boots'
    assert canon('glove') == 'gloves'
    assert canon('no_glove') == 'no_gloves'
    assert canon('glasses') == 'goggles'
    assert canon('no-glasses') == 'no_goggle'
    assert canon('person') == 'Person'
    assert canon('excavator') == '__UNKNOWN__'   # lớp lạ -> báo ra, không nuốt im
    # đổi id theo tên: dataset xếp lớp ngược thứ tự vẫn phải ra đúng
    names = ['gloves', 'person', 'no-vest']
    stats = {'lop_la': collections.Counter(), 'bo_box': collections.Counter()}
    out = remap_label(['0 .5 .5 .1 .1', '1 .5 .5 .2 .2', '2 .5 .5 .3 .3'], names, stats)
    assert out == [f'{TARGET_ID["gloves"]} .5 .5 .1 .1',
                   f'{TARGET_ID["Person"]} .5 .5 .2 .2'], out
    assert stats['bo_box']['no-vest'] == 1
    print('selftest OK')


if __name__ == '__main__':
    import sys
    if '--selftest' in sys.argv:
        selftest()
    else:
        main()
