# Docker Deployment Guide

The repo now keeps deployment files in `infra/` and app code in `apps/`.

## Layout

```text
apps/frontend     Expo app plus Express web server
apps/api          FastAPI API
apps/rag-server   FastAPI RAG service
infra/            Dockerfile, compose file, Render config, startup script
```

## Deployment Files

- `infra/Dockerfile`
- `infra/start.sh`
- `infra/render.yaml`
- `infra/docker-compose.yml`

## What the container runs

1. `apps/rag-server` on port `8001`
2. `apps/api` on port `8000`
3. `apps/frontend/server.js` on port `8081`

The Express server serves the Expo web build and proxies API and RAG requests to the local FastAPI processes.

## Local Docker

```bash
docker compose -f infra/docker-compose.yml up --build
```

## Render

Render should point at:

- Dockerfile: `infra/Dockerfile`
- Health check: `/health`

Important environment variables:

```env
EXPO_PUBLIC_API_URL=
FIREBASE_CREDENTIALS=...
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
EXPO_PUBLIC_FIREBASE_DATABASE_URL=...
GEMINI_API_KEY=...
NODE_ENV=production
```

For the combined Render deployment, leaving `EXPO_PUBLIC_API_URL` blank is intentional.
The web app will use the same-origin Express proxy on your Render domain, so API,
RAG, and WebSocket traffic all stay on one public origin.

## Notes

- Frontend build output is generated inside `apps/frontend/dist`.
- Python dependencies are installed from `apps/api/requirements.txt` and `apps/rag-server/requirements.txt`.
- The container startup sequence is defined in `infra/start.sh`.
- `GET /health` now checks the Express process plus the internal FastAPI and RAG services.
