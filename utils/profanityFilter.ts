/**
 * Profanity Filter Module for Message Content Filtering
 *
 * This module provides functions to filter inappropriate content from messages.
 * It uses a non-blocking approach that replaces profanity with asterisks rather
 * than rejecting messages entirely.
 *
 * This mirrors the backend Python profanity filter logic for client-side preview.
 */

// List of inappropriate words to filter (placeholder words)
const PROFANITY_LIST: string[] = [
  "apple",
  "cake",
  "badword",
  "offensive",
  "inappropriate",
  "scam",
  "phishing",
  "spam",
  "fake",
  "fraud",
];

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check if text contains any profanity words (case-insensitive, partial matching).
 */
export function containsProfanity(text: string): boolean {
  if (!text) {
    return false;
  }

  const textLower = text.toLowerCase();

  for (const word of PROFANITY_LIST) {
    // Use word boundary matching for partial words
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "i");
    if (pattern.test(textLower)) {
      return true;
    }
  }

  return false;
}
