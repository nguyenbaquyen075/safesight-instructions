#!/usr/bin/env bash
# Tạo issue + PR trên GitHub cho các nhánh feat/* của lộ trình v0.9 từ docs/github/{issues,prs}/*.md.
# Cần: GH_TOKEN (scope repo); script tự push bằng token, không cần git credential. Dùng: GH_TOKEN=... scripts/github-open-issues-prs.sh [slug ...]
# Đặt INTEGRATION_BRANCH=integration/v0.9 để mở thêm PR tổng (nội dung docs/github/prs/integration-v0.9.md) sau các PR tính năng.
# Mỗi slug: docs/github/issues/<slug>.md (dòng đầu "# <tiêu đề>", phần còn lại là nội dung) và
# docs/github/prs/feat-<slug>.md (tuỳ chọn dòng đầu "# <tiêu đề PR>", có "Closes #<n>" để script điền số issue).
set -euo pipefail
REPO="${REPO:-nguyenbaquyen075/safesight-instructions}"
BASE="${BASE:-main}"
: "${GH_TOKEN:?Thiếu GH_TOKEN}"
api() { curl -sS -X "$1" "https://api.github.com/repos/$REPO$2" \
  -H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" "${@:3}"; }
export GH_TOKEN
# Push qua token trong env (helper đọc GH_TOKEN, không ghi token ra đĩa hay dòng lệnh)
push() { git -c "credential.helper=!f() { echo username=x-access-token; echo password=\$GH_TOKEN; }; f" push -u origin "$1" >/dev/null 2>&1; }

slugs=("$@")
if [ ${#slugs[@]} -eq 0 ]; then for f in docs/github/issues/*.md; do slugs+=("$(basename "$f" .md)"); done; fi

for slug in "${slugs[@]}"; do
  issue_file="docs/github/issues/$slug.md"; pr_file="docs/github/prs/feat-$slug.md"; branch="feat/$slug"
  [ -f "$issue_file" ] || { echo "bỏ qua $slug: thiếu $issue_file"; continue; }
  title=$(head -1 "$issue_file" | sed 's/^# *//')
  body=$(tail -n +2 "$issue_file")
  # Tránh tạo trùng: tìm issue mở cùng tiêu đề
  existing=$(api GET "/issues?state=open&labels=enhancement&per_page=100" | python3 -c "import json,sys; t=sys.argv[1]; print(next((i['number'] for i in json.load(sys.stdin) if i.get('title')==t and 'pull_request' not in i), ''))" "$title")
  if [ -n "$existing" ]; then num=$existing; echo "issue #$num đã có: $title"; else
    num=$(api POST "/issues" -d "$(python3 -c 'import json,sys; print(json.dumps({"title": sys.argv[1], "body": sys.argv[2], "labels": ["enhancement", "v0.9"]}))' "$title" "$body")" | python3 -c "import json,sys; print(json.load(sys.stdin)['number'])")
    echo "issue #$num: $title"
  fi
  if git show-ref --verify --quiet "refs/heads/$branch"; then
    push "$branch" && echo "đã push $branch" || echo "push $branch thất bại (kiểm tra credential)"
  else echo "không có nhánh $branch"; continue; fi
  if [ -f "$pr_file" ]; then
    pr_title=$(head -1 "$pr_file" | grep '^# ' | sed 's/^# *//' || true); [ -n "$pr_title" ] || pr_title="$title"
    pr_body=$(sed "s/Closes #<n>/Closes #$num/; s/Closes #\\[n\\]/Closes #$num/" "$pr_file" | { if head -1 "$pr_file" | grep -q '^# '; then tail -n +2; else cat; fi; })
    exists=$(api GET "/pulls?state=open&head=${REPO%%/*}:$branch" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['html_url'] if d else '')")
    if [ -n "$exists" ]; then echo "PR đã có: $exists"; else
      url=$(api POST "/pulls" -d "$(python3 -c 'import json,sys; print(json.dumps({"title": sys.argv[1], "head": sys.argv[2], "base": sys.argv[3], "body": sys.argv[4]}))' "$pr_title" "$branch" "$BASE" "$pr_body")" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('html_url') or d)")
      echo "PR: $url"
    fi
  fi
done

if [ -n "${INTEGRATION_BRANCH:-}" ] && [ -f docs/github/prs/integration-v0.9.md ]; then
  push "$INTEGRATION_BRANCH" && echo "đã push $INTEGRATION_BRANCH" || echo "push $INTEGRATION_BRANCH thất bại"
  exists=$(api GET "/pulls?state=open&head=${REPO%%/*}:$INTEGRATION_BRANCH" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['html_url'] if d else '')")
  if [ -n "$exists" ]; then echo "PR tổng đã có: $exists"; else
    url=$(api POST "/pulls" -d "$(python3 -c 'import json,sys; print(json.dumps({"title": sys.argv[1], "head": sys.argv[2], "base": sys.argv[3], "body": open(sys.argv[4]).read()}))' "v0.9 integration: nine roadmap features and the review fix wave" "$INTEGRATION_BRANCH" "$BASE" docs/github/prs/integration-v0.9.md)" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('html_url') or d)")
    echo "PR tổng: $url"
  fi
fi
