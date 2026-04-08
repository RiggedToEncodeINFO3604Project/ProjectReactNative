const express = require("express");
const path = require("path");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 8081;
const BACKEND_PORT = 8000;
const RAG_PORT = 8001;
const LOCAL_BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

// ============================================
// WEBSOCKET PROXY SETUP (Render-Compatible)
// ============================================

// Create WebSocket proxy middleware with Render-specific configuration
const wsProxy = createProxyMiddleware({
  target: `http://localhost:${BACKEND_PORT}`,
  changeOrigin: true,
  ws: true,
  // Preserve WebSocket headers for Render compatibility
  preserveHeaderKeyCase: true,
  // Follow redirects
  followRedirects: true,
  // Path rewrite not needed for /ws
  pathRewrite: null,
  // Connection timeout for Render free tier (90s to avoid 100s limit)
  proxyTimeout: 90000,
  timeout: 90000,
  onError: (err, req, res) => {
    console.error("[WebSocket Proxy Error]:", err.message);
    console.error("[WebSocket Proxy Error] Request URL:", req?.url);
    console.error("[WebSocket Proxy Error] Headers:", req?.headers);
    // Send error response if res is available (not a WebSocket upgrade)
    if (res && res.writeHead) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "WebSocket proxy error",
          message: err.message,
        }),
      );
    }
  },
  onProxyReqWs: (proxyReq, req, socket, options, head) => {
    console.log(`[WebSocket] Upgrading ${req.url}`);
    console.log(`[WebSocket] Target: localhost:${BACKEND_PORT}/ws`);

    // Ensure proper headers for WebSocket upgrade
    proxyReq.setHeader("Host", `localhost:${BACKEND_PORT}`);
    proxyReq.setHeader("Connection", "Upgrade");
    proxyReq.setHeader("Upgrade", "websocket");
  },
  onProxyResWs: (proxyRes, req, socket) => {
    console.log(`[WebSocket] Proxy response status:`, proxyRes.statusCode);
  },
  logLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
});

// Use WebSocket proxy - must be registered before other routes
app.use("/ws", wsProxy);

// ============================================
// PROXY TO LOCAL FASTAPI BACKEND (Port 8000)
// ============================================

/**
 * Proxy function that properly handles both JSON and multipart requests
 * Uses raw body so auth and upload payloads pass through unchanged
 */
function proxyToLocalService(req, res, targetPath, targetPort) {
  const chunks = [];

  // Collect raw body data
  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("end", () => {
    const bodyData = Buffer.concat(chunks);

    // Forward the original content-type header (important for FormData)
    const headers = {
      ...req.headers,
      host: `localhost:${targetPort}`,
    };

    // Update content-length if we have body data
    if (bodyData.length > 0) {
      headers["content-length"] = bodyData.length;
    }

    const options = {
      hostname: "localhost",
      port: targetPort,
      path: targetPath,
      method: req.method,
      headers: headers,
    };

    console.log(`[Proxy] ${req.method} ${targetPath} -> localhost:${targetPort}`);
    console.log(`[Proxy] Content-Type: ${req.headers["content-type"]}`);

    const proxyReq = http.request(options, (proxyRes) => {
      let data = Buffer.alloc(0);

      proxyRes.on("data", (chunk) => {
        data = Buffer.concat([data, chunk]);
      });

      proxyRes.on("end", () => {
        // Forward the status code and headers
        res.status(proxyRes.statusCode);

        // Copy relevant headers
        if (proxyRes.headers["content-type"]) {
          res.setHeader("Content-Type", proxyRes.headers["content-type"]);
        }
        if (proxyRes.headers["access-control-allow-origin"]) {
          res.setHeader(
            "Access-Control-Allow-Origin",
            proxyRes.headers["access-control-allow-origin"],
          );
        }

        // Send the response body
        res.send(data);
      });
    });

    proxyReq.on("error", (error) => {
      console.error(
        `[Proxy Error] ${req.method} ${targetPath}:`,
        error.message,
      );
      res.status(503).json({
        error: "Backend service unavailable",
        details: error.message,
      });
    });

    // Write body data if present
    if (bodyData.length > 0) {
      proxyReq.write(bodyData);
    }

    proxyReq.end();
  });
}

function proxyToLocalBackend(req, res, targetPath) {
  return proxyToLocalService(req, res, targetPath, BACKEND_PORT);
}

function proxyToLocalRag(req, res, targetPath) {
  return proxyToLocalService(req, res, targetPath, RAG_PORT);
}

// ============================================
// AUTH ROUTES PROXY
// ============================================

// Login endpoint - handles Firebase ID token exchange
app.post("/auth/login", (req, res) => {
  proxyToLocalBackend(req, res, "/auth/login");
});

