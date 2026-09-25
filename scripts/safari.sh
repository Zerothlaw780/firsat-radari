#!/usr/bin/env bash
# Safari sürümü için Xcode projesi oluşturur. Mac'te, Xcode kuruluyken çalıştır:
#   ./scripts/safari.sh
# Proje safari/ klasörüne yazılır ve extension/ klasöründeki dosyaları kullanır;
# eklentide bir değişiklik yapınca Xcode'da tekrar Run (⌘R) demen yeterli.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v xcrun >/dev/null || ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "Xcode bulunamadı. App Store'dan Xcode'u kurup bir kez açtıktan sonra tekrar dene." >&2
  exit 1
fi

xcrun safari-web-extension-converter extension \
  --project-location safari \
  --app-name "Firsat Radari" \
  --bundle-identifier io.github.zerothlaw780.firsatradari \
  --macos-only \
  --swift \
  --no-prompt \
  --force
