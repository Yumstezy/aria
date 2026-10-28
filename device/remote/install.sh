#!/usr/bin/env bash
# Copy Aria's Remote Script and Aria Ear into Live's User Library, so "Listen to my key tracks" can put an
# Ear on each key track. Then, once, in Live: Settings > Link, Tempo & MIDI > Control Surface: Aria
# (Input and Output: None).
set -euo pipefail
DEST="$HOME/Music/Ableton/User Library/Remote Scripts/Aria"
mkdir -p "$DEST"
cp "$(dirname "$0")/Aria/__init__.py" "$DEST/__init__.py"
EAR="$HOME/Music/Ableton/User Library/Presets/Audio Effects/Max Audio Effect/Aria"
mkdir -p "$EAR"
cp "$(dirname "$0")/../Aria Ear.amxd" "$(dirname "$0")/../ear.js" "$EAR/"
echo "Copied Aria's Remote Script to $DEST and Aria Ear to $EAR. Restart Live if it was open."
