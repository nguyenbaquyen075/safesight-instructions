# Ghim phiên bản thư viện Python của AI engine
branch: chore/engine-requirements

## Vấn đề
Review health (`deps/python/no-requirements-lockfile`): `ai-engine/` không có `requirements.txt`,
README cài `ultralytics opencv-python requests` không ghim phiên bản nên không tái lập được môi
trường và không audit CVE được (`pip-audit`).

## Đề xuất
- `ai-engine/requirements.txt` ghim đúng phiên bản đang chạy trong venv phát triển; README/CONTRIBUTING/wiki/03 cập nhật cách cài và cách chạy `pip-audit` thủ công.

## Tiêu chí nghiệm thu
- [ ] `pip install -r ai-engine/requirements.txt` trên venv mới cho ra đúng bộ thư viện engine đang dùng.
- [ ] Không đổi code.
