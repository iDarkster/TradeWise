import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { prisma } from "./lib/prisma.js";
import { getConfig } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { securityHeaders } from "./middleware/securityHeaders.js";

const app = express();
const config = getConfig();

// Suppress framework identification.
app.disable("x-powered-by");

// Forwarded headers are only honoured when the connecting proxy is listed in
// TRUSTED_PROXIES. Otherwise a client could spoof its own address.
app.set("trust proxy", config.trustedProxies);

app.use(securityHeaders);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    // Non-browser clients (server-to-server, health checks) send no Origin.
    if (!origin) {
      callback(null, true);
      return;
    }

    if (config.cors.allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    // Answer without CORS headers; the browser then blocks the response.
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  maxAge: 600,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// API liveness check — does not require a database connection.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "TradeWise API is running",
  });
});

// Database readiness check — executes a real PostgreSQL query.
app.get("/api/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

registerRoutes(app);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
