import logging
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

from gemini_client import MODEL, chat

ROOT_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
LOCAL_ENV_PATH = Path(__file__).resolve().parent / ".env"
if ROOT_ENV_PATH.exists():
    load_dotenv(ROOT_ENV_PATH)
elif LOCAL_ENV_PATH.exists():
    load_dotenv(LOCAL_ENV_PATH)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("skedulelt.rag")

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

app = FastAPI(
    title="Skedulelt RAG API",
    description="RAG chatbot service for the Skedulelt app",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["*"],
    allow_origin_regex=None if allowed_origins == ["*"] else allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "Authorization"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    client_host = request.client.host if request.client else "unknown"
    log.info("-> %s %s from %s", request.method, request.url.path, client_host)
    response = await call_next(request)
    duration_ms = (time.time() - start_time) * 1000
    log.info(
        "<- %s %s completed in %.0fms [%s]",
        request.method,
        request.url.path,
        duration_ms,
        response.status_code,
    )
    return response


class HistoryTurn(BaseModel):
    role: str
    text: str = Field(..., max_length=2000)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in {"user", "assistant"}:
            raise ValueError('role must be "user" or "assistant"')
        return value


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: list[HistoryTurn] = Field(default_factory=list, max_length=50)

    @field_validator("message")
    @classmethod
    def validate_message(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("message cannot be empty")
        return cleaned


class ChatResponse(BaseModel):
    answer: str
    matchedSections: list[str]


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "rag-server",
        "model": MODEL,
        "timestamp": time.time(),
    }


@app.get("/api/status")
async def status():
    return {
        "status": "online",
        "service": "rag-server",
        "timestamp": time.time(),
    }


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(body: ChatRequest):
    history_dicts = [{"role": turn.role, "text": turn.text} for turn in body.history]

    try:
        log.info("Processing RAG message: %s...", body.message[:50])
        result = await chat(history_dicts, body.message)
        return ChatResponse(
            answer=result.answer,
            matchedSections=result.matched_sections,
        )
    except Exception as exc:
        error_message = str(exc)
        log.error("RAG chat error: %s", error_message, exc_info=True)

        lowered = error_message.lower()
        if any(fragment in lowered for fragment in ["429", "quota", "rate limit"]):
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "rate_limit",
                    "message": "Too many requests. Please wait.",
                    "retry_after": 60,
                },
            )

        if any(fragment in lowered for fragment in ["api key", "authentication", "unauthorized"]):
            raise HTTPException(
                status_code=500,
                detail={
                    "error": "configuration",
                    "message": "Server error. Contact support.",
                },
            )

        if any(fragment in lowered for fragment in ["overloaded", "unavailable", "timeout"]):
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "service_unavailable",
                    "message": "AI service busy. Try again.",
                },
            )

        if any(fragment in lowered for fragment in ["safety", "blocked", "violation"]):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "content_blocked",
                    "message": "Message blocked by filters.",
                },
            )

        raise HTTPException(
            status_code=500,
            detail={
                "error": "internal_server_error",
                "message": "Unexpected error.",
            },
        )


@app.exception_handler(422)
async def validation_exception_handler(request: Request, exc):
    log.warning("Validation error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "message": "Invalid request.",
            "details": exc.errors() if hasattr(exc, "errors") else str(exc),
        },
    )


@app.on_event("startup")
async def startup_event():
    log.info("========================================")
    log.info("Skedulelt RAG API Server Starting")
    log.info("Model: %s", MODEL)
    log.info("CORS Origins: %s", allowed_origins)
    log.info("CORS Origin Regex: %s", allowed_origin_regex)
    log.info("========================================")

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8001))
    uvicorn.run(app, host="0.0.0.0", port=port)
