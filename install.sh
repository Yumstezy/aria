#!/usr/bin/env bash
# Set up the Aria engine and start it on 127.0.0.1:8765.
set -euo pipefail
cd "$(dirname "$0")/engine"

# Find Python 3.11
PY=""
for candidate in python3.11 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.11; do
  if command -v "$candidate" >/dev/null 2>&1; then PY="$candidate"; break; fi
done
if [ -z "$PY" ]; then
  echo "Python 3.11 not found. Install it with: brew install python@3.11" >&2
  exit 1
fi

if [ ! -d .venv ]; then
  echo "Creating engine/.venv with $("$PY" --version)"
  "$PY" -m venv .venv
fi

echo "Installing engine dependencies"
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created engine/.env. Put your MODEL_API_KEY in it, then restart with engine/run.sh"
fi

echo "Starting the engine on http://127.0.0.1:8765 (Ctrl+C to stop)"
exec ./run.sh
