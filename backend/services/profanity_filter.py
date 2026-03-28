"""
Profanity Filter Module for Message Content Filtering

This module provides functions to filter inappropriate content from messages.
It uses a non-blocking approach that replaces profanity with asterisks rather
than rejecting messages entirely.
"""

import re
from typing import List, Tuple


# List of inappropriate words to filter (simple placeholder words)
# In production, this would be a comprehensive list of profanity/phishing/scam terms
PROFANITY_LIST: List[str] = [
    "apple",
    "cake",
    "badword",
    "offensive",
    "inappropriate",
    "scam",
    "phishing",
    "spam",
    "fake",
    "fraud"
]

def contains_profanity(text: str) -> bool:
    """
    Check if text contains any profanity words (case-insensitive, partial matching).
    """
    if not text:
        return False
    
    text_lower = text.lower()
    
    for word in PROFANITY_LIST:
        # Use word boundary matching for partial words
        pattern = r'\b' + re.escape(word) + r'\b'
        if re.search(pattern, text_lower):
            return True
    
    return False