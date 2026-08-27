const express = require("express");
const cors = require("cors");

const { query } = require("./db");
const {
  ALL_SCOPES,
  BACKUP_TYPE,
  BACKUP_VERSION,
  ensureSchema,
  getRecordCounts,
  getRecords,
  syncBackupToDatabase,
  buildBackupFromDatabase,
  normalizeScopes,
} = require("./repository");

const PORT = Number(process.env.PORT) || 8787;
const ALLOWED_ORIGINS = String(process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl, server-to-server).
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.length === 0) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
  })
);
app.use(express.json({ limit: "100mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "falling-waters-postgres-api",
    health: "/api/db/health",
  });
});

app.get("/api/db/health", async (_req, res) => {
  try {
    const ping = await query("SELECT NOW() AS now");
    res.json({
      ok: true,
      backupType: BACKUP_TYPE,
      backupVersion: BACKUP_VERSION,
      now: ping.rows[0]?.now || null,
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Database health check failed." });
  }
});

app.get("/api/db/scopes", (_req, res) => {
  res.json({
    ok: true,
    scopes: ALL_SCOPES,
  });
});

app.get("/api/db/summary", async (_req, res) => {
  try {
    const summary = await getRecordCounts();
    res.json({ ok: true, summary });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Could not fetch database summary." });
  }
});

app.get("/api/db/records/:table", async (req, res) => {
  try {
    const records = await getRecords({
      table: String(req.params.table || ""),
      limit: Number(req.query.limit) || 200,
      offset: Number(req.query.offset) || 0,
    });
    res.json({ ok: true, records });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Could not fetch database records." });
  }
});

app.post("/api/db/sync", async (req, res) => {
  try {
    const body = req.body || {};
    const backup = body.backup || {};
    const mode = body.mode || "replace";
    const scopes = normalizeScopes(body.scopes);
    const result = await syncBackupToDatabase({
      backup,
      mode,
      scopes,
    });
    res.json({
      ok: true,
      result,
      message: "PostgreSQL sync completed.",
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || "Could not sync data to PostgreSQL." });
  }
});

app.post("/api/db/export", async (_req, res) => {
  try {
    const backup = await buildBackupFromDatabase();
    res.json({
      ok: true,
      backup,
      message: "PostgreSQL export completed.",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Could not export data from PostgreSQL." });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.message?.startsWith("Origin not allowed:")) {
    return res.status(403).json({ ok: false, error: error.message });
  }
  return res.status(500).json({ ok: false, error: error?.message || "Unexpected server error." });
});

const start = async () => {
  await ensureSchema();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`PostgreSQL API listening on port ${PORT}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start PostgreSQL API:", error);
  process.exit(1);
});
