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
EXPO_PUBLIC_API_URL=https://your-app.onrender.com
MONGODB_URL=...
DATABASE_NAME=scheduling_db
SECRET_KEY=...
GEMINI_API_KEY=...
NODE_ENV=production
```

## Notes

- Frontend build output is generated inside `apps/frontend/dist`.
- Python dependencies are installed from `apps/api/requirements.txt` and `apps/rag-server/requirements.txt`.
- The container startup sequence is defined in `infra/start.sh`.
