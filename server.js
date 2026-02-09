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

    // Forward to FastAPI server (RAG Server)
    const FASTAPI_HOST =
      process.env.FASTAPI_HOST || "rag-server-bf1a.onrender.com";
    const FASTAPI_PATH = "/api/chat";

    const postData = JSON.stringify({ message, history });

    const options = {
      hostname: FASTAPI_HOST,
      path: FASTAPI_PATH,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
        "User-Agent": "Express-Proxy/1.0",
        Accept: "application/json",
      },
    };

    console.log(`Proxying to: https://${FASTAPI_HOST}${FASTAPI_PATH}`);

    const proxyReq = https.request(options, (proxyRes) => {
      let data = Buffer.alloc(0);

      proxyRes.on("data", (chunk) => {
        data = Buffer.concat([data, chunk]);
      });

      proxyRes.on("end", () => {
        console.log(`FastAPI response status: ${proxyRes.statusCode}`);
        console.log(`FastAPI response headers:`, proxyRes.headers);

        const contentType = proxyRes.headers["content-type"] || "";

        if (!contentType.includes("application/json")) {
          console.error(`Unexpected content-type: ${contentType}`);
          console.error(
            `Raw response: ${data.toString("utf-8").substring(0, 500)}`,
          );
          return res.status(500).json({
            error: "FastAPI returned non-JSON response",
            contentType,
            rawResponse: data.toString("utf-8").substring(0, 300),
          });
        }

        try {
          const parsedData = JSON.parse(data.toString("utf-8"));
          res.status(proxyRes.statusCode).json(parsedData);
        } catch (error) {
          console.error("Failed to parse FastAPI response:", error.message);
          console.error(
            "Raw response:",
            data.toString("utf-8").substring(0, 500),
          );
          res.status(500).json({
            error: "Failed to parse FastAPI response",
            details: error.message,
          });
        }
      });
    });

    proxyReq.on("error", (error) => {
      console.error("Proxy error:", error);
      res.status(500).json({
        error: "Failed to connect to FastAPI server",
        details: error.message,
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
