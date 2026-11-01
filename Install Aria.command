#!/usr/bin/env bash
# Double-click to install Aria (Oct 31, Ian: "a one click download so people can import it easily into Ableton").
# Opens in Terminal and runs install.sh from this folder. The first time, macOS may block it because it came from the
# internet: right-click it and choose Open.
cd "$(dirname "$0")"
xattr -dr com.apple.quarantine . 2>/dev/null || true   # so Live and Max can load the devices and scripts in here
./install.sh "$@"
status=$?
if [ $status -eq 0 ] && grep -q '^MODEL_API_KEY=$' engine/.env 2>/dev/null; then
  echo
  echo "Opening engine/.env: paste your Meta Model API key after MODEL_API_KEY= and save."
  open -e engine/.env
fi
echo
read -n 1 -s -r -p "Press any key to close this window."
exit $status
