const tryParseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const extractFromObject = (
  value: Record<string, unknown>,
  seen: Set<unknown>,
): string | null => {
  const detailMessage = extractChatbotErrorMessage(value.detail, seen);
  if (detailMessage) {
    return detailMessage;
  }

  const nestedErrorMessage =
    value.error && typeof value.error === "object"
      ? extractChatbotErrorMessage(value.error, seen)
      : null;
  if (nestedErrorMessage) {
    return nestedErrorMessage;
  }

  return typeof value.message === "string" && value.message.trim()
    ? value.message.trim()
    : null;
};

export const extractChatbotErrorMessage = (
  value: unknown,
  seen: Set<unknown> = new Set(),
): string | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = tryParseJson(trimmed);
    if (parsed !== null && parsed !== value) {
      return extractChatbotErrorMessage(parsed, seen) || trimmed;
    }

    return trimmed;
  }

  if (typeof value !== "object") {
    return null;
  }

  if (seen.has(value)) {
    return null;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const message = extractChatbotErrorMessage(item, seen);
      if (message) {
        return message;
      }
    }
    return null;
  }

  return extractFromObject(value as Record<string, unknown>, seen);
};
