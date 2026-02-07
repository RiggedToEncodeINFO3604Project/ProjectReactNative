const express = require("express");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist/client")));

// API endpoint for chatbot
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    const apiKey =
      process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "API key not configured on server",
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

    const chatHistory = [
      {
        role: "user",
        parts: [
          {
            text: "You are Skedulelt Support Assistant, a helpful customer service chatbot for Skedulelt, a booking/scheduling platform operating in Trinidad & Tobago. Help users with questions about booking appointments, payments, cancellation policies, and using the platform. Keep responses concise and helpful.",
          },
        ],
      },
      ...history.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.text }],
      })),
    ];

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const result = await chat.sendMessage(message);
    const answer = result.response.text();

    if (!answer) {
      return res.status(500).json({ error: "Empty response from AI" });
    }

    // Extract sections
    const sections = [];
    const sectionPatterns = [/【(\d+)】/g, /\[([^\]]+)\]/g];

    for (const pattern of sectionPatterns) {
      let match;
      while ((match = pattern.exec(answer)) !== null) {
        if (!sections.includes(match[1])) {
          sections.push(match[1]);
        }
      }
    }

    res.json({ answer, matchedSections: sections });
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({
      error: error.message || "Failed to process chat request",
    });
  }
});

// Serve React app for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist/client", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
