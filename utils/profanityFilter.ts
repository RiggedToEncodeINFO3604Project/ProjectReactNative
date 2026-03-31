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
