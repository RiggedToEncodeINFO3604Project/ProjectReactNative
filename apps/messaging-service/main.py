import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware

from firebase_db import close_firebase, initialize_firebase
from routes import messaging_routes
from websocket_manager import websocket_manager

log = logging.getLogger("skeduleit.messaging")

allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:8081,http://localhost:19000,http://localhost:19006,https://skeduleit-front.onrender.com",
    ).split(",")
    if origin.strip()
]
allowed_origin_regex = os.getenv(
    "ALLOWED_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})(:\d+)?$",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_firebase()
    yield
    close_firebase()


app = FastAPI(title="SkeduleIt Messaging Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_origin_regex=None if allowed_origins == ["*"] else allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(messaging_routes.router, prefix="/api/messaging", tags=["messaging"])


@app.get("/")
async def root():
    return {"message": "SkeduleIt Messaging Service"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "messaging-service"}


@app.get("/ws-health")
async def websocket_health_check():
    return {
        "status": "healthy",
        "service": "messaging-service",
        "websocket_stats": websocket_manager.get_connection_stats(),
    }


@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="Firebase ID token for authentication"),
):
    client_host = websocket.client.host if websocket.client else "unknown"
    client_port = websocket.client.port if websocket.client else "unknown"
    client_info = f"{client_host}:{client_port}"

    log.info("WebSocket connection attempt from %s", client_info)
    log.info("  Path: %s", websocket.url.path)
    log.info("  Query params: %s", dict(websocket.query_params))
    log.info("  Headers: %s", dict(websocket.headers))

    if not token:
        log.warning("WebSocket rejected for %s because no token was provided", client_info)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    connection = await websocket_manager.connect(websocket, token)
    if not connection:
        log.warning("WebSocket authentication failed for %s", client_info)
        return

    log.info("WebSocket connected for user %s", connection.user_id)

    try:
        while True:
            data = await websocket.receive_json()
            await websocket_manager.handle_message(connection, data)
    except WebSocketDisconnect as exc:
        websocket_manager.disconnect(connection)
        log.info("WebSocket disconnected for user %s with code %s", connection.user_id, exc.code)
    except Exception as exc:
        log.error("WebSocket error for user %s: %s", connection.user_id, exc, exc_info=True)
        websocket_manager.disconnect(connection)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8002))
    uvicorn.run(app, host="0.0.0.0", port=port)
