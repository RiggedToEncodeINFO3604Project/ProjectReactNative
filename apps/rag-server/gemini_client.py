import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
import google.genai as genai
from google.genai import types as genai_types

from knowledge_base import get_full_knowledge_base, get_relevant_context

ROOT_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
LOCAL_ENV_PATH = Path(__file__).resolve().parent / ".env"
if ROOT_ENV_PATH.exists():
    load_dotenv(ROOT_ENV_PATH)
elif LOCAL_ENV_PATH.exists():
    load_dotenv(LOCAL_ENV_PATH)

log = logging.getLogger("skedulelt.gemini")

MODEL = os.environ.get("RAG_MODEL", "gemma-3-27b-it")

MAX_RETRIES = 4
BASE_DELAY_SECONDS = 2

_executor = ThreadPoolExecutor(max_workers=4)
_queue: asyncio.Queue | None = None
_worker_task: asyncio.Task | None = None
_client: genai.Client | None = None


def _create_client() -> genai.Client:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured. Add it to the repo root .env or apps/rag-server/.env.",
        )
    return genai.Client(api_key=api_key)


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = _create_client()
    return _client


def _get_queue() -> asyncio.Queue:
    global _queue
    if _queue is None:
        _queue = asyncio.Queue()
    return _queue


async def _ensure_worker() -> None:
    global _worker_task
    if _worker_task is None or _worker_task.done():
        _worker_task = asyncio.create_task(_queue_worker())


async def _queue_worker() -> None:
    queue = _get_queue()
    loop = asyncio.get_running_loop()

    while True:
        future, contents = await queue.get()
        try:
            answer = await _call_with_retry(loop, contents)
            future.set_result(answer)
        except Exception as exc:
            future.set_exception(exc)
        finally:
            queue.task_done()


async def _call_with_retry(
    loop: asyncio.AbstractEventLoop,
    contents: list[genai_types.Content],
) -> str:
    last_error: Exception | None = None

    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await loop.run_in_executor(
                _executor,
                lambda: _get_client().models.generate_content(
                    model=MODEL,
                    contents=contents,
                ),
            )
            return response.text or ""
        except Exception as exc:
            last_error = exc
            status_code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
            if status_code == 429 and attempt < MAX_RETRIES:
                delay = BASE_DELAY_SECONDS * (2**attempt)
                log.warning(
                    "[Queue] 429 retry %s/%s in %ss",
                    attempt + 1,
                    MAX_RETRIES,
                    delay,
                )
                await asyncio.sleep(delay)
                continue
            raise

    if last_error is not None:
        raise last_error
    raise RuntimeError("Gemini request failed without an exception")


def _build_system_prompt() -> str:
    return (
        "You are the official Skedulelt Support Assistant.\n"
        "Skedulelt is a mobile scheduling & payment app for service providers\n"
        "and customers in Trinidad & Tobago.\n"
        "\n"
        "Rules:\n"
        "  - Answer ONLY based on the knowledge base below.\n"
        "  - If the question falls outside the knowledge base, say:\n"
        "    \"I'm sorry, I don't have information on that. Please contact\n"
        "     our support team for further assistance.\"\n"
        "  - Be friendly, concise, and helpful.\n"
        "  - Do NOT hallucinate features, policies, or prices.\n"
        "  - Respond in English.\n"
        "\n"
        "========================================\n"
        " SKEDULELT KNOWLEDGE BASE\n"
        "========================================\n"
        f"{get_full_knowledge_base()}\n"
        "========================================"
    )


@dataclass
class ChatResult:
    answer: str
    matched_sections: list[str]


async def chat(history: list[dict], current_message: str) -> ChatResult:
    context = get_relevant_context(current_message)

    contents: list[genai_types.Content] = [
        genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=_build_system_prompt())],
        ),
        genai_types.Content(
            role="model",
            parts=[
                genai_types.Part(
                    text=(
                        "Got it. I'm the Skedulelt Support Assistant. "
                        "I'll answer only based on the knowledge base provided. "
                        "How can I help?"
                    )
                )
            ],
        ),
    ]

    for turn in history:
        role = "model" if turn["role"] == "assistant" else "user"
        contents.append(
            genai_types.Content(
                role=role,
                parts=[genai_types.Part(text=turn["text"])],
            )
        )

    contents.append(
        genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=current_message)],
        )
    )

    queue = _get_queue()
    await _ensure_worker()

    loop = asyncio.get_running_loop()
    future = loop.create_future()
    await queue.put((future, contents))

    answer = await future

    return ChatResult(answer=answer, matched_sections=context.matched)
