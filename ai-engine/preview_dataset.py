# SPDX-License-Identifier: MIT

import cv2
import os

IMG_DIR = "training/dataset/images/train"
LBL_DIR = "training/dataset/labels/train"

# Class configuration
CLASS_NAMES = {
    0: "Mu (Helmet)",
    1: "Ao (Vest)",
    2: "Khong Mu (No Helmet)",
    3: "Khong Ao (No Vest)",
    4: "Nguoi (Person)"
}

COLORS = {
    0: (0, 255, 0),    # helmet: Green
    1: (255, 165, 0),  # vest: Orange
    2: (0, 0, 255),    # no_helmet: Red
    3: (0, 255, 255),  # no_vest: Yellow
    4: (255, 0, 255)   # person: Magenta
}

for file in os.listdir(IMG_DIR):
    if not file.endswith(".jpg"):
        continue

    img_path = os.path.join(IMG_DIR, file)
    lbl_path = os.path.join(LBL_DIR, file.replace(".jpg", ".txt"))

    img = cv2.imread(img_path)
    if img is None:
        continue
        
    h, w, _ = img.shape

    if os.path.exists(lbl_path):
        with open(lbl_path, "r") as f:
            for line in f:
                parts = line.split()
                if not parts:
                    continue
                    
                cls = int(float(parts[0]))
                x, y, bw, bh = map(float, parts[1:])

                x1 = int((x - bw/2) * w)
                y1 = int((y - bh/2) * h)
                x2 = int((x + bw/2) * w)
                y2 = int((y + bh/2) * h)

                color = COLORS.get(cls, (255, 255, 255))
                name = CLASS_NAMES.get(cls, f"ID:{cls}")

                # Draw bounding box
                cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
                
                # Draw label background
                label = f"{name}"
                (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(img, (x1, y1 - th - 5), (x1 + tw, y1), color, -1)
                
                # Draw text
                cv2.putText(img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)

    # Resize for display if too large
    max_display_width = 1280
    if w > max_display_width:
        ratio = max_display_width / w
        display_img = cv2.resize(img, (int(w * ratio), int(h * ratio)))
    else:
        display_img = img

    cv2.imshow("Dataset Preview - Press ESC to exit, Any key for next", display_img)

    key = cv2.waitKey(0)
    if key == 27: # ESC
        break

cv2.destroyAllWindows()
