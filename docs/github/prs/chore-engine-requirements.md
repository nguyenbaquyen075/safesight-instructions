## Tóm tắt
- `ai-engine/requirements.txt` ghim đúng phiên bản Python đang chạy (torch, torchvision, ultralytics, opencv-python, numpy, requests) để tái lập môi trường và audit CVE được.

## Issue
Closes #<n>

## Thay đổi chính
- `ai-engine/requirements.txt` (mới, kèm cách làm mới bằng `pip freeze`); README cài bằng `pip install -r`; CONTRIBUTING nhắc ghim gói mới; wiki/03 hướng dẫn chạy `pip-audit` thủ công. Không đổi code.

## Kiểm thử
- [x] `python3 -m py_compile ai-engine/*.py` (không đổi)

## Tài liệu
README, CONTRIBUTING, wiki/03, CHANGELOG.

## Rủi ro và việc còn lại
- `pip-audit` chưa chạy được trên máy phát triển (chưa cài); chạy thủ công theo wiki/03.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