// Register customer
app.post("/auth/register/customer", (req, res) => {
  proxyToLocalBackend(req, res, "/auth/register/customer");
});

// Register provider
app.post("/auth/register/provider", (req, res) => {
  proxyToLocalBackend(req, res, "/auth/register/provider");
});

// ============================================
// CUSTOMER ROUTES PROXY
// ============================================

// Search providers
app.get("/customer/providers/search", (req, res) => {
  proxyToLocalBackend(
    req,
    res,
    `/customer/providers/search${req.url.replace("/customer/providers/search", "")}`,
  );
});

// Get provider availability
app.get("/customer/providers/:providerId/availability/:date", (req, res) => {
  const { providerId, date } = req.params;
  proxyToLocalBackend(
    req,
    res,
    `/customer/providers/${providerId}/availability/${date}`,
  );
});

// Get provider calendar
app.get("/customer/providers/:providerId/calendar/:year/:month", (req, res) => {
  const { providerId, year, month } = req.params;
  proxyToLocalBackend(
    req,
    res,
    `/customer/providers/${providerId}/calendar/${year}/${month}`,
  );
});

// Create booking
app.post("/customer/bookings", (req, res) => {
  proxyToLocalBackend(req, res, "/customer/bookings");
});

// Get customer bookings
app.get("/customer/bookings", (req, res) => {
  proxyToLocalBackend(req, res, "/customer/bookings");
});

// Cancel booking
app.delete("/customer/bookings/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  proxyToLocalBackend(req, res, `/customer/bookings/${bookingId}`);
});

// ============================================
// PROVIDER ROUTES PROXY
// ============================================

// Get provider services
app.get("/provider/services", (req, res) => {
  proxyToLocalBackend(req, res, "/provider/services");
});

// Add service
app.post("/provider/services", (req, res) => {
  proxyToLocalBackend(req, res, "/provider/services");
});

// Get availability
app.get("/provider/availability", (req, res) => {
  proxyToLocalBackend(req, res, "/provider/availability");
});

// Set availability
app.post("/provider/availability", (req, res) => {
  proxyToLocalBackend(req, res, "/provider/availability");
});

// Get pending bookings
app.get("/provider/bookings/pending", (req, res) => {
  proxyToLocalBackend(req, res, "/provider/bookings/pending");
});

// Get confirmed bookings
app.get("/provider/bookings/confirmed", (req, res) => {
  proxyToLocalBackend(req, res, "/provider/bookings/confirmed");
});

// Accept booking
app.post("/provider/bookings/:bookingId/accept", (req, res) => {
  const { bookingId } = req.params;
  proxyToLocalBackend(req, res, `/provider/bookings/${bookingId}/accept`);
});

// Reject booking
app.post("/provider/bookings/:bookingId/reject", (req, res) => {
  const { bookingId } = req.params;
  proxyToLocalBackend(req, res, `/provider/bookings/${bookingId}/reject`);
});

// Delete booking
app.delete("/provider/bookings/:bookingId", (req, res) => {
  const { bookingId } = req.params;
  proxyToLocalBackend(req, res, `/provider/bookings/${bookingId}`);
});

// Reschedule booking
app.put("/provider/bookings/:bookingId/reschedule", (req, res) => {
  const { bookingId } = req.params;
  proxyToLocalBackend(req, res, `/provider/bookings/${bookingId}/reschedule`);
});

// Get available slots for reschedule
app.get("/provider/bookings/:bookingId/available-slots", (req, res) => {
  const { bookingId } = req.params;
  const queryString = req.url.split("?")[1] || "";
  proxyToLocalBackend(
    req,
    res,
    `/provider/bookings/${bookingId}/available-slots${queryString ? "?" + queryString : ""}`,
  );
});

// Get customer snapshot
app.get("/provider/customer/:customerId/snapshot", (req, res) => {
  const { customerId } = req.params;
  proxyToLocalBackend(req, res, `/provider/customer/${customerId}/snapshot`);
});

// ============================================
// MESSAGING ROUTES PROXY
// ============================================

// List conversations
app.get("/api/messaging/conversations", (req, res) => {
  proxyToLocalBackend(req, res, "/api/messaging/conversations");
});

// Start conversation
app.post(
  "/api/messaging/conversations/start",
  express.json(),
  async (req, res) => {
    try {
      const targetUrl =
        LOCAL_BACKEND_URL + "/api/messaging/conversations/start";
      const headers = {
        ...req.headers,
        host: new URL(LOCAL_BACKEND_URL).host,
      };
      delete headers["content-length"];

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
      });

      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Proxy error" });
    }
  },
);

// Get conversation details
app.get("/api/messaging/conversations/:conversationId", (req, res) => {
  const { conversationId } = req.params;
  proxyToLocalBackend(
    req,
    res,
    `/api/messaging/conversations/${conversationId}`,
  );
});

