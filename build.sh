#!/usr/bin/env bash
# Builds the two zips into dist/:
#   ad-rotator.zip       what customers get: empty ads/ folder, ready to fill
#   ad-rotator-demo.zip  same, with the two sample ads from samples/, for testing
# index.html sits at the zip root, as the HTML5 package upload requires.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dist="$here/dist"
rm -rf "$dist"
mkdir -p "$dist"

zip_dir() {
  (cd "$1" && zip -r -X -q "$2" . -x '.*' -x '*/.*' -x '__MACOSX/*')
}

zip_dir "$here/package" "$dist/ad-rotator.zip"

demo="$(mktemp -d)"
trap 'rm -rf "$demo"' EXIT
cp -R "$here/package/." "$demo/"
rm -f "$demo/ads/PUT-YOUR-ADS-HERE.txt"
cp "$here/samples/"* "$demo/ads/"
zip_dir "$demo" "$dist/ad-rotator-demo.zip"

for z in "$dist"/*.zip; do
  echo "== $(basename "$z")"
  unzip -Z1 "$z"
done
