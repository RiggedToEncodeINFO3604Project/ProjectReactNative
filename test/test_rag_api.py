import importlib.util
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient


RAG_SERVER_DIR = Path(__file__).resolve().parents[1] / "RAG-Server"
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
    def setUp(self):
        self.client = TestClient(rag_main.app)

    def tearDown(self):
        self.client.close()

    def test_health_endpoint_reports_service_status(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["service"], "rag-server")



if __name__ == "__main__":
    unittest.main()
