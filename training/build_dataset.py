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


# Lớp cần học cho mục tiêu hiện tại (găng + giày), gồm CẢ nhãn phủ định.
# Bỏ quên nhãn phủ định ở đây là vứt đúng thứ hiếm nhất: ảnh "chân trần" chỉ có
# no_boots chứ không có boots, lọc theo nhãn dương là loại sạch chúng — đúng lỗi
# đã làm v5 vòng đầu chỉ còn 63 nhãn no_boots.
CAN_HOC = {'gloves', 'boots', 'no_gloves', 'no_boots'}


def _du_nhan(lines, names):
    """Mọi người trong ảnh đều được đánh dấu ĐỦ tay, chân VÀ áo?

    Chạy trên NHÃN GỐC (trước remap) vì phép kiểm cần lớp `no-vest` — lớp đó bị
    vứt lúc remap (schema 11 lớp không có no_vest), kiểm sau remap là mù về áo.
    Đó chính là lỗi của vòng v3: lọc sạch tay/chân nhưng bỏ quên áo, kết quả áo
    hỏng từ 3.1% lên 9.5% báo oan.

    Ảnh có 5 người mà chỉ 1 nhãn găng nghĩa là 4 người kia tay hiện rõ nhưng
    không được gán nhãn -> với YOLO đó là hard negative, dạy model "chỗ này KHÔNG
    phải găng".
    """
    c = collections.Counter()
    dien_tich = []
    for l in lines:
        q = l.split()
        c[canon(names[int(q[0])])] += 1
        dien_tich.append(float(q[3]) * float(q[4]))
    nguoi = c['Person']
    if nguoi == 0:
        # Ảnh KHÔNG có người: hai khả năng trái ngược nhau.
        #  - ảnh CẮT CẬN một bàn chân/bàn tay -> không có người thật để gán nhãn,
        #    dùng được, và đây là nguồn hiếm dạy model "chân trần trông thế nào".
        #  - ảnh CẢNH RỘNG có người mà quên gán nhãn (kiểu dataset ppes) -> đầu độc.
        # Phân biệt bằng kích thước: ảnh cắt cận có hộp chiếm phần lớn khung
        # (đo trên bộ balanced: median 34% khung), ảnh cảnh rộng thì hộp bé tí.
        return bool(dien_tich) and max(dien_tich) >= 0.15
    tay = c['gloves'] + c['no_gloves']
    chan = c['boots'] + c['no_boots']
    # canon('no-vest') trả None (bị vứt) -> đếm riêng bằng khoá None, đó chính là
    # nhãn "người này không mặc áo" mà mình cần để biết áo ĐÃ được soát.
    ao = c['vest'] + c[None]
    return tay >= nguoi and chan >= nguoi and ao >= nguoi


def collect(ds_dir, split, want=None, sach=False):
    """Đọc 1 split -> [(đường dẫn ảnh, các dòng nhãn đã đổi id, tập lớp có mặt)].

    sach=True: chỉ giữ ảnh mà MỌI người đều có nhãn tay và nhãn chân.
    """
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
        if sach and not _du_nhan(lines, names):
            continue
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
    ap.add_argument('--clean', action='store_true',
                    help='chỉ lấy ảnh mà mọi người đều có nhãn tay VÀ nhãn chân')
    ap.add_argument('--cap', type=int, default=12000,
                    help='trần số ảnh lấy từ dataset lớn (Colab free ~4h/phiên)')
    a = ap.parse_args()

    random.seed(0)
    if os.path.exists(a.out):
        shutil.rmtree(a.out)

    # Chỉ lấy ảnh CÓ găng hoặc giày — thứ đang thiếu. Ảnh chỉ có mũ/áo không
    # giúp gì cho báo oan găng/giày mà vẫn tốn thời gian train.
    print('== dataset lớn (aseiro) ==')
    big = collect(a.big, 'train', want=CAN_HOC, sach=a.clean)
    # Cắt theo ĐỘ HIẾM, không cắt ngẫu nhiên. Nhãn phủ định (no_boots/no_gloves =
    # chân trần, tay trần) là thứ hiếm nhất và là thứ DUY NHẤT dạy model "thiếu đồ
    # trông thế nào". Cắt ngẫu nhiên là chặt mất chúng -> model tưởng ai cũng đủ đồ
    # -> bỏ lọt người vi phạm thật. Đúng lỗi đã làm hỏng vòng v4 (0 nhãn no_boots).
    co_am = [x for x in big if x[2] & {'no_boots', 'no_gloves'}]
    con_lai = [x for x in big if not (x[2] & {'no_boots', 'no_gloves'})]
    random.shuffle(co_am)
    random.shuffle(con_lai)
    chosen = co_am[:a.cap] + con_lai[:max(0, a.cap - len(co_am))]
    print(f'  ảnh có nhãn PHỦ ĐỊNH {len(co_am)} (giữ trước), '
          f'còn lại {len(con_lai)} -> lấy tổng {len(chosen)}')

    print('== dataset Detech (đúng miền) ==')
    det_train = collect(a.detech, 'train', sach=a.clean)
    det_valid = collect(a.detech, 'valid')
    det_test = collect(a.detech, 'test')
    print(f'  train {len(det_train)} | valid {len(det_valid)} | test {len(det_test)}')
    assert len(det_valid) + len(det_test) > 0, 'thiếu split valid/test của Detech'

    write(chosen, a.out, 'train', 'big_')
    write(det_train, a.out, 'train', 'det_')
    # val trong lúc train = valid của dataset lớn. KHÔNG dùng valid/test của
    # Detech: đó là tập chấm điểm cuối, dùng làm val thì best.pt sẽ được chọn
    # để vừa lòng chính tập mình sắp dùng để nghiệm thu.
    big_valid = collect(a.big, 'valid', want=CAN_HOC, sach=a.clean)
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
    # bộ lọc sạch chạy trên TÊN GỐC: 1 người + găng + giày + áo -> nhận
    N = ['person', 'gloves', 'boots', 'vest', 'no-vest', 'no-gloves']
    mk = lambda *ids: [f'{i} 0 0 0 0' for i in ids]
    assert _du_nhan(mk(0, 1, 2, 3), N)                 # đủ cả ba
    assert _du_nhan(mk(0, 5, 2, 4), N)                 # no-gloves + no-vest cũng tính là đã soát
    assert not _du_nhan(mk(0, 1, 2), N)                # thiếu áo  <- lỗi của v3
    assert not _du_nhan(mk(0, 0, 1, 2, 3), N)          # 2 người, 1 bộ nhãn
    # ảnh không người: cắt cận (hộp to) thì nhận, cảnh rộng (hộp bé) thì loại
    assert _du_nhan(['2 0.5 0.5 0.6 0.6'], N)          # cắt cận bàn chân
    assert not _du_nhan(['2 0.5 0.5 0.05 0.05'], N)    # hộp bé -> cảnh rộng thiếu nhãn
    print('selftest OK')


if __name__ == '__main__':
    import sys
    if '--selftest' in sys.argv:
        selftest()
    else:
        main()