// Get messages (with query params for pagination)
app.get("/api/messaging/conversations/:conversationId/messages", (req, res) => {
  const { conversationId } = req.params;
  const queryString = req.url.split("?")[1] || "";
  proxyToLocalBackend(
    req,
    res,
    `/api/messaging/conversations/${conversationId}/messages${queryString ? "?" + queryString : ""}`,
  );
});

// Send message
app.post(
  "/api/messaging/conversations/:conversationId/messages",
  express.json(),
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const targetUrl =
        LOCAL_BACKEND_URL +
        `/api/messaging/conversations/${conversationId}/messages`;
      const headers = {
        ...req.headers,
        host: new URL(LOCAL_BACKEND_URL).host,
      };
      delete headers["content-length"];

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
      });

      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Proxy error" });
    }
  },
);

// Mark conversation as read
app.post(
  "/api/messaging/conversations/:conversationId/read",
  express.json(),
  async (req, res) => {
    try {
      const { conversationId } = req.params;
      const targetUrl =
        LOCAL_BACKEND_URL +
        `/api/messaging/conversations/${conversationId}/read`;
      const headers = {
        ...req.headers,
        host: new URL(LOCAL_BACKEND_URL).host,
      };
      delete headers["content-length"];

      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(req.body),
      });

      const data = await response.text();
      res.status(response.status).send(data);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Proxy error" });
    }
  },
);

// ============================================
// EXTERNAL RAG SERVER PROXY (Chatbot)
// ============================================

// Proxy endpoint for chatbot - forwards to the local RAG FastAPI server
app.post("/api/chat", express.json(), async (req, res) => {
  proxyToLocalRag(req, res, "/api/chat");
});

app.get("/api/rag/health", (req, res) => {
  proxyToLocalRag(req, res, "/api/health");
});

// ============================================
// HEALTH CHECK (Required for Render)
// ============================================

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "express",
    timestamp: new Date().toISOString(),
    websocket: {
      proxyEnabled: true,
      backendPort: BACKEND_PORT,
    },
    rag: {
      proxyEnabled: true,
      ragPort: RAG_PORT,
    },
  });
});

// ============================================
// WEBSOCKET TEST ENDPOINT
// ============================================

// Test endpoint to verify WebSocket proxy is accessible
app.get("/ws-test", (req, res) => {
  res.json({
    status: "WebSocket endpoint available",
    websocketUrl: `/ws`,
    instructions: "Connect to wss://<host>/ws?token=<firebase_id_token>",
    backendTarget: `ws://localhost:${BACKEND_PORT}/ws`,
  });
});

// ============================================
// SERVE STATIC FILES (after API routes)
// ============================================

app.use(express.static(path.join(__dirname, "dist")));

// ============================================
// SERVE REACT APP FOR ALL OTHER ROUTES
// ============================================

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`========================================`);
  console.log(`Express server running on port ${PORT}`);
  console.log(`Proxying API requests to localhost:${BACKEND_PORT}`);
  console.log(`Proxying RAG requests to localhost:${RAG_PORT}`);
  console.log(`WebSocket proxy enabled on /ws`);
  console.log(`WebSocket target: ws://localhost:${BACKEND_PORT}/ws`);
  console.log(`========================================`);
});

// Handle WebSocket upgrade events (Render-compatible)
server.on("upgrade", (request, socket, head) => {
  console.log(`[WebSocket Upgrade] Request received for ${request.url}`);

  // Log essential headers for debugging
  const essentialHeaders = {
    upgrade: request.headers.upgrade,
    connection: request.headers.connection,
    origin: request.headers.origin,
    host: request.headers.host,
  };
  console.log(`[WebSocket Upgrade] Essential headers:`, essentialHeaders);

  if (request.url.startsWith("/ws")) {
    console.log(`[WebSocket Upgrade] Routing to backend proxy`);

    // Set a timeout for the upgrade to prevent hanging
    const upgradeTimeout = setTimeout(() => {
      console.error(`[WebSocket Upgrade] Timeout after 10s`);
      socket.write("HTTP/1.1 504 Gateway Timeout\r\n\r\n");
      socket.destroy();
    }, 10000);

    wsProxy.upgrade(request, socket, head, (err) => {
      clearTimeout(upgradeTimeout);

      if (err) {
        console.error(`[WebSocket Upgrade] Error:`, err.message);
        // Send proper HTTP error response before destroying
        try {
          socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        } catch (e) {
          // Socket may already be closed
        }
        socket.destroy();
      } else {
        console.log(`[WebSocket Upgrade] Successfully upgraded`);
      }
    });
  } else {
    console.log(`[WebSocket Upgrade] No route for ${request.url}`);
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
  }
});
