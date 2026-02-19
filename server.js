const express = require("express");
const path = require("path");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 8081;
const BACKEND_PORT = 8000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "dist")));

// ============================================
// PROXY TO LOCAL FASTAPI BACKEND (Port 8000)
// ============================================

// Generic proxy function to forward requests to local FastAPI backend
function proxyToLocalBackend(req, res, targetPath) {
  const bodyData = req.method !== "GET" ? JSON.stringify(req.body) : "";

  const options = {
    hostname: "localhost",
    port: BACKEND_PORT,
    path: targetPath,
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(bodyData),
      ...req.headers,
      host: `localhost:${BACKEND_PORT}`,
    },
  };

  console.log(
    `[Proxy] ${req.method} ${targetPath} -> localhost:${BACKEND_PORT}`,
  );

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

      // Send the response body
      res.send(data);
    });
  });

  proxyReq.on("error", (error) => {
    console.error(`[Proxy Error] ${req.method} ${targetPath}:`, error.message);
    res.status(503).json({
      error: "Backend service unavailable",
      details: error.message,
    });
  });

  // Write body data for POST/PUT/PATCH requests
  if (bodyData) {
    proxyReq.write(bodyData);
  }

  proxyReq.end();
}

// ============================================
// AUTH ROUTES PROXY
// ============================================

// Login endpoint
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

// ============================================
// EXTERNAL RAG SERVER PROXY (Chatbot)
// ============================================

// Proxy endpoint for chatbot - forwards to external FastAPI RAG server
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;

    // Forward to external FastAPI server (RAG Server)
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

// ============================================
// HEALTH CHECK
// ============================================

app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "express" });
});

// ============================================
// SERVE REACT APP FOR ALL OTHER ROUTES
// ============================================

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(`========================================`);
  console.log(`Express server running on port ${PORT}`);
  console.log(`Proxying API requests to localhost:${BACKEND_PORT}`);
  console.log(`========================================`);
});
