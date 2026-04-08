#!/bin/bash

set -e

echo "========================================"
echo "Starting RAG server on port 8001..."
echo "========================================"

cd /app/apps/rag-server
python3 -m uvicorn main:app --host 0.0.0.0 --port 8001 &
RAG_PID=$!
echo "RAG server started with PID $RAG_PID"

echo "Waiting for RAG server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8001/api/health > /dev/null 2>&1; then
        echo "RAG server is ready!"
        break
    fi
    sleep 1
done

echo "========================================"
echo "Starting FastAPI backend on port 8000..."
echo "========================================"

cd /app/apps/api
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "FastAPI backend started with PID $BACKEND_PID"

echo "Waiting for FastAPI backend to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "FastAPI backend is ready!"
        break
    fi
    sleep 1
done

echo "========================================"
echo "Starting Express server on port ${PORT:-8081}..."
echo "========================================"

cd /app
npm run serve
