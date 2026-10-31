#!/usr/bin/env bash
# Install Aria, once (Oct 31, Ian: "can it be downloaded like a plugin so it sits inside of Ableton, so you can just
# drag and drop it"):
#   1. the engine: Python 3.11, its libraries, engine/.env
#   2. Live's browser: Aria and Aria Ear in your User Library (Presets > Audio Effects > Max Audio Effect > Aria),
#      to drag onto a track like any effect. They're links to this folder, so pulling updates updates them too.
#   3. Aria's Remote Script (for "Listen to my key tracks")
# Then open Live. Aria starts its engine by itself when it needs it. ./install.sh --start also starts it now.
set -euo pipefail
REPO="$(cd "$(dirname "$0")" && pwd)"

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# ---------- 1. The engine ----------
step "1 of 3  The engine"
cd "$REPO/engine"
PY=""
for candidate in python3.11 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.11; do
  if command -v "$candidate" >/dev/null 2>&1; then PY="$candidate"; break; fi
done
if [ -z "$PY" ]; then
  echo "Python 3.11 not found. Install it with: brew install python@3.11, then run ./install.sh again." >&2
  exit 1
fi
if [ ! -d .venv ]; then
  echo "Creating engine/.venv with $("$PY" --version)"
  "$PY" -m venv .venv
fi
echo "Installing the engine's libraries"
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt
echo "Installing split mode (Meta's Demucs, about 800 MB, prototype only: see README)"
.venv/bin/pip install --quiet -r requirements-split.txt
if [ ! -f .env ]; then
  cp .env.example .env
  NEED_KEY=1
fi

# ---------- 2. Aria in Live's browser ----------
step "2 of 3  Aria in Live's browser"
# Where Live keeps the User Library: the newest Live's Library.cfg says (it can be moved), else the default
UL=""
CFG="$(ls -d "$HOME/Library/Preferences/Ableton/Live "*/Library.cfg 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$CFG" ]; then
  UL="$(/usr/bin/python3 - "$CFG" <<'PY' 2>/dev/null || true
import sys, xml.etree.ElementTree as ET
lib = ET.parse(sys.argv[1]).getroot().find(".//UserLibrary")
path, name = lib.find(".//ProjectPath").get("Value"), lib.find(".//ProjectName").get("Value")
print(f"{path}/{name}")
PY
)"
fi
UL="${UL:-$HOME/Music/Ableton/User Library}"
DEST="$UL/Presets/Audio Effects/Max Audio Effect/Aria"
mkdir -p "$DEST"
# Links, not copies: each device and the scripts it loads, from this folder (an older install's copies are replaced)
for f in "Aria.amxd" "Aria Ear.amxd" bridge.js live.js scope.js ear.js; do
  [ -e "$DEST/$f" ] && [ ! -L "$DEST/$f" ] && rm "$DEST/$f"
  ln -sfn "$REPO/device/$f" "$DEST/$f"
done
echo "Aria and Aria Ear are in Live's browser: User Library > Presets > Audio Effects > Max Audio Effect > Aria"

# Where this folder is, for the bridge (it finds the engine and the screens from here)
mkdir -p "$HOME/Library/Application Support/Aria"
printf '{"repo": "%s"}\n' "$REPO" > "$HOME/Library/Application Support/Aria/install.json"

# ---------- 3. The Remote Script ----------
step "3 of 3  Aria's Remote Script"
RS="$UL/Remote Scripts/Aria"
mkdir -p "$RS"
cp "$REPO/device/remote/Aria/__init__.py" "$RS/__init__.py"
echo "Copied. In Live, once: Settings > Link, Tempo & MIDI > Control Surface: Aria (Input and Output: None)."

step "Done"
if [ "${NEED_KEY:-0}" = 1 ]; then
  echo "Put your Muse Spark key in engine/.env (MODEL_API_KEY=...). Aria shows the measurements without it, but no advice."
fi
echo "Open Live (restart it if it was open), find Aria in the browser, and drag it onto your Main track, last."
echo "Aria Ear goes on any track you want Aria to know by name, or Aria adds them with Name my tracks."

if [ "${1:-}" = "--start" ]; then
  echo "Starting the engine on http://127.0.0.1:8765 (Ctrl+C to stop)"
  exec "$REPO/engine/run.sh"
fi
