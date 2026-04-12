# Docker Deployment Guide

The final submission uses separate Dockerfiles for each deployed service.

## Layout

```text
apps/expo-frontend       Expo web build served by nginx
apps/scheduling-service  FastAPI scheduling service
apps/messaging-service   FastAPI messaging service
apps/snapshot-service    FastAPI snapshot service
apps/rag-service         FastAPI RAG service
dev-tools/               Local reset/seed helpers and development utilities
infra/                   Render config and docker compose
```

## Dockerfiles

- `apps/expo-frontend/Dockerfile`
- `apps/scheduling-service/Dockerfile`
- `apps/messaging-service/Dockerfile`
- `apps/snapshot-service/Dockerfile`
- `apps/rag-service/Dockerfile`

## Local Docker

```bash
docker compose -f infra/docker-compose.yml up --build
```

This starts:

1. frontend on `http://localhost:8081`
2. scheduling on `http://localhost:8000`
3. RAG on `http://localhost:8001`
4. messaging on `http://localhost:8002`
5. snapshot on `http://localhost:8003`

## Render

`infra/render.yaml` now defines five separate web services:

1. `skeduleit-front`
2. `skeduleit`
3. `skeduleit-messaging`
4. `skeduleit-snapshots`
5. `skeduleit-rag`

Important runtime environment variables:

```env
FIREBASE_CREDENTIALS=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
GEMINI_API_KEY=...
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19000,http://localhost:19006,https://skeduleit-front.onrender.com
```

## Notes

- The old Express proxy server has been removed.
- The frontend now talks directly to the dedicated service URLs.
- Frontend build output is generated in `apps/expo-frontend/dist`.
- `dev-tools` remains in the repo for reset/seed utilities and other local-only development helpers.
