# SkeduleIt

SkeduleIt is a multi-app repository with an Expo frontend, a FastAPI API, and a separate FastAPI RAG service.

## Structure

```text
apps/
  frontend/      Expo app, web build, frontend tests
  api/           FastAPI API and API tests
  rag-server/    RAG service and RAG tests
docs/            Project and deployment docs
infra/           Docker, Render, and container startup files
scripts/         Windows helpers and repo automation
```

## Key Paths

- Frontend app: `apps/frontend`
- API service: `apps/api`
- RAG service: `apps/rag-server`
- Frontend tests: `apps/frontend/__tests__`
- API tests: `apps/api/tests`
- RAG tests: `apps/rag-server/tests`

## Local Development

Install repo dependencies from the root:

```bash
npm install
```

Start the frontend:

```bash
npm start
```

Start the API:

```bash
cd apps/api
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Start the RAG service:

```bash
cd apps/rag-server
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

On Windows, the convenience launchers now live in `scripts/`:

- `scripts\setup+update_dependances.bat`
- `scripts\start server.bat`
- `scripts\start frontend.bat`
- `scripts\start backend.bat`
- `scripts\start rag server.bat`

## Tests

Run everything from the repo root:

```bash
npm test
```

Or run each area separately:

```bash
npm run test:frontend
npm run test:api
npm run test:rag
```

## Deployment

Container and platform config now lives under `infra/`.

- Docker Compose: `infra/docker-compose.yml`
- Render: `infra/render.yaml`
- Combined container: `infra/Dockerfile`

Additional deployment notes are in `docs/DOCKER_README.md`.
