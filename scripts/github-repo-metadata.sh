#!/usr/bin/env bash
# Đặt description, homepage và topics cho repo trên GitHub (cần GH_TOKEN có quyền repo).
# Dùng: GH_TOKEN=ghp_xxx scripts/github-repo-metadata.sh
set -euo pipefail
REPO="${REPO:-nguyenbaquyen075/safesight-instructions}"
: "${GH_TOKEN:?Thiếu GH_TOKEN}"
api() { curl -sS -X "$1" "https://api.github.com/repos/$REPO$2" \
  -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" "${@:3}"; }

api PATCH "" -d @- <<'JSON' >/dev/null
{
  "description": "🦺 SafeSight: Giám sát an toàn lao động bằng AI theo thời gian thực — YOLOv8 phát hiện thiếu mũ, áo, găng, giày bảo hộ; bằng chứng ảnh, cảnh báo Telegram/loa công trường, agent tự động trực vận hành và rà soát vi phạm. Next.js 16 + Prisma + Python.",
  "homepage": "https://nguyenbaquyen075.github.io/safesight-instructions/"
}
JSON
api PUT "/topics" -d @- <<'JSON' >/dev/null
{ "names": ["yolov8","ultralytics","computer-vision","object-detection","ppe-detection","workplace-safety","construction-safety","safety-monitoring","nextjs","react","typescript","prisma","socket-io","python","opencv","telegram-bot","ai-agent","claude","anthropic","real-time","dashboard","docker","open-source"] }
JSON
echo "Đã cập nhật description, homepage và topics cho $REPO"
