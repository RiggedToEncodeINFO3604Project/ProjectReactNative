import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from firebase_db import close_firebase, initialize_firebase
from routes import auth_routes, customer_routes, provider_routes
from services.booking_reminder_service import run_booking_reminder_worker

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
    reminder_stop_event = asyncio.Event()
    reminder_task = None

    if settings.reminder_worker_enabled:
        reminder_task = asyncio.create_task(
            run_booking_reminder_worker(reminder_stop_event)
        )

    try:
        yield
    finally:
        reminder_stop_event.set()
        if reminder_task is not None:
            reminder_task.cancel()
            try:
                await reminder_task
            except asyncio.CancelledError:
                pass
        close_firebase()


app = FastAPI(title="SkeduleIt Core Scheduling Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_origin_regex=None if allowed_origins == ["*"] else allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(provider_routes.router)
app.include_router(customer_routes.router)


@app.get("/")
async def root():
    return {"message": "SkeduleIt Core Scheduling Service"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "scheduling-service"}


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
