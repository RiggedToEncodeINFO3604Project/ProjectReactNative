import importlib.util
import io
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import httpx


os.environ.setdefault("GEMINI_API_KEY", "test-key")

RAG_SERVER_DIR = Path(__file__).resolve().parents[1]
if str(RAG_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(RAG_SERVER_DIR))

rag_main_spec = importlib.util.spec_from_file_location(
    "rag_main_module",
    RAG_SERVER_DIR / "main.py",
)
rag_main = importlib.util.module_from_spec(rag_main_spec)
assert rag_main_spec.loader is not None
rag_main_spec.loader.exec_module(rag_main)


class RagApiTests(unittest.TestCase):
    def request(self, method: str, url: str, **kwargs):
        async def make_request():
            transport = httpx.ASGITransport(app=rag_main.app)
            async with httpx.AsyncClient(
                transport=transport,
                base_url="http://testserver",
            ) as client:
                return await client.request(method, url, **kwargs)

        import asyncio

        return asyncio.run(make_request())

    def test_health_endpoint_reports_service_status(self):
        response = self.request("GET", "/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["service"], "rag-server")

    def test_chat_endpoint_returns_answer_and_matched_sections(self):
        with patch.object(
            rag_main,
            "chat",
            new=AsyncMock(
                return_value=SimpleNamespace(
                    answer="Booking is available in the customer app.",
                    matched_sections=["2. Customer FAQ"],
                )
            ),
        ):
            response = self.request(
                "POST",
                "/api/chat",
                json={
                    "message": "How do I book an appointment?",
                    "history": [{"role": "user", "text": "Hi"}],
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "answer": "Booking is available in the customer app.",
                "matchedSections": ["2. Customer FAQ"],
            },
        )

    def test_chat_endpoint_returns_validation_error_for_blank_message(self):
        response = self.request(
            "POST",
            "/api/chat",
            json={"message": "   ", "history": []},
        )

        self.assertEqual(response.status_code, 422)
        body = response.json()
        self.assertIn("detail", body)
        self.assertTrue(any("message" in ".".join(map(str, item["loc"])) for item in body["detail"]))

    def test_chat_endpoint_maps_rate_limit_errors(self):
        with patch.object(
            rag_main,
            "chat",
            new=AsyncMock(side_effect=Exception("429 quota exceeded")),
        ):
            response = self.request(
                "POST",
                "/api/chat",
                json={"message": "Hello", "history": []},
            )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["detail"]["error"], "rate_limit")

    def test_chat_endpoint_maps_content_blocked_errors(self):
        with patch.object(
            rag_main,
            "chat",
            new=AsyncMock(side_effect=Exception("Safety policy violation")),
        ):
            response = self.request(
                "POST",
                "/api/chat",
                json={"message": "Hello", "history": []},
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["error"], "content_blocked")


if __name__ == "__main__":
    unittest.main()
