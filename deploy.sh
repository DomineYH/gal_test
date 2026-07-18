#!/usr/bin/env bash

# 에러 발생 시 스크립트 실행 중단
set -e

echo "🚀 빌드를 시작합니다..."
npm run build

echo "📂 빌드 결과물 디렉토리(dist)로 이동합니다..."
cd dist

echo "📦 Git 초기화 및 배포 커밋 생성 중..."
git init
git checkout -b main
git add -A
git commit -m 'deploy: update github pages'

echo "🌐 GitHub Pages로 푸시합니다..."
# 주의: 아래 명령어는 domineyh.github.io 저장소의 main 브랜치에 배포 결과물을 강제로 덮어씁니다.
# 만약 해당 저장소의 main 브랜치에 이미 원본 소스코드가 있다면 지워질 수 있으니, 
# 원본 소스는 'dev'나 'source' 등 다른 브랜치에 관리하시는 것을 권장합니다.

git push -f git@github.com:domineyh/domineyh.github.io.git main

# (선택) 만약 'galaga'와 같이 별도의 레포지토리를 만들어서 서비스하는 경우라면 
# 위 명령어를 주석 처리하고, 아래 명령어의 주석을 해제해서 gh-pages 브랜치에 배포하세요.
# git push -f git@github.com:domineyh/<저장소이름>.git main:gh-pages

cd -
echo "✅ 배포가 성공적으로 완료되었습니다!"
