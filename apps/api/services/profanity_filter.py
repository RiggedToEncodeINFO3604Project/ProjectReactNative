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


def get_profanity_matches(text: str) -> List[Tuple[str, int, int]]:
    """
    Get all profanity matches in the text with their positions.
    """
    if not text:
        return []
    
    matches = []
    text_lower = text.lower()
    
    for word in PROFANITY_LIST:
        pattern = r'\b' + re.escape(word) + r'\b'
        for match in re.finditer(pattern, text_lower):
            matches.append((word, match.start(), match.end()))
    
    return matches


def filter_profanity(text: str, replacement_char: str = "*") -> str:
    """
    Filter profanity from text by replacing matched words with asterisks.
    Only the middle characters are replaced, first and last character are kept. Might modify this behavior in the future.
    """
    if not text:
        return text
    
    result = text
    matches = get_profanity_matches(text)
    
    # Sort by position in reverse order to replace from end to start
    # This prevents position shifts when replacing
    matches.sort(key=lambda x: x[1], reverse=True)
    
    for word, start, end in matches:
        original_word = result[start:end]
        
        if len(original_word) <= 2:
            # For very short words, replace all characters
            filtered = replacement_char * len(original_word)
        else:
            # Keep first and last character, replace middle
            first_char = original_word[0]
            last_char = original_word[-1]
            middle_length = len(original_word) - 2
            middle = replacement_char * middle_length
            filtered = first_char + middle + last_char
        
        result = result[:start] + filtered + result[end:]
    
    return result

def filter_profanity_with_count(text: str) -> Tuple[str, int]:
    """
    Filter profanity and return the filtered text along with the count of violations.
    """
    matches = get_profanity_matches(text)
    unique_violations = len(set(m[0] for m in matches))  # Count unique words, not occurrences
    return filter_profanity(text), unique_violations


# Convenience function for simple filtering
def sanitize_message(content: str) -> str:
    return filter_profanity(content)