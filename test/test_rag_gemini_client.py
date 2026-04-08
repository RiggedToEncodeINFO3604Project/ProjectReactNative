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

    async def test_chat_builds_contents_and_returns_context_matches(self):
        captured = {}

        class FakeQueue:
            async def put(self, item):
                future, contents = item
                captured["contents"] = contents
                future.set_result("Here is the answer")

        with (
            patch.object(
                gemini_client,
                "get_relevant_context",
                return_value=RelevantContext(
                    matched=["2. Customer FAQ"],
                    full_text="unused in current implementation",
                ),
            ),
            patch.object(gemini_client, "_ensure_worker", new=AsyncMock()),
            patch.object(gemini_client, "_get_queue", return_value=FakeQueue()),
        ):
            result = await gemini_client.chat(
                history=[
                    {"role": "user", "text": "Hi"},
                    {"role": "assistant", "text": "Hello there"},
                ],
                current_message="How do I book an appointment?",
            )

        self.assertEqual(result.answer, "Here is the answer")
        self.assertEqual(result.matched_sections, ["2. Customer FAQ"])

        contents = captured["contents"]
        self.assertEqual(contents[0].role, "user")
        self.assertEqual(contents[1].role, "model")
        self.assertEqual(contents[2].role, "user")
        self.assertEqual(contents[2].parts[0].text, "Hi")
        self.assertEqual(contents[3].role, "model")
        self.assertEqual(contents[3].parts[0].text, "Hello there")
        self.assertEqual(contents[4].role, "user")
        self.assertEqual(contents[4].parts[0].text, "How do I book an appointment?")




if __name__ == "__main__":
    unittest.main()
