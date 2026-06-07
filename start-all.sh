#!/usr/bin/env bash
# start-all.sh  launch the whole stack: server (3000), client (3001), bridge.
# Installs deps on first run.  Ctrl+C stops everything.
#
#   ./start-all.sh
#
# Env overrides:
#   SERVER_PORT=3000  CLIENT_PORT=3001   change ports
#   NO_BRIDGE=1                          skip the bridge (e.g. non-Mac host)
#   BRIDGE_ARGS="--platform windows"     extra args forwarded to the bridge

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_PORT="${SERVER_PORT:-3000}"
CLIENT_PORT="${CLIENT_PORT:-3001}"

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo localhost)"

pids=()

cleanup() {
  echo ""
  echo "stopping…"
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  lsof -ti "tcp:$SERVER_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti "tcp:$CLIENT_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  wait 2>/dev/null || true
  echo "all stopped."
}
trap cleanup INT TERM EXIT

# --- deps (first run only) ---
if [ ! -d "$ROOT/server/node_modules" ]; then
  echo "installing server deps…"
  (cd "$ROOT/server" && npm install)
fi
if [ ! -d "$ROOT/client/node_modules" ]; then
  echo "installing client deps…"
  (cd "$ROOT/client" && npm install)
fi

# --- server ---
echo "starting server on :$SERVER_PORT…"
(cd "$ROOT/server" && exec npx next dev -H 0.0.0.0 -p "$SERVER_PORT") &
pids+=($!)

# --- client ---
echo "starting client on :$CLIENT_PORT…"
(cd "$ROOT/client" && exec npx next dev -H 0.0.0.0 -p "$CLIENT_PORT") &
pids+=($!)

# --- bridge (poll until server responds, then start) ---
if [ "${NO_BRIDGE:-0}" != "1" ]; then
  (
    echo "waiting for server…"
    for i in $(seq 1 120); do
      if curl -sf -o /dev/null "http://localhost:$SERVER_PORT/api/input" 2>/dev/null; then
        break
      fi
      sleep 0.5
    done
    echo "starting bridge…"
    cd "$ROOT/bridge"
    exec ./start.sh --server "http://localhost:$SERVER_PORT" ${BRIDGE_ARGS:-}
  ) &
  pids+=($!)
fi

cat <<EOF

────────────────────────────────────────────────────────────
  Monitor:    http://localhost:$SERVER_PORT
  Receiver:   http://localhost:$SERVER_PORT/receive   (Direct/WebRTC)
  Controller: http://$LAN_IP:$CLIENT_PORT             (open on your phone)
              set the server URL to http://$LAN_IP:$SERVER_PORT
  Press Ctrl+C to stop everything.
────────────────────────────────────────────────────────────

EOF

# Keep script alive until all children exit or Ctrl+C
wait
