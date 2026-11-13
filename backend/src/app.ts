
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.js";

const app = express();

app.use(cors());
app.use(express.json());

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

export { app };
