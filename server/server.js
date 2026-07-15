/**
 * server.js — minimal production-style Express server.
 *
 * Two jobs:
 *  1. Serve the static site in /public (works exactly like any static host).
 *  2. Expose GET /api/sites so the data could later be edited server-side
 *     (e.g. from a database) without changing the front end.
 *
 * Run:   npm install && npm start
 * Then:  http://localhost:3000
 */
const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_FILE = path.join(PUBLIC_DIR, "sites.json");

// --- Basic security headers (no extra dependency required) ---
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// --- Lightweight request logging ---
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

// --- Static assets ---
app.use(
  express.static(PUBLIC_DIR, {
    maxAge: "1h",
    extensions: ["html"],
  })
);

// --- JSON API (reads the same file the static site fetches) ---
app.get("/api/sites", (req, res) => {
  fs.readFile(DATA_FILE, "utf8", (err, raw) => {
    if (err) {
      console.error("Failed to read sites.json:", err);
      return res.status(500).json({ error: "Could not load directory data." });
    }
    try {
      res.json(JSON.parse(raw));
    } catch (parseErr) {
      console.error("sites.json is not valid JSON:", parseErr);
      res.status(500).json({ error: "Directory data is malformed." });
    }
  });
});

app.get("/healthz", (req, res) => res.status(200).send("ok"));

// --- 404 fallback ---
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, "404.html"), (err) => {
    if (err) res.status(404).send("Not found");
  });
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).send("Something went wrong.");
});

const server = app.listen(PORT, () => {
  console.log(`Nepal Trusted Site Directory running at http://localhost:${PORT}`);
});

// --- Graceful shutdown ---
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down.");
  server.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down.");
  server.close(() => process.exit(0));
});
