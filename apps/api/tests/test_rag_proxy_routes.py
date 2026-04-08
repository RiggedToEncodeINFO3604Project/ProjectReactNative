import importlib.util
import io
import json
import sys
import unittest
from pathlib import Path
from urllib.error import HTTPError, URLError
from unittest.mock import patch

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

backend_main_spec = importlib.util.spec_from_file_location(
    "backend_main_module",
    BACKEND_DIR / "main.py",
)
backend_main = importlib.util.module_from_spec(backend_main_spec)
assert backend_main_spec.loader is not None
backend_main_spec.loader.exec_module(backend_main)


class _FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def read(self):
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class RagProxyRouteTests(unittest.TestCase):
    def setUp(self):
        self.init_patch = patch.object(backend_main, "initialize_firebase")
        self.close_patch = patch.object(backend_main, "close_firebase")
        self.init_patch.start()
        self.close_patch.start()
        self.client = TestClient(backend_main.app)

    def tearDown(self):
        self.client.close()
        self.close_patch.stop()
        self.init_patch.stop()

    def test_proxy_rag_chat_returns_upstream_payload(self):
        with patch.object(
            backend_main.urllib_request,
            "urlopen",
            return_value=_FakeResponse(
                {"answer": "Hello from RAG", "matchedSections": ["2. Customer FAQ"]}
            ),
        ):
            response = self.client.post(
                "/api/chat",
                json={"message": "Hello", "history": []},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"answer": "Hello from RAG", "matchedSections": ["2. Customer FAQ"]},
        )

    def test_proxy_rag_chat_returns_503_when_rag_server_is_unavailable(self):
        with patch.object(
            backend_main.urllib_request,
            "urlopen",
            side_effect=URLError("connection refused"),
        ):
            response = self.client.post(
                "/api/chat",
                json={"message": "Hello", "history": []},
            )

        self.assertEqual(response.status_code, 503)
        self.assertIn("RAG server unavailable", response.json()["detail"])

    def test_proxy_rag_health_passes_through_http_errors(self):
        error = HTTPError(
            url="http://localhost:8001/api/health",
            code=502,
            msg="Bad Gateway",
            hdrs=None,
            fp=io.BytesIO(b'{"error":"bad_gateway"}'),
        )

        with patch.object(
            backend_main.urllib_request,
            "urlopen",
            side_effect=error,
        ):
            response = self.client.get("/api/rag/health")

        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.json()["detail"], '{"error":"bad_gateway"}')


if __name__ == "__main__":
    unittest.main()
