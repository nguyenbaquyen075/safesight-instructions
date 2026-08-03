# SPDX-License-Identifier: MIT

from ultralytics import YOLO
import os

def main():
    # Load the base YOLOv8n model
    # Paths are relative to project root
    model_path = "yolov8n.pt"
    if not os.path.exists(model_path):
        print(f"📦 Base model {model_path} not found in root, downloading...")
        model = YOLO("yolov8n.pt") 
    else:
        model = YOLO(model_path)

    print("🚀 Starting training...")
    # Train the model
    # data path is relative to the directory where the command is run
    results = model.train(
        data="training/dataset/data.yaml",
        epochs=100,
        imgsz=640,
        batch=16,
        patience=20,
        name="ppe_custom_training",
        project="training/runs", # Results saved in training/runs/
        exist_ok=True
    )
    
    print(f"✅ Training complete. Results saved to training/runs/ppe_custom_training")

if __name__ == "__main__":
    main()