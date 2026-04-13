import sys
import unittest
from pathlib import Path


RAG_SERVER_DIR = Path(__file__).resolve().parents[1]
if str(RAG_SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(RAG_SERVER_DIR))

import knowledge_base


class KnowledgeBaseTests(unittest.TestCase):
    def test_get_full_knowledge_base_includes_every_section_title(self):
        full_text = knowledge_base.get_full_knowledge_base()

        for section in knowledge_base.SECTIONS:
            self.assertIn(section.title, full_text)

    def test_get_relevant_context_prioritizes_keyword_matches(self):
        context = knowledge_base.get_relevant_context(
            "How do I book an appointment and message my barber?"
        )

        self.assertGreaterEqual(len(context.matched), 1)
        self.assertEqual(context.matched[0], "2. Customer FAQ")
        self.assertIn("How do I book an appointment?", context.full_text)

    def test_get_relevant_context_returns_all_sections_when_nothing_matches(self):
        context = knowledge_base.get_relevant_context("Tell me something unrelated")

        self.assertEqual(
            context.matched,
            [section.title for section in knowledge_base.SECTIONS],
        )
        for section in knowledge_base.SECTIONS:
            self.assertIn(section.title, context.full_text)


if __name__ == "__main__":
    unittest.main()
