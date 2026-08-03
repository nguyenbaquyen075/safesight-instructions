# SPDX-License-Identifier: MIT

import cv2
import os
import glob
from ultralytics import YOLO

# Configuration - Paths are relative to project root
VIDEO_DIR = "public/videos"
OUTPUT_DIR = "training/dataset"
MODEL_PATH = "ppe_v8s_custom.pt"
FRAME_INTERVAL = 30  # Extract every 30 frames
CONF_THRESHOLD = 0.7

# Class mapping from existing model to new dataset classes
CLASS_MAPPING = {
    0: 0, # Hardhat -> helmet
    7: 1, # Safety Vest -> vest
    2: 2, # NO-Hardhat -> no_helmet
    4: 3, # NO-Safety Vest -> no_vest
    5: 4  # Person -> person
}

def generate_dataset():
    """Extract frames from test1.mp4 and auto-label them."""
    print(f"🔍 Loading model: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        print(f"❌ Error: Model not found at {MODEL_PATH}")
        return

    model = YOLO(MODEL_PATH)
    
    # Ensure directories exist
    os.makedirs(os.path.join(OUTPUT_DIR, "images/train"), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "labels/train"), exist_ok=True)
    
    video_files = [os.path.join(VIDEO_DIR, "test1.mp4")]
    if not os.path.exists(video_files[0]):
        print(f"⚠️ Video not found: {video_files[0]}")
        return

    total_images = 0
    for video_path in video_files:
        video_name = os.path.basename(video_path).split('.')[0]
        print(f"📹 Processing video: {video_name}")
        
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"❌ Could not open {video_path}")
            continue
            
        frame_count = 0
        saved_in_video = 0
        
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break
            
            if frame_count % FRAME_INTERVAL == 0:
                results = model(frame, conf=CONF_THRESHOLD, verbose=False)[0]
                
                yolo_labels = []
                for box in results.boxes:
                    cls_id = int(box.cls[0])
                    if cls_id in CLASS_MAPPING:
                        new_cls_id = CLASS_MAPPING[cls_id]
                        xywh = box.xywhn[0].tolist()
                        yolo_labels.append(f"{new_cls_id} {xywh[0]:.6f} {xywh[1]:.6f} {xywh[2]:.6f} {xywh[3]:.6f}")
                
                if yolo_labels:
                    img_filename = f"{video_name}_f{frame_count:06d}.jpg"
                    lbl_filename = f"{video_name}_f{frame_count:06d}.txt"
                    
                    img_path = os.path.join(OUTPUT_DIR, "images/train", img_filename)
                    lbl_path = os.path.join(OUTPUT_DIR, "labels/train", lbl_filename)
                    
                    cv2.imwrite(img_path, frame)
                    with open(lbl_path, 'w') as f:
                        f.write("\n".join(yolo_labels))
                    
                    saved_in_video += 1
                    total_images += 1
            
            frame_count += 1
        
        cap.release()
        print(f"✅ Extracted {saved_in_video} labeled frames from {video_name}")

    print(f"\n✨ Dataset generation complete! Total images: {total_images}")

if __name__ == "__main__":
    generate_dataset()
