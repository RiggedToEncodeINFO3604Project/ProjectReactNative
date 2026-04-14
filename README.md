# SkeduleIt

SkeduleIt is a full-stack appointment booking platform built around an Expo frontend and a set of focused backend services for scheduling, messaging, customer snapshots, and AI-assisted support. The repository is organized as a monorepo so the mobile/web client, APIs, development tools, tests, and deployment configuration can evolve together.

This project supports two primary user roles:

- Customers can search for providers, review availability, book appointments, manage bookings, and message providers.
- Providers can define services, configure availability, manage pending and confirmed bookings, review customer snapshots, and use auto-tagging tools for customer insight.

An AI-powered support assistant is also available through the frontend and backed by a dedicated RAG service.

## Table of Contents

- [Overview](#overview)
- [What the App Does](#what-the-app-does)
- [How the App Works](#how-the-app-works)
- [Architecture](#architecture)
- [Structure](#structure)
- [Key Paths](#key-paths)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Development](#local-development)
- [Tests](#tests)
- [Development Utilities](#development-utilities)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

SkeduleIt is a multi-app repository organized around five services: the Expo frontend, core scheduling, messaging, customer snapshots, and RAG.

The frontend is built with Expo Router and can run on Android, iOS, and the web. The backend is split into independently deployable FastAPI services so booking logic, messaging, customer intelligence, and AI support can be scaled and maintained separately.

## What the App Does

### Customer experience

- Register and sign in
- Search for providers
- View provider availability and calendars
- Request bookings
- Review or cancel existing bookings
- Message providers directly
- Ask the support assistant questions about bookings, payments, cancellations, and platform policies

### Provider experience

- Register and sign in
- Create and manage services
- Set recurring availability and sync busy times
- Review pending booking requests
- Accept, reject, delete, or reschedule bookings
- View confirmed appointments in calendar-style flows
- Access customer snapshots with notes and tags
- Configure and refresh automatic customer tagging rules
- Message customers directly

### Platform services

- Firebase-backed authentication and data access
- Push token registration for notifications
- WebSocket-powered real-time messaging
- Snapshot enrichment with notes, tags, and auto-tagging
- Retrieval-augmented chatbot responses through the RAG service

## How the App Works

At a high level, the platform works like this:

1. The Expo frontend authenticates users through Firebase-aware flows and stores the active session on the client.
2. The scheduling service handles registration, sign-in exchange, services, availability, bookings, and reminder processing.
3. The messaging service manages conversations, message history, read state, media upload flows, and live updates over WebSockets.
4. The snapshot service builds a provider-facing customer profile that combines notes, tags, and auto-tagging configuration.
5. The RAG service receives support questions from the frontend, retrieves relevant knowledge, and generates responses through the configured model provider.

This separation keeps the product modular while allowing the frontend to talk directly to the service responsible for each feature area.

## Architecture

| Component | Responsibility | Default Local Port |
| --- | --- | --- |
| `apps/expo-frontend` | Expo app for mobile and web clients | `8081` for web export / frontend container |
| `apps/scheduling-service` | Authentication, providers, services, availability, bookings, reminders | `8000` |
| `apps/rag-service` | Support assistant API and RAG chat endpoint | `8001` |
| `apps/messaging-service` | Conversations, messages, uploads, WebSocket updates | `8002` |
| `apps/snapshot-service` | Customer snapshots, notes, tags, auto-tagging rules | `8003` |
| `dev-tools` | Reset, seed, and Firebase development utilities | n/a |

### Service boundaries

#### Scheduling service

- Customer and provider registration
- Login and Firebase token exchange
- Provider service catalog
- Availability and busy-time management
- Booking creation, listing, acceptance, rejection, deletion, and rescheduling
- Booking reminder worker

#### Messaging service

- Conversation creation
- Conversation and message history
- Sending text and image messages
- Read receipts and unread state
- Real-time updates through `/ws`

#### Snapshot service

- Provider-facing customer snapshot retrieval
- Tagging rule configuration
- Automatic tag refresh
- Manual tag CRUD
- Customer note CRUD

#### RAG service

- Health and status endpoints
- Chat endpoint at `/api/chat`
- Support assistant responses with matched knowledge sections

## Structure

```text
apps/
  expo-frontend/         Expo app, web build, frontend tests
  scheduling-service/    Core scheduling and auth service
  messaging-service/     Messaging REST + WebSocket service
  snapshot-service/      Customer snapshot, notes, tags, auto-tagging
  rag-service/           RAG chatbot service
dev-tools/       Local reset/seed helpers and development utilities
docs/            Project and deployment docs
infra/           Docker Compose and Render deployment config
scripts/         Windows helpers and repo automation
```

## Key Paths

- Frontend app: `apps/expo-frontend`
- Dev tools: `dev-tools`
- Scheduling service: `apps/scheduling-service`
- Messaging service: `apps/messaging-service`
- Snapshot service: `apps/snapshot-service`
- RAG service: `apps/rag-service`
- Frontend tests: `apps/expo-frontend/__tests__`
- Scheduling tests: `apps/scheduling-service/tests`
- Messaging tests: `apps/messaging-service/tests`
- Snapshot tests: `apps/snapshot-service/tests`
- RAG tests: `apps/rag-service/tests`

## Tech Stack

### Frontend

- Expo
- React Native
- Expo Router
- TypeScript
- Firebase client SDK
- Axios

### Backend

- Python
- FastAPI
- Pydantic / pydantic-settings
- Firebase Admin / Firestore
- WebSockets

### AI and infrastructure

- Gemini-backed RAG integration
- Docker / Docker Compose
- Render deployment configuration

## Prerequisites

Before setting up the project locally, make sure you have:

- Node.js and npm
- Python 3.11 recommended on Windows (`py -3.11` is preferred by the setup script)
- Git
- Docker Desktop, if you want to use the containerized setup
- Firebase project access and service credentials for full backend functionality
- A Gemini API key for the RAG service

## Environment Configuration

All Python services read from the repository root `.env` file, and the Expo app also reads public environment values from that same root file through `app.config.ts`.

### Common environment variables

Use a root `.env` file with values like these:

```env
# Backend secrets / server config
FIREBASE_CREDENTIALS={"type":"service_account","project_id":"your-project", "...":"..."}
GEMINI_API_KEY=your-gemini-api-key
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19000,http://localhost:19006
ALLOWED_ORIGIN_REGEX=^https?://(localhost|127\.0\.0\.1)(:\d+)?$
SECRET_KEY=change-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
SCHEDULE_TIMEZONE=America/Port_of_Spain
REMINDER_WORKER_ENABLED=true
REMINDER_WORKER_POLL_SECONDS=60

# Frontend public config
EXPO_PUBLIC_FRONTEND_URL=http://localhost:8081
EXPO_PUBLIC_API_URL=http://localhost:8000
EXPO_PUBLIC_SCHEDULING_URL=http://localhost:8000
EXPO_PUBLIC_MESSAGING_URL=http://localhost:8002
EXPO_PUBLIC_SNAPSHOT_URL=http://localhost:8003
EXPO_PUBLIC_RAG_URL=http://localhost:8001
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-web-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
```

### Notes

- The Expo app has built-in defaults in `apps/expo-frontend/app.config.ts`, but a local `.env` is still the cleanest way to make your setup explicit.
- `FIREBASE_CREDENTIALS` is required by the backend services that initialize Firebase Admin.
- `GEMINI_API_KEY` is required for the support assistant to return live AI responses.
- `EXPO_PUBLIC_*` values are safe for client-side configuration, but backend secrets should never be exposed outside your server environment.

## Local Development

There are three practical ways to run the project locally:

1. Manual setup for each service
2. The Windows control-center script
3. Docker Compose

### Install repo dependencies from the root

```bash
npm install
```

### Start the React frontend

```bash
npm start
```

You can also use:

```bash
npm run frontend
npm run frontend:clear
npm run android
npm run ios
npm run web
npm run build:web
npm run lint
```

### Start the core scheduling service

```bash
cd apps/scheduling-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Start the messaging service

```bash
cd apps/messaging-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Start the snapshot service

```bash
cd apps/snapshot-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Start the RAG service

```bash
cd apps/rag-service
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### Set up development tools

If you plan to use the reset/seed scripts under `dev-tools/`, set them up as well:

```bash
cd dev-tools
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Recommended local service URLs

When running locally, the project expects the following defaults:

- Frontend: `http://localhost:8081`
- Scheduling service: `http://localhost:8000`
- RAG service: `http://localhost:8001`
- Messaging service: `http://localhost:8002`
- Snapshot service: `http://localhost:8003`
- Messaging WebSocket: `ws://localhost:8002/ws`

### On Windows, use the control-center script

On Windows, use the control-center script:

- `scripts\skeduleit.bat`

This launcher can help you:

- start all backend services and the frontend
- set up Python virtual environments and install dependencies
- rebuild or reset seeded development data
- run grouped test suites
- trigger local or cloud APK builds

### Local Docker

Container and platform config now lives under `infra/`.

```bash
docker compose -f infra/docker-compose.yml up --build
```

This starts:

1. frontend on `http://localhost:8081`
2. scheduling on `http://localhost:8000`
3. RAG on `http://localhost:8001`
4. messaging on `http://localhost:8002`
5. snapshot on `http://localhost:8003`

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

Additional useful frontend commands:

```bash
npm run test:frontend:snapshot
```

The current automated coverage includes:

- frontend component and utility tests
- scheduling service tests
- messaging service tests
- snapshot service tests
- RAG service tests

## Development Utilities

The `dev-tools/` directory contains local-only utilities for development and testing, including:

- database reset orchestration
- test user creation
- test booking creation
- Firestore collection rebuild and cleanup helpers
- Firebase connectivity checks

Use these tools carefully. Some scripts are intentionally destructive and are meant for local development or controlled test environments only.

## Deployment

Container and platform config now lives under `infra/`.

- Docker Compose: `infra/docker-compose.yml`
- Render: `infra/render.yaml`
- Per-service Dockerfiles: `apps/*/Dockerfile`

`infra/render.yaml` defines five separate web services:

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

Additional deployment notes are in `docs/DOCKER_README.md`.

### Deployment notes

- The old Express proxy server has been removed.
- The frontend now talks directly to the dedicated service URLs.
- Frontend build output is generated in `apps/expo-frontend/dist`.
- `dev-tools` remains in the repo for reset/seed utilities and other local-only development helpers.

## Troubleshooting

### Expo frontend cannot reach local services

- Confirm the backend services are running on ports `8000` through `8003`.
- Confirm your `EXPO_PUBLIC_*` URLs point to the correct local hosts.
- On mobile devices or Expo Go, remember that `localhost` may need to resolve to your machine's LAN or Expo host.

### Python service fails to start

- Confirm a service-specific virtual environment exists.
- Reinstall dependencies from that service's `requirements.txt`.
- Check that the root `.env` file includes valid Firebase configuration.

### Authentication fails

- Verify that the Firebase web app values in `EXPO_PUBLIC_FIREBASE_*` are correct.
- Confirm Email/Password authentication is enabled in Firebase Authentication.
- Confirm backend Firebase Admin credentials match the same Firebase project.

### RAG assistant returns errors

- Verify `GEMINI_API_KEY` is set.
- Check the RAG service logs for rate-limit, authentication, or validation failures.
- Confirm the frontend is targeting the correct RAG base URL.
