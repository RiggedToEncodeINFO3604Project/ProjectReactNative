import os
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, status
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from firebase_db import initialize_firebase, close_firebase
from routes import auth_routes, provider_routes, customer_routes, messaging_routes
from websocket_manager import websocket_manager, Connection

log = logging.getLogger("skedulelt.main")


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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_routes.router)
app.include_router(provider_routes.router)
app.include_router(customer_routes.router)
app.include_router(messaging_routes.router, prefix="/api/messaging", tags=["messaging"])


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
    client_info = f"{websocket.client}"
    log.info(f"WebSocket endpoint accessed - Client: {client_info}, Path: {websocket.url.path}")
    
    if not token:
        log.warning(f"WebSocket connection rejected - no token provided by {client_info}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    connection = await websocket_manager.connect(websocket, token)
    
    if not connection:
        log.warning(f"WebSocket connection failed - invalid token from {client_info}")
        return
    
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
