#!/usr/bin/env bash
# End-to-end run: mock TMDB (:3999) → API (:3001) → built frontend (:3997)
# → Playwright scenario in a real Chromium.
#
#   bash e2e/run.sh                  # builds the frontend, then runs the scenario
#   E2E_SKIP_BUILD=1 bash e2e/run.sh # reuse the existing project/dist
#
# Requirements: `npm install` done in backend/, project/ and e2e/. Playwright
# resolves its own Chromium; set E2E_CHROMIUM to use a system binary instead
# (e.g. E2E_CHROMIUM=/opt/pw-browsers/chromium on CI images that pre-install it).
set -euo pipefail

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$E2E_DIR")"
ART="$E2E_DIR/.artifacts"
DATA="$ART/data"

# `exec` in the subshells makes each PID the real server process, but vite
# spawns children of its own: sweep by pattern as a belt-and-braces.
cleanup() {
  [[ -n "${MOCK_PID:-}" ]] && kill "$MOCK_PID" 2>/dev/null || true
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
  pkill -f "e2e/mock-tmdb.cjs" 2>/dev/null || true
  pkill -f "vite preview --port 3997" 2>/dev/null || true
}
trap cleanup EXIT

rm -rf "$DATA" && mkdir -p "$DATA"

echo "[e2e] mock TMDB :3999"
node "$E2E_DIR/mock-tmdb.cjs" 3999 >"$ART/mock.log" 2>&1 &
MOCK_PID=$!

# The default build (no VITE_API_URL) targets http://localhost:3001, so the
# backend listens there and any plain `npm run build` output is E2E-ready.
echo "[e2e] backend :3001"
(cd "$REPO/backend" && \
  TMDB_BASE_URL=http://localhost:3999/3 \
  TMDB_API_KEY=e2e-key \
  JWT_SECRET=e2e-secret \
  DATA_DIR="$DATA" \
  TMDB_CACHE_PERSIST=0 \
  PORT=3001 \
  exec node server.js >"$ART/api.log" 2>&1) &
API_PID=$!

if [[ "${E2E_SKIP_BUILD:-0}" != "1" ]]; then
  echo "[e2e] building frontend"
  (cd "$REPO/project" && npm run build >"$ART/build.log" 2>&1)
fi

echo "[e2e] preview :3997"
(cd "$REPO/project" && exec npx vite preview --port 3997 --strictPort >"$ART/web.log" 2>&1) &
WEB_PID=$!

ok=0
for _ in $(seq 1 30); do
  ok=1
  curl -sf http://localhost:3999/3/genre/movie/list >/dev/null 2>&1 || ok=0
  curl -sf http://localhost:3001/api/health >/dev/null 2>&1 || ok=0
  curl -sf http://localhost:3997/ >/dev/null 2>&1 || ok=0
  [[ $ok == 1 ]] && break
  sleep 1
done
[[ $ok == 1 ]] || { echo "[e2e] services failed to start"; tail -n 5 "$ART"/{mock,api,web}.log; exit 1; }

echo "[e2e] running Playwright scenario"
(cd "$E2E_DIR" && node scenario.mjs)
