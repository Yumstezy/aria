#!/usr/bin/env bash
# Copy Aria's Remote Script into Live's User Library, so Live can add plugins for Aria.
# Then, once, in Live: Settings > Link, Tempo & MIDI > Control Surface: Aria (Input and Output: None).
set -euo pipefail
DEST="$HOME/Music/Ableton/User Library/Remote Scripts/Aria"
mkdir -p "$DEST"
cp "$(dirname "$0")/Aria/__init__.py" "$DEST/__init__.py"
echo "Copied Aria's Remote Script to $DEST. Restart Live if it was open."
