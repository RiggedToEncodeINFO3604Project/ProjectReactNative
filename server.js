const express = require("express");
const path = require("path");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

// Proxy endpoint for chatbot - forwards to FastAPI server
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    // Forward to FastAPI server
    const fastapiUrl = "https://rag-server-bf1a.onrender.com/api/chat";

    const postData = JSON.stringify({ message, history });

    const options = {
      hostname: "render-app.onrender.com",
      path: "/api/chat",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      let data = "";
      proxyRes.on("data", (chunk) => {
        data += chunk;
      });
      proxyRes.on("end", () => {
        try {
          const parsedData = JSON.parse(data);
          res.status(proxyRes.statusCode).json(parsedData);
        } catch (error) {
          res.status(500).json({ error: "Failed to parse FastAPI response" });
        }
      });
    });

    proxyReq.on("error", (error) => {
      console.error("Proxy error:", error);
      res.status(500).json({
        error: error.message || "Failed to connect to FastAPI server",
      });
    });

    proxyReq.write(postData);
    proxyReq.end();
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({
      error: error.message || "Failed to process chat request",
    });
  }
});

// Serve React app for all other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
