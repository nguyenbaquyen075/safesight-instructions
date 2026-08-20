# SPDX-License-Identifier: MIT

"""Ghép dataset ppes (glove/shoes/goggles/helmet) vào detech_ppe (base 11 lớp hiện tại).

Giữ NGUYÊN thứ tự 11 lớp của detech_ppe (khớp model đang chạy) -> ppe_tracker.py
không cần sửa gì. Bỏ ảnh chỉ có mask/suit (không dùng trong hệ thống).
"""
import glob
import os
import shutil

BASE_NAMES = ['Person', 'boots', 'gloves', 'goggles', 'helmet',
              'no_boots', 'no_gloves', 'no_goggle', 'no_helmet', 'none', 'vest']

PPES_NAMES = ['glove', 'goggles', 'helmet', 'mask', 'no-suit', 'no_glove',
              'no_goggles', 'no_helmet', 'no_mask', 'no_shoes', 'shoes', 'suit']

# ppes class id -> base class id ; lớp không có trong map (mask/suit/no-suit/no_mask) bị bỏ
PPES_TO_BASE = {
    0: 2,   # glove -> gloves
    1: 3,   # goggles -> goggles
    2: 4,   # helmet -> helmet
    5: 6,   # no_glove -> no_gloves
    6: 7,   # no_goggles -> no_goggle
    7: 8,   # no_helmet -> no_helmet
    9: 5,   # no_shoes -> no_boots
    10: 1,  # shoes -> boots
}

OUT_DIR = "merged"
SPLITS = ["train", "valid", "test"]


def copy_split(src_dir, split, prefix="", remap=None):
    img_dir = os.path.join(src_dir, split, "images")
    lbl_dir = os.path.join(src_dir, split, "labels")
    out_img = os.path.join(OUT_DIR, split, "images")
    out_lbl = os.path.join(OUT_DIR, split, "labels")
    os.makedirs(out_img, exist_ok=True)
    os.makedirs(out_lbl, exist_ok=True)

    copied = skipped = 0
    for img_path in glob.glob(os.path.join(img_dir, "*.jpg")):
        stem = os.path.splitext(os.path.basename(img_path))[0]
        lbl_path = os.path.join(lbl_dir, stem + ".txt")
        if not os.path.exists(lbl_path):
            continue

        with open(lbl_path) as f:
            lines = [l.strip() for l in f if l.strip()]

        if remap is not None:
            new_lines = []
            for line in lines:
                parts = line.split()
                cls_id = int(parts[0])
                if cls_id not in remap:
                    continue  # mask/suit/no-suit/no_mask -> bỏ
                new_lines.append(" ".join([str(remap[cls_id])] + parts[1:]))
            if not new_lines:
                skipped += 1
                continue  # ảnh chỉ có lớp không dùng -> bỏ cả ảnh, tránh nhiễu nhãn rỗng
            lines = new_lines

        out_name = prefix + stem
        shutil.copy2(img_path, os.path.join(out_img, out_name + ".jpg"))
        with open(os.path.join(out_lbl, out_name + ".txt"), "w") as f:
            f.write("\n".join(lines) + "\n")
        copied += 1

    return copied, skipped


def main():
    total_copied = total_skipped = 0
    for split in SPLITS:
        c1, _ = copy_split("detech_ppe", split)
        c2, s2 = copy_split("ppes", split, prefix="ppes_", remap=PPES_TO_BASE)
        print(f"{split}: detech_ppe={c1} ảnh, ppes={c2} ảnh giữ lại "
              f"({s2} ảnh bị bỏ vì chỉ có mask/suit)")
        total_copied += c1 + c2
        total_skipped += s2

    yaml_content = f"""train: ../train/images
val: ../valid/images
test: ../test/images

nc: {len(BASE_NAMES)}
names: {BASE_NAMES}
"""
    with open(os.path.join(OUT_DIR, "data.yaml"), "w") as f:
        f.write(yaml_content)

    print(f"\nTổng: {total_copied} ảnh ghép vào {OUT_DIR}/, {total_skipped} ảnh bỏ qua.")
    print(f"data.yaml: {OUT_DIR}/data.yaml")


if __name__ == "__main__":
    main()
