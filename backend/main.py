import os
import logging
import json
from urllib import request as urllib_request
from urllib.error import HTTPError, URLError
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from contextlib import asynccontextmanager
from firebase_db import initialize_firebase, close_firebase
from routes import auth_routes, provider_routes, customer_routes, messaging_routes
from websocket_manager import websocket_manager, Connection

log = logging.getLogger("skedulelt.main")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:8081,http://localhost:19000,http://localhost:19006,http://localhost:8000",
    ).split(",")
    if origin.strip()
]
allowed_origin_regex = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup - Firebase initialization is synchronous
    initialize_firebase()
    yield
    # Shutdown
    close_firebase()


app = FastAPI(title="Scheduling Service API", lifespan=lifespan)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_origin_regex=None if allowed_origins == ["*"] else allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_routes.router)
app.include_router(provider_routes.router)
app.include_router(customer_routes.router)
app.include_router(messaging_routes.router, prefix="/api/messaging", tags=["messaging"])


@app.post("/api/chat")
async def proxy_rag_chat(payload: dict):
    rag_port = int(os.environ.get("RAG_PORT", 8001))
    rag_url = f"http://localhost:{rag_port}/api/chat"
    body = json.dumps(payload).encode("utf-8")
    req = urllib_request.Request(
        rag_url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=60) as response:
            content = response.read().decode("utf-8")
            return json.loads(content)
    except HTTPError as exc:
        error_text = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=exc.code, detail=error_text)
    except URLError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"RAG server unavailable: {exc.reason}",
        )


@app.get("/api/rag/health")
async def proxy_rag_health():
    rag_port = int(os.environ.get("RAG_PORT", 8001))
    rag_url = f"http://localhost:{rag_port}/api/health"

    try:
        with urllib_request.urlopen(rag_url, timeout=15) as response:
            content = response.read().decode("utf-8")
            return json.loads(content)
    except HTTPError as exc:
        error_text = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=exc.code, detail=error_text)
    except URLError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"RAG server unavailable: {exc.reason}",
        )


@app.get("/")
async def root():
    return {"message": "Scheduling Service API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Get WebSocket connection statistics
@app.get("/ws-health")
async def websocket_health_check():
    stats = websocket_manager.get_connection_stats()
    return {
        "status": "healthy",
        "websocket_stats": stats
    }


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token for authentication")
):
    client_host = websocket.client.host if websocket.client else "unknown"
    client_port = websocket.client.port if websocket.client else "unknown"
    client_info = f"{client_host}:{client_port}"
    
    # Enhanced logging for Render debugging
    log.info(f"WebSocket connection attempt from {client_info}")
    log.info(f"  Path: {websocket.url.path}")
    log.info(f"  Query params: {dict(websocket.query_params)}")
    log.info(f"  Headers: {dict(websocket.headers)}")
    
    if not token:
        log.warning(f"WebSocket connection rejected - no token provided by {client_info}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    log.info(f"WebSocket attempting connection with token for {client_info}")
    connection = await websocket_manager.connect(websocket, token)
    
    if not connection:
        log.warning(f"WebSocket connection failed - invalid token from {client_info}")
        return
    
    log.info(f"WebSocket connection established for user {connection.user_id} from {client_info}")
    
    try:
        while True:
            # Receive and process messages from client
            data = await websocket.receive_json()
            log.debug(f"WebSocket message received from {connection.user_id}: {data.get('type')}")
            await websocket_manager.handle_message(connection, data)
            
    except WebSocketDisconnect as e:
        websocket_manager.disconnect(connection)
        log.info(f"WebSocket disconnected normally for user {connection.user_id} - Code: {e.code}")
    except Exception as e:
        log.error(f"WebSocket error for user {connection.user_id}: {e}", exc_info=True)
        websocket_manager.disconnect(connection)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
