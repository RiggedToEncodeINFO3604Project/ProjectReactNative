# SkeduleIt

SkeduleIt is a multi-app repository organized around five services: the Expo frontend, core scheduling, messaging, customer snapshots, and RAG.

## Structure

```text
apps/
  frontend/              Expo app, web build, frontend tests
  scheduling-service/    Core scheduling and auth service
  messaging-service/     Messaging REST + WebSocket service
  snapshot-service/      Customer snapshot, notes, tags, auto-tagging
  rag-service/           RAG chatbot service
docs/            Project and deployment docs
infra/           Docker, Render, and container startup files
scripts/         Windows helpers and repo automation
```

## Key Paths

- Frontend app: `apps/frontend`
- Scheduling service: `apps/scheduling-service`
- Messaging service: `apps/messaging-service`
- Snapshot service: `apps/snapshot-service`
- RAG service: `apps/rag-service`
- Frontend tests: `apps/frontend/__tests__`
- Scheduling tests: `apps/scheduling-service/tests`
- Messaging tests: `apps/messaging-service/tests`
- Snapshot tests: `apps/snapshot-service/tests`
- RAG tests: `apps/rag-service/tests`

## Local Development

Install repo dependencies from the root:

```bash
npm install
```

Start the frontend:

```bash
npm start
```

Start the core scheduling service:

```bash
cd apps/scheduling-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Start the messaging service:

```bash
cd apps/messaging-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Start the snapshot service:

```bash
cd apps/snapshot-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Start the RAG service:

```bash
cd apps/rag-service
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
npm run test:scheduling
npm run test:messaging
npm run test:snapshot
npm run test:rag
```

## Deployment

Container and platform config now lives under `infra/`.

- Docker Compose: `infra/docker-compose.yml`
- Render: `infra/render.yaml`
- Combined container: `infra/Dockerfile`

Additional deployment notes are in `docs/DOCKER_README.md`.
