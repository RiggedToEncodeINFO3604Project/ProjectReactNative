import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient


SERVICE_DIR = Path(__file__).resolve().parents[1]
if str(SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(SERVICE_DIR))

main_spec = importlib.util.spec_from_file_location(
    "snapshot_service_main",
    SERVICE_DIR / "main.py",
)
service_main = importlib.util.module_from_spec(main_spec)
assert main_spec.loader is not None
main_spec.loader.exec_module(service_main)


class SnapshotHealthTests(unittest.TestCase):
    def setUp(self):
        self.init_patch = patch.object(service_main, "initialize_firebase")
        self.close_patch = patch.object(service_main, "close_firebase")
        self.init_patch.start()
        self.close_patch.start()
        self.client = TestClient(service_main.app)

    def tearDown(self):
        self.client.close()
        self.close_patch.stop()
        self.init_patch.stop()

    def test_health_endpoint_reports_service_name(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {"status": "healthy", "service": "snapshot-service"},
        )


if __name__ == "__main__":
    unittest.main()
