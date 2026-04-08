import {
  getReceivedMessageSearchResults,
  isMessageFromOtherUser,
} from "@/utils/messageSearch";
import { Message } from "@/types/scheduling";

const messages: Message[] = [
  {
    id: "received-text",
    conversation_id: "conversation-1",
    sender_id: "provider-1",
    sender_role: "Provider",
    content: "Your appointment is confirmed for Friday",
    message_type: "text",
    created_at: "2026-04-08T12:00:00.000Z",
    read: true,
  },
  {
    id: "sent-text",
    conversation_id: "conversation-1",
    sender_id: "customer-1",
    sender_role: "Customer",
    content: "Friday works for me too",
    message_type: "text",
    created_at: "2026-04-08T12:01:00.000Z",
    read: true,
  },
  {
    id: "received-image-caption",
    conversation_id: "conversation-1",
    sender_id: "provider-1",
    sender_role: "Provider",
    content: "Here is the style reference photo",
    message_type: "image",
    image_url: "https://example.com/photo.jpg",
    created_at: "2026-04-08T12:02:00.000Z",
    read: false,
  },
];

describe("messageSearch", () => {
  it("matches only messages received from the other user", () => {
    const results = getReceivedMessageSearchResults(
      messages,
      "friday",
      "customer-1",
      "Customer",
    );

    expect(results).toEqual([messages[0]]);
  });

  it("matches case-insensitively across received message content", () => {
    const results = getReceivedMessageSearchResults(
      messages,
      "STYLE REFERENCE",
      "customer-1",
      "Customer",
    );

    expect(results).toEqual([messages[2]]);
  });

  it("falls back to role comparison when the current user id is unavailable", () => {
    expect(isMessageFromOtherUser(messages[0], "", "Customer")).toBe(true);
    expect(isMessageFromOtherUser(messages[1], "", "Customer")).toBe(false);
  });
});
