# SPDX-License-Identifier: MIT
"""Đọc .env.local dùng chung cho các script trong ai-engine/."""

import os


def _read_env_file(path):
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


def load_dotenv_local():
    """Đọc .env.local rồi .env (KEY=VALUE) ở gốc repo nếu có, không ghi đè biến
    đã set qua shell — cùng thứ tự bridge (yolo_bridge.js) đọc, để engine và
    bridge luôn thấy chung AI_ENGINE_SECRET. Tự parse thay vì thêm dependency
    python-dotenv chỉ để đọc vài dòng KEY=VALUE."""
    _read_env_file(".env.local")
    _read_env_file(".env")
