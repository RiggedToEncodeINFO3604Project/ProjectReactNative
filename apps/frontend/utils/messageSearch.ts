import { Message } from "@/types/scheduling";

export function getMessageSearchResults(
  messages: Message[],
  query: string,
): Message[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return messages.filter((message) => {
    const searchableContent = message.content?.trim();
    if (!searchableContent) {
      return false;
    }

    return searchableContent.toLowerCase().includes(normalizedQuery);
  });
}
