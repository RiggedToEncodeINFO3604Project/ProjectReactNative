#!/bin/bash

echo "========================================"
echo "Starting FastAPI backend on port 8000..."
echo "========================================"

cd /app/backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "FastAPI started with PID $BACKEND_PID"

# Wait for FastAPI to be ready
echo "Waiting for FastAPI to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "FastAPI is ready!"
        break
    fi
    sleep 1
done

echo "========================================"
echo "Starting Express server on port ${PORT:-8081}..."
echo "========================================"

cd /app
npm run serve
