#!/usr/bin/env bash
# Make Aria-mac.zip, the one-click download (Oct 31): what a producer needs to run Aria and nothing else (no tests,
# test audio, design files or websites). Built from the last commit with git archive, so it's exactly what's in the
# repo and the installers keep their run permission. Upload it to a GitHub release:
#   scripts/release.sh && gh release create vX.Y release/Aria-mac.zip
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p release
OUT=release/Aria-mac.zip
rm -f "$OUT"
git archive --format=zip --prefix=Aria/ -o "$OUT" HEAD -- \
  "Install Aria.command" install.sh \
  "device/Aria.amxd" "device/Aria Ear.amxd" device/bridge.js device/live.js device/scope.js device/ear.js device/racks device/remote \
  ui/dist \
  engine/aria_engine engine/requirements.txt engine/requirements-split.txt engine/run.sh engine/.env.example
# The install guide, as "Read me first.txt" at the top of the folder (Ian, Nov 1: the zip's readme should be simple
# install steps, not the GitHub README). Plain text, so it opens cleanly in TextEdit.
TMP="$(mktemp -d)"
mkdir -p "$TMP/Aria"
cp scripts/install-guide.txt "$TMP/Aria/Read me first.txt"
(cd "$TMP" && zip -q "$OLDPWD/$OUT" "Aria/Read me first.txt")
rm -rf "$TMP"
echo "$OUT ($(du -h "$OUT" | cut -f1))"
unzip -l "$OUT" | tail -1
