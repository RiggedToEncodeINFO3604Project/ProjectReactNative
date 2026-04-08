import asyncio
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch


RAG_SERVER_DIR = Path(__file__).resolve().parents[1] / "RAG-Server"
if str(RAG_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(RAG_SERVER_DIR))

import gemini_client
from knowledge_base import RelevantContext


class GeminiClientTests(unittest.IsolatedAsyncioTestCase):
    def test_build_system_prompt_embeds_knowledge_base(self):
        with patch.object(
            gemini_client,
            "get_full_knowledge_base",
            return_value="KNOWLEDGE BASE TEXT",
        ):
            prompt = gemini_client._build_system_prompt()

        self.assertIn("official Skedulelt Support Assistant", prompt)
        self.assertIn("KNOWLEDGE BASE TEXT", prompt)
        self.assertIn("Answer ONLY based on the knowledge base below.", prompt)




if __name__ == "__main__":
    unittest.main()
