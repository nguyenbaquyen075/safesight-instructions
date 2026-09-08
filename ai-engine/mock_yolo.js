// SPDX-License-Identifier: MIT

const path = require('path');
// Cùng thứ tự yolo_bridge.js đọc — bridge giờ đòi header X-AI-Engine-Secret nếu có cấu hình.
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const BRIDGE_URL = "http://localhost:4001/detections";
const AI_ENGINE_SECRET = process.env.AI_ENGINE_SECRET?.trim() || '';
const CAMERA_IDS = ["cam-001", "cam-002", "cam-003", "cam-004", "cam-005", "cam-006"];

const labels = ["No Helmet", "No Vest", "Person", "Safety Vest", "Hard Hat"];

function getRandomBbox() {
  return {
    top: (Math.random() * 60 + 10).toFixed(2) + "%",
    left: (Math.random() * 60 + 10).toFixed(2) + "%",
    width: (Math.random() * 20 + 10).toFixed(2) + "%",
    height: (Math.random() * 20 + 10).toFixed(2) + "%"
  };
}

async function sendMockDetections() {
  for (const camId of CAMERA_IDS) {
    const numDetections = Math.floor(Math.random() * 3) + 1;
    const detections = [];

    for (let i = 0; i < numDetections; i++) {
      const label = labels[Math.floor(Math.random() * labels.length)];
      const isViolation = label.includes("No");
      
      detections.push({
        id: `mock-${Math.random().toString(36).substr(2, 9)}`,
        type: isViolation ? "violation" : "detection",
        label: label,
        confidence: Number((Math.random() * 0.25 + 0.7).toFixed(2)),
        isViolation: isViolation,
        bbox: getRandomBbox(),
        snapshotUrl: isViolation ? "/no_helmet.png" : null
      });
    }

    try {
      await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(AI_ENGINE_SECRET ? { 'X-AI-Engine-Secret': AI_ENGINE_SECRET } : {})
        },
        body: JSON.stringify({
          cameraId: camId,
          detections: detections
        })
      });
    } catch (err) {
      // Bridge might be down
    }
  }
}

console.log("🚀 Mock YOLO Data Generator started...");
console.log("Sending fake detections to http://localhost:4001/detections every 2 seconds");

setInterval(sendMockDetections, 2000);
sendMockDetections(); // Initial call
