#!/usr/bin/env bash
# Start the Aria engine on 127.0.0.1:8765. Run ./install.sh once first.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -x .venv/bin/uvicorn ]; then
  echo "The engine isn't installed yet. Run ./install.sh from the repo root first." >&2
  exit 1
fi

exec .venv/bin/uvicorn aria_engine.app:app --host 127.0.0.1 --port 8765 --env-file .env
