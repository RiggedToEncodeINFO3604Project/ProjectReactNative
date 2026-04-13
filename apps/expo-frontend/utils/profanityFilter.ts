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

/**
 * Get all profanity matches in the text with their positions.
 */
export function getProfanityMatches(
  text: string,
): Array<{ word: string; start: number; end: number }> {
  if (!text) {
    return [];
  }

  const matches: Array<{ word: string; start: number; end: number }> = [];
  const textLower = text.toLowerCase();

  for (const word of PROFANITY_LIST) {
    /** Use global regex to find all occurrences of the word in the text.
     * This will allow us to capture multiple instances of the same word.
     */
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    let match;
    while ((match = pattern.exec(textLower)) !== null) {
      matches.push({
        word: word,
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return matches;
}

/**
 * Filter profanity from text by replacing matched words with asterisks.
 * Only the middle characters are replaced, first and last character are kept.
 * Example: "badword" -> "b*d***d", "apple" -> "a**le"
 */
export function filterProfanity(
  text: string,
  replacementChar: string = "*",
): string {
  if (!text) {
    return text;
  }

  let result = text;
  const matches = getProfanityMatches(text);

  // Sort by position in reverse order
  matches.sort((a, b) => b.start - a.start);

  for (const { start, end } of matches) {
    const originalWord = result.slice(start, end);

    let filtered: string;
    if (originalWord.length <= 2) {
      // For very short words, replace all characters
      filtered = replacementChar.repeat(originalWord.length);
    } else {
      // Keep first and last character, replace middle
      const firstChar = originalWord[0];
      const lastChar = originalWord[originalWord.length - 1];
      const middleLength = originalWord.length - 2;
      const middle = replacementChar.repeat(middleLength);
      filtered = firstChar + middle + lastChar;
    }

    result = result.slice(0, start) + filtered + result.slice(end);
  }

  return result;
}

/**
 * Filter profanity and return the filtered text along with the count of violations.
 */
export function filterProfanityWithCount(text: string): {
  filteredText: string;
  violationCount: number;
} {
  const matches = getProfanityMatches(text);
  // Count unique words, not occurrences
  const uniqueWords = new Set(matches.map((m) => m.word));
  return {
    filteredText: filterProfanity(text),
    violationCount: uniqueWords.size,
  };
}

/**
 * Sanitize a message by filtering profanity.
 * Main entry point for message filtering.
 */
export function sanitizeMessage(content: string): string {
  return filterProfanity(content);
}
