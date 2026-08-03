# SPDX-License-Identifier: MIT

"""
Train model PPE nhiều lớp (đầu / áo / tay / chân) cho SafeSight.

Chạy trên Google Colab (GPU miễn phí) hoặc máy có GPU:
    pip install ultralytics
    python training/train_ppe.py

Kết quả model tốt nhất: runs/detect/train/weights/best.pt
→ Copy về gốc repo, đổi MODEL_PATH trong yolo_inference.py, cập nhật class_names trong ppe_tracker.py.
"""
from ultralytics import YOLO

def main():
    # yolov8s = cân bằng tốc độ/độ chính xác. Dùng yolov8n nếu máy yếu, yolov8m nếu cần chính xác hơn.
    model = YOLO("yolov8s.pt")

    model.train(
        data="training/data.yaml",
        epochs=100,
        imgsz=640,
        batch=16,
        patience=20,        # dừng sớm nếu 20 epoch không cải thiện
        project="runs/detect",
        name="ppe_multiclass",
    )

    # Đánh giá nhanh trên tập val
    metrics = model.val()
    print("mAP50-95:", metrics.box.map)

if __name__ == "__main__":
    main()
