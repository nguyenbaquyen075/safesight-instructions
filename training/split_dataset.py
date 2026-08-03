# SPDX-License-Identifier: MIT

import os
import random
import shutil

def split_dataset(train_ratio=0.8):
    """
    Randomly splits the dataset from training/dataset/images/train into val/.
    Paths are relative to project root.
    """
    base_dir = "training/dataset"
    train_img_dir = os.path.join(base_dir, "images/train")
    train_lbl_dir = os.path.join(base_dir, "labels/train")
    
    val_img_dir = os.path.join(base_dir, "images/val")
    val_lbl_dir = os.path.join(base_dir, "labels/val")
    
    os.makedirs(val_img_dir, exist_ok=True)
    os.makedirs(val_lbl_dir, exist_ok=True)
    
    if not os.path.exists(train_img_dir):
        print(f"❌ Error: Training directory {train_img_dir} does not exist.")
        return

    images = [f for f in os.listdir(train_img_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    
    if not images:
        print(f"⚠️ No images found in {train_img_dir}")
        return

    print(f"📦 Total images found: {len(images)}")
    
    random.shuffle(images)
    split_idx = int(len(images) * train_ratio)
    val_images = images[split_idx:]
    
    print(f"✂️ Moving {len(val_images)} images to validation set...")
    
    count = 0
    for img_name in val_images:
        label_name = os.path.splitext(img_name)[0] + ".txt"
        
        src_img = os.path.join(train_img_dir, img_name)
        src_lbl = os.path.join(train_lbl_dir, label_name)
        
        dst_img = os.path.join(val_img_dir, img_name)
        dst_lbl = os.path.join(val_lbl_dir, label_name)
        
        if os.path.exists(src_img):
            shutil.move(src_img, dst_img)
        if os.path.exists(src_lbl):
            shutil.move(src_lbl, dst_lbl)
            count += 1
            
    print(f"✅ Successfully moved {count} image/label pairs to validation.")

if __name__ == "__main__":
    split_dataset()
