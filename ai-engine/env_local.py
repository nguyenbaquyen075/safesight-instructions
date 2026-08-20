# SPDX-License-Identifier: MIT
"""Đọc .env.local dùng chung cho các script trong ai-engine/."""

import os


def load_dotenv_local():
    """Đọc .env.local (KEY=VALUE) ở gốc repo nếu có, không ghi đè biến đã
    set qua shell. Tự parse thay vì thêm dependency python-dotenv chỉ để
    đọc vài dòng KEY=VALUE."""
    if not os.path.exists(".env.local"):
        return
    with open(".env.local", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())
