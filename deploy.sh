#!/usr/bin/env bash

set -Eeuo pipefail

for required_command in gh git npm; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "❌ '$required_command' 명령어를 찾을 수 없습니다." >&2
    exit 1
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ GitHub CLI 인증이 필요합니다. 'gh auth login'을 먼저 실행하세요." >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

repository="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
IFS=$'\t' read -r github_name github_login github_id < <(
  gh api user --jq '[(.name // .login), .login, (.id | tostring)] | @tsv'
)

deploy_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$deploy_dir"
}
trap cleanup EXIT

echo "🚀 빌드를 시작합니다..."
npm run build

echo "📦 GitHub Pages 배포 커밋을 생성합니다..."
cp -R dist/. "$deploy_dir/"
# 이전 배포 스크립트가 dist에 남긴 Git 메타데이터는 복사본에서 제거합니다.
rm -rf "$deploy_dir/.git"
touch "$deploy_dir/.nojekyll"

git -C "$deploy_dir" init --quiet --initial-branch=gh-pages
git -C "$deploy_dir" config user.name "$github_name"
git -C "$deploy_dir" config user.email "${github_id}+${github_login}@users.noreply.github.com"
git -C "$deploy_dir" add -A
git -C "$deploy_dir" commit --quiet -m 'deploy: update GitHub Pages'

echo "🌐 ${repository}의 gh-pages 브랜치로 푸시합니다..."
gh auth setup-git
git -C "$deploy_dir" push --force "https://github.com/${repository}.git" HEAD:gh-pages

pages_source="$(
  gh api "repos/${repository}/pages" \
    --jq '[.source.branch, .source.path] | join(":")' 2>/dev/null || true
)"
pages_source_changed=false

if [[ -z "$pages_source" ]]; then
  echo "⚙️ GitHub Pages를 활성화합니다..."
  gh api --method POST "repos/${repository}/pages" \
    -f 'source[branch]=gh-pages' \
    -f 'source[path]=/' >/dev/null
  pages_source_changed=true
elif [[ "$pages_source" != 'gh-pages:/' ]]; then
  echo "⚙️ GitHub Pages 소스를 gh-pages 브랜치로 변경합니다..."
  gh api --method PUT "repos/${repository}/pages" \
    -f 'source[branch]=gh-pages' \
    -f 'source[path]=/' >/dev/null
  pages_source_changed=true
fi

if [[ "$pages_source_changed" == true ]]; then
  echo "🏗️ 변경된 소스에서 GitHub Pages 빌드를 요청합니다..."
  gh api --method POST "repos/${repository}/pages/builds" >/dev/null
fi

echo "✅ 배포가 성공적으로 완료되었습니다!"
