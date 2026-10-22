#!/usr/bin/env bash
# WeaponDetect Lab — one-command launcher.
# Starts the FastAPI backend (with the model configured in backend/.env)
# and the Vite frontend together, waits until both answer, and stops
# both on Ctrl+C.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"

if [ ! -x backend/.venv/bin/python ]; then
  echo "Backend venv missing. Set it up first (see README → Setup):"
  echo "  cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
if [ ! -d frontend/node_modules ]; then
  echo "Frontend dependencies missing. Install them first:"
  echo "  cd frontend && npm install"
  exit 1
fi
if [ ! -f backend/.env ]; then
  echo "Note: backend/.env not found — the backend will use defaults"
  echo "      (MODEL_PATH=yolov8n, the COCO baseline). Copy .env.example"
  echo "      to backend/.env and point MODEL_PATH at models/best.pt to"
  echo "      serve the trained weapon model."
fi

cleanup() {
  echo
  echo "Stopping WeaponDetect Lab..."
  kill "${API_PID:-}" "${WEB_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Backend  (FastAPI + model)  http://127.0.0.1:${API_PORT}"
( cd backend && exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port "${API_PORT}" ) &
API_PID=$!

echo "==> Frontend (Vite)             http://127.0.0.1:${WEB_PORT}"
( cd frontend && exec ./node_modules/.bin/vite --host 127.0.0.1 --port "${WEB_PORT}" ) &
WEB_PID=$!

echo "Waiting for both services to answer..."
for _ in $(seq 1 90); do
  if curl -sf "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1 \
     && curl -sf "http://127.0.0.1:${WEB_PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo
echo "  WeaponDetect Lab is running:"
echo "    Frontend  →  http://localhost:${WEB_PORT}"
echo "    Backend   →  http://localhost:${API_PORT}   (API docs at /docs)"
echo
echo "  Press Ctrl+C to stop both."
wait
