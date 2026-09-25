#!/usr/bin/env bash
# Chrome'a yüklenebilecek zip'i dist/ klasörüne üretir.
set -euo pipefail
cd "$(dirname "$0")/.."
version=$(node -p "require('./extension/manifest.json').version")
mkdir -p dist
rm -f "dist/firsat-radari-$version.zip"
(cd extension && zip -rq "../dist/firsat-radari-$version.zip" . -x '.*')
echo "dist/firsat-radari-$version.zip"
