#!/usr/bin/env bash
# start.sh  macOS launcher for the controller bridge.
#
# Creates a venv if needed, installs deps, and runs the bridge against the
# server. Pass extra args through, e.g.:
#     ./start.sh --server http://192.168.1.20:3000 --verbose
set -euo pipefail

cd "$(dirname "$0")"

PY="${PYTHON:-python3}"
VENV=".venv"

if [ ! -d "$VENV" ]; then
  echo "creating venv…"
  "$PY" -m venv "$VENV"
fi

# shellcheck disable=SC1091
"$VENV/bin/pip" install -q -r requirements.txt

echo "starting mac bridge…"
exec "$VENV/bin/python" bridge.py --platform mac "$@"
