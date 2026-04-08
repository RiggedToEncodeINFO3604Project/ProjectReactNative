import { Message, UserRole } from "@/types/scheduling";

export function isMessageFromOtherUser(
  message: Message,
  currentUserId: string,
  currentUserRole?: UserRole | null,
): boolean {
  const normalizedUserId = currentUserId.trim();
  if (normalizedUserId) {
    return message.sender_id !== normalizedUserId;
  }

  if (currentUserRole) {
    return message.sender_role !== currentUserRole;
  }

  return true;
}

export function getReceivedMessageSearchResults(
  messages: Message[],
  query: string,
  currentUserId: string,
  currentUserRole?: UserRole | null,
): Message[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return messages.filter((message) => {
    if (!isMessageFromOtherUser(message, currentUserId, currentUserRole)) {
      return false;
    }

    const searchableContent = message.content?.trim();
    if (!searchableContent) {
      return false;
    }

    return searchableContent.toLowerCase().includes(normalizedQuery);
  });
}
