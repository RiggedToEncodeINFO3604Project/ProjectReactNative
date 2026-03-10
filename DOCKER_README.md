# Docker Deployment

This project uses a **combined Docker deployment** that runs both the frontend (Express) and backend (FastAPI) in a single container.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Docker Container                                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Express Server (Port 8081)                         │   │
│  │  - Serves Expo web build from /dist                 │   │
│  │  - Proxies /auth/* → localhost:8000                 │   │
│  │  - Proxies /customer/* → localhost:8000             │   │
│  │  - Proxies /provider/* → localhost:8000             │   │
│  │  - Proxies /api/chat → external RAG server          │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│                         │ HTTP proxy                        │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  FastAPI Server (Port 8000)                         │   │
│  │  - Handles authentication endpoints                  │   │
│  │  - Handles customer/provider endpoints              │   │
│  │  - Connects to MongoDB Atlas                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Build and Run Locally

### Prerequisites

- Docker installed
- MongoDB Atlas connection string (or local MongoDB)

### Build and Run

```bash
# Build the combined image
docker build -f Dockerfile.combined -t expo-scheduling .

# Run with environment variables
docker run -p 8081:8081 \
  -e MONGODB_URL="mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority" \
  -e SECRET_KEY="your-secret-key" \
  -e GEMINI_API_KEY="your-gemini-key" \
  expo-scheduling

# Or use a .env file
docker run -p 8081:8081 --env-file .env expo-scheduling
```

### Using Docker Compose

```bash
# Build and start the service
docker-compose up --build

# Start the service (without rebuilding)
docker-compose up

# Stop the service
docker-compose down
```

## Environment Variables

### Required

| Variable      | Description                     | Example                                        |
| ------------- | ------------------------------- | ---------------------------------------------- |
| `MONGODB_URL` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/` |
| `SECRET_KEY`  | JWT secret key                  | Auto-generated on Render                       |

### Optional

| Variable                     | Description                | Default                        |
| ---------------------------- | -------------------------- | ------------------------------ |
| `DATABASE_NAME`              | MongoDB database name      | `scheduling_db`                |
| `GEMINI_API_KEY`             | Gemini API key for chatbot | -                              |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Client-side Gemini key     | -                              |
| `FASTAPI_HOST`               | External RAG server host   | `rag-server-bf1a.onrender.com` |
| `PORT`                       | Express server port        | `8081`                         |

## Render Deployment

### 1. Push to GitHub

```bash
git add .
git commit -m "Update to combined deployment"
git push
```

### 2. Configure on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Create a new Web Service or update existing
3. Connect your GitHub repository
4. Select **Docker** runtime
5. Set Dockerfile path to `Dockerfile.combined`

### 3. Set Environment Variables in Render Dashboard

In the **Environment** tab, add:

- `MONGODB_URL` - Your MongoDB Atlas connection string
- `GEMINI_API_KEY` - Your Gemini API key (if using chatbot)

### 4. Deploy

Render will automatically build and deploy your service.

## MongoDB Atlas Configuration

### Network Access

Since Render uses dynamic IPs, you need to allow all IPs:

1. Go to MongoDB Atlas → Network Access
2. Click **Add IP Address**
3. Enter `0.0.0.0/0` (Allow access from anywhere)
4. Click **Confirm**

### Database User

1. Go to MongoDB Atlas → Database Access
2. Create a user with read/write permissions
3. Use these credentials in your `MONGODB_URL`

### Connection String Format

```
mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
```

## Troubleshooting

### Login Fails on Deployed Version

1. **Check MongoDB connection**: Ensure `MONGODB_URL` is set correctly in Render
2. **Check MongoDB Network Access**: Ensure `0.0.0.0/0` is allowed
3. **Check logs**: View logs in Render Dashboard for errors

### Backend Not Starting

1. Check Render logs for Python errors
2. Ensure all Python dependencies are in `backend/requirements.txt`
3. Check if port 8000 is available inside container

### Frontend Not Loading

1. Check if Express server started (look for "Server running on port" in logs)
2. Check if `dist` folder was created during build
3. Verify the build step completed successfully

## Files Changed for Combined Deployment

| File                        | Purpose                                 |
| --------------------------- | --------------------------------------- |
| `Dockerfile.combined`       | Combined Node.js + Python Docker image  |
| `server.js`                 | Express server with API proxy routes    |
| `render.yaml`               | Render configuration for single service |
| `services/schedulingApi.ts` | Uses relative URLs for API calls        |

## Local Development

For local development, you can still run frontend and backend separately:

```bash
# Terminal 1: Start backend
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2: Start frontend
npm start
```

Set `EXPO_PUBLIC_API_URL=http://localhost:8000` in your `.env` for local development.
