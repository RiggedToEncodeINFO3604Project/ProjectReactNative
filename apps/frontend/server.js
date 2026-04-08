const express = require("express");
const path = require("path");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 8081;
const BACKEND_PORT = 8000;
const RAG_PORT = 8001;
const HEALTHCHECK_TIMEOUT_MS = 3000;

// ============================================
// WEBSOCKET PROXY SETUP (Render-Compatible)
// ============================================

const wsProxy = createProxyMiddleware({
  target: `http://localhost:${BACKEND_PORT}`,
  changeOrigin: true,
  ws: true,
  preserveHeaderKeyCase: true,
  followRedirects: true,
  pathRewrite: null,
  proxyTimeout: 90000,
  timeout: 90000,
  onError: (err, req, res) => {
    console.error("[WebSocket Proxy Error]:", err.message);
    console.error("[WebSocket Proxy Error] Request URL:", req?.url);
    console.error("[WebSocket Proxy Error] Headers:", req?.headers);
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
  onProxyReqWs: (proxyReq, req) => {
    console.log(`[WebSocket] Upgrading ${req.url}`);
    console.log(`[WebSocket] Target: localhost:${BACKEND_PORT}/ws`);
    proxyReq.setHeader("Host", `localhost:${BACKEND_PORT}`);
    proxyReq.setHeader("Connection", "Upgrade");
    proxyReq.setHeader("Upgrade", "websocket");
  },
  onProxyResWs: (proxyRes) => {
    console.log(`[WebSocket] Proxy response status:`, proxyRes.statusCode);
  },
  logLevel: process.env.NODE_ENV === "production" ? "info" : "debug",
});

app.use("/ws", wsProxy);

// ============================================
// GENERIC HTTP PROXY HELPERS
// ============================================

function proxyToLocalService(req, res, targetPath, targetPort) {
  const chunks = [];

  req.on("data", (chunk) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  req.on("error", (error) => {
    console.error(`[Proxy Error] ${req.method} ${targetPath}:`, error.message);
    if (!res.headersSent) {
      res.status(400).json({
        error: "Invalid request body",
        details: error.message,
      });
    }
  });

  req.on("end", () => {
    const bodyData = Buffer.concat(chunks);
    const headers = {
      ...req.headers,
      host: `localhost:${targetPort}`,
    };

    if (bodyData.length > 0) {
      headers["content-length"] = String(bodyData.length);
    } else {
      delete headers["content-length"];
    }

    const options = {
      hostname: "localhost",
      port: targetPort,
      path: targetPath,
      method: req.method,
      headers,
    };

    console.log(`[Proxy] ${req.method} ${targetPath} -> localhost:${targetPort}`);

    const proxyReq = http.request(options, (proxyRes) => {
      const responseChunks = [];

      proxyRes.on("data", (chunk) => {
        responseChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      proxyRes.on("end", () => {
        const responseBody = Buffer.concat(responseChunks);
        const excludedHeaders = new Set(["connection", "keep-alive"]);

        for (const [headerName, headerValue] of Object.entries(
          proxyRes.headers,
        )) {
          if (
            headerValue === undefined ||
            excludedHeaders.has(headerName.toLowerCase())
          ) {
            continue;
          }
          res.setHeader(headerName, headerValue);
        }

        res.status(proxyRes.statusCode || 502).send(responseBody);
      });
    });

    proxyReq.on("error", (error) => {
      console.error(
        `[Proxy Error] ${req.method} ${targetPath}:`,
        error.message,
      );
      if (!res.headersSent) {
        res.status(503).json({
          error: "Backend service unavailable",
          details: error.message,
        });
      }
    });

    if (bodyData.length > 0) {
      proxyReq.write(bodyData);
    }

    proxyReq.end();
  });
}

function proxyToLocalBackend(req, res, targetPath = req.originalUrl) {
  return proxyToLocalService(req, res, targetPath, BACKEND_PORT);
}

function proxyToLocalRag(req, res, targetPath = req.originalUrl) {
  return proxyToLocalService(req, res, targetPath, RAG_PORT);
}

function checkLocalServiceHealth(serviceName, targetPort, targetPath) {
  return new Promise((resolve) => {
    const request = http.request(
      {
        hostname: "localhost",
        port: targetPort,
        path: targetPath,
        method: "GET",
        timeout: HEALTHCHECK_TIMEOUT_MS,
      },
      (serviceResponse) => {
        const chunks = [];

        serviceResponse.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        serviceResponse.on("end", () => {
          const rawBody = Buffer.concat(chunks).toString("utf8");
          let body = rawBody;

          try {
            body = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            // Keep raw string body for debugging.
          }

          resolve({
            service: serviceName,
            ok:
              (serviceResponse.statusCode || 500) >= 200 &&
              (serviceResponse.statusCode || 500) < 300,
            statusCode: serviceResponse.statusCode || 500,
            body,
          });
        });
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("Timed out waiting for response"));
    });

    request.on("error", (error) => {
      resolve({
        service: serviceName,
        ok: false,
        statusCode: 503,
        error: error.message,
      });
    });

    request.end();
  });
}

// ============================================
// BACKEND AND RAG ROUTE PROXIES
// ============================================

app.all(/^\/(?:auth|customer|provider)(?:\/.*)?$/, (req, res) => {
  proxyToLocalBackend(req, res);
});

app.all(/^\/api\/messaging(?:\/.*)?$/, (req, res) => {
  proxyToLocalBackend(req, res);
});

app.all("/api/chat", (req, res) => {
  proxyToLocalRag(req, res, "/api/chat");
});

app.all("/api/rag/health", (req, res) => {
  proxyToLocalRag(req, res, "/api/health");
});

// ============================================
// HEALTH CHECKS
// ============================================

app.get("/health", async (req, res) => {
  const [backendHealth, ragHealth] = await Promise.all([
    checkLocalServiceHealth("backend", BACKEND_PORT, "/health"),
    checkLocalServiceHealth("rag", RAG_PORT, "/api/health"),
  ]);

  const allHealthy = backendHealth.ok && ragHealth.ok;

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? "healthy" : "degraded",
    service: "express",
    timestamp: new Date().toISOString(),
    websocket: {
      proxyEnabled: true,
      backendPort: BACKEND_PORT,
    },
    services: {
      backend: backendHealth,
      rag: ragHealth,
    },
  });
});

app.get("/ws-test", (req, res) => {
  res.json({
    status: "WebSocket endpoint available",
    websocketUrl: "/ws",
    instructions: "Connect to wss://<host>/ws?token=<firebase_id_token>",
    backendTarget: `ws://localhost:${BACKEND_PORT}/ws`,
  });
});

// ============================================
// SERVE STATIC FILES
// ============================================

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log(`Express server running on port ${PORT}`);
  console.log(`Proxying backend requests to localhost:${BACKEND_PORT}`);
  console.log(`Proxying RAG requests to localhost:${RAG_PORT}`);
  console.log("WebSocket proxy enabled on /ws");
  console.log(`WebSocket target: ws://localhost:${BACKEND_PORT}/ws`);
  console.log("========================================");
});

server.on("upgrade", (request, socket, head) => {
  console.log(`[WebSocket Upgrade] Request received for ${request.url}`);

  const essentialHeaders = {
    upgrade: request.headers.upgrade,
    connection: request.headers.connection,
    origin: request.headers.origin,
    host: request.headers.host,
  };
  console.log("[WebSocket Upgrade] Essential headers:", essentialHeaders);

  if (request.url.startsWith("/ws")) {
    console.log("[WebSocket Upgrade] Routing to backend proxy");

    const upgradeTimeout = setTimeout(() => {
      console.error("[WebSocket Upgrade] Timeout after 10s");
      socket.write("HTTP/1.1 504 Gateway Timeout\r\n\r\n");
      socket.destroy();
    }, 10000);

    wsProxy.upgrade(request, socket, head, (err) => {
      clearTimeout(upgradeTimeout);

      if (err) {
        console.error("[WebSocket Upgrade] Error:", err.message);
        try {
          socket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        } catch {
          // Socket may already be closed.
        }
        socket.destroy();
      } else {
        console.log("[WebSocket Upgrade] Successfully upgraded");
      }
    });
    return;
  }

  console.log(`[WebSocket Upgrade] No route for ${request.url}`);
  socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
  socket.destroy();
});
