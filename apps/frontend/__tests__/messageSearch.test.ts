import {
  getMessageSearchResults,
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
  it("matches messages from both sides of the conversation", () => {
    const results = getMessageSearchResults(messages, "friday");

    expect(results).toEqual([messages[0], messages[1]]);
  });

  it("matches case-insensitively across message content", () => {
    const results = getMessageSearchResults(messages, "STYLE REFERENCE");

    expect(results).toEqual([messages[2]]);
  });

  it("ignores blank queries and empty content", () => {
    const results = getMessageSearchResults(
      [
        ...messages,
        {
          id: "empty-message",
          conversation_id: "conversation-1",
          sender_id: "provider-1",
          sender_role: "Provider",
          content: "   ",
          message_type: "text",
          created_at: "2026-04-08T12:03:00.000Z",
          read: false,
        },
      ],
      "   ",
    );

    expect(results).toEqual([]);
  });
});
