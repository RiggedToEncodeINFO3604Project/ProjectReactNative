import { extractChatbotErrorMessage } from "@/utils/chatbotError";

describe("extractChatbotErrorMessage", () => {
  it("returns the nested FastAPI detail message from a stringified payload", () => {
    const payload =
      '{"detail":"{\\"detail\\":{\\"error\\":\\"service_unavailable\\",\\"message\\":\\"AI service busy. Try again.\\"}}"}';

    expect(extractChatbotErrorMessage(payload)).toBe(
      "AI service busy. Try again.",
    );
  });

  it("returns the detail message from a parsed JSON object", () => {
    expect(
      extractChatbotErrorMessage({
        detail: {
          error: "service_unavailable",
          message: "AI service busy. Try again.",
        },
      }),
    ).toBe("AI service busy. Try again.");
  });

  it("falls back to plain text when the payload is not JSON", () => {
    expect(extractChatbotErrorMessage("Network timeout")).toBe(
      "Network timeout",
    );
  });
});
