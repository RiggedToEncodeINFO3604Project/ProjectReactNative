#!/bin/bash

set -euo pipefail

RAG_PID=""
BACKEND_PID=""
EXPRESS_PID=""

cleanup() {
    for pid in "$EXPRESS_PID" "$BACKEND_PID" "$RAG_PID"; do
        if [[ -n "${pid:-}" ]] && kill -0 "$pid" >/dev/null 2>&1; then
            kill "$pid" >/dev/null 2>&1 || true
        fi
    done
}

wait_for_url() {
    local name="$1"
    local url="$2"
    local attempts="${3:-30}"

    echo "Waiting for ${name} to be ready..."
    for ((i = 1; i <= attempts; i++)); do
        if curl -fsS "$url" >/dev/null 2>&1; then
            echo "${name} is ready!"
            return 0
        fi
        sleep 1
    done

    echo "${name} failed to become ready at ${url}" >&2
    return 1
}

trap cleanup EXIT INT TERM

echo "========================================"
echo "Starting Express server on port ${PORT:-8081}..."
echo "========================================"

cd /app
npm run serve &
EXPRESS_PID=$!
echo "Express server started with PID $EXPRESS_PID"

echo "========================================"
echo "Starting RAG server on port 8001..."
echo "========================================"

cd /app/apps/rag-service
python3 -m uvicorn main:app --host 127.0.0.1 --port 8001 &
RAG_PID=$!
echo "RAG server started with PID $RAG_PID"
wait_for_url "RAG server" "http://localhost:8001/api/health"

echo "========================================"
echo "Starting FastAPI backend on port 8000..."
echo "========================================"

cd /app/apps/api
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
echo "FastAPI backend started with PID $BACKEND_PID"
wait_for_url "FastAPI backend" "http://localhost:8000/health"

set +e
wait -n "$RAG_PID" "$BACKEND_PID" "$EXPRESS_PID"
EXIT_CODE=$?
set -e

echo "A service exited unexpectedly. Shutting down the container." >&2
exit "$EXIT_CODE"
