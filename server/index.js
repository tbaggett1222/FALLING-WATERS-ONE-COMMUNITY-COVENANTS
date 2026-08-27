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
const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
};
const ALERT_MAX_SYNC_AGE_MINUTES = parsePositiveInt(process.env.ALERT_MAX_SYNC_AGE_MINUTES, 24 * 60);
const ALERT_MIN_STATE_KEYS = parsePositiveInt(process.env.ALERT_MIN_STATE_KEYS, 1);
const ALERT_MIN_SCOPE_RECORDS = parsePositiveInt(process.env.ALERT_MIN_SCOPE_RECORDS, 1);

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
    alertStatus: "/api/db/alert-status",
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

app.get("/api/db/alert-status", async (req, res) => {
  const checkedAt = new Date().toISOString();
  const strict = ["1", "true", "yes", "strict"].includes(String(req.query.strict || "").toLowerCase());
  const checks = [];
  let status = "pass";
  const escalate = (nextStatus) => {
    if (nextStatus === "fail") {
      status = "fail";
      return;
    }
    if (nextStatus === "warn" && status === "pass") {
      status = "warn";
    }
  };

  try {
    const [pingResult, summary, latestSnapshotResult] = await Promise.all([
      query("SELECT NOW() AS now"),
      getRecordCounts(),
      query("SELECT id, created_at FROM backup_snapshots ORDER BY created_at DESC LIMIT 1"),
    ]);

    checks.push({
      check: "database_connection",
      status: "pass",
      detail: `Database responded at ${pingResult.rows[0]?.now || "unknown"}.`,
    });

    const snapshotsCount = Number(summary?.backup_snapshots || 0);
    const latestSnapshot = latestSnapshotResult.rows[0] || null;
    if (!latestSnapshot) {
      checks.push({
        check: "sync_freshness",
        status: "warn",
        detail: "No sync snapshot found yet. Run a portal sync to establish baseline data.",
      });
      escalate("warn");
    } else {
      const ageMinutes = Math.floor((Date.now() - new Date(latestSnapshot.created_at).getTime()) / 60000);
      if (ageMinutes > ALERT_MAX_SYNC_AGE_MINUTES) {
        checks.push({
          check: "sync_freshness",
          status: "warn",
          detail: `Latest sync snapshot is stale (${ageMinutes} minutes old, threshold ${ALERT_MAX_SYNC_AGE_MINUTES} minutes).`,
        });
        escalate("warn");
      } else {
        checks.push({
          check: "sync_freshness",
          status: "pass",
          detail: `Latest sync snapshot is ${ageMinutes} minutes old.`,
        });
      }
    }

    const stateKeys = Number(summary?.state_values || 0);
    if (stateKeys < ALERT_MIN_STATE_KEYS) {
      checks.push({
        check: "state_keys_minimum",
        status: "warn",
        detail: `state_values has ${stateKeys} rows (minimum ${ALERT_MIN_STATE_KEYS}).`,
      });
      escalate("warn");
    } else {
      checks.push({
        check: "state_keys_minimum",
        status: "pass",
        detail: `state_values has ${stateKeys} rows.`,
      });
    }

    const scopeRecordsTotal = Array.isArray(summary?.scope_records)
      ? summary.scope_records.reduce((acc, row) => acc + Number(row?.count || 0), 0)
      : 0;
    if (scopeRecordsTotal < ALERT_MIN_SCOPE_RECORDS) {
      checks.push({
        check: "scope_records_minimum",
        status: "warn",
        detail: `scope_records has ${scopeRecordsTotal} rows (minimum ${ALERT_MIN_SCOPE_RECORDS}).`,
      });
      escalate("warn");
    } else {
      checks.push({
        check: "scope_records_minimum",
        status: "pass",
        detail: `scope_records has ${scopeRecordsTotal} rows.`,
      });
    }

    const responseBody = {
      ok: true,
      status,
      strict,
      checkedAt,
      thresholds: {
        maxSyncAgeMinutes: ALERT_MAX_SYNC_AGE_MINUTES,
        minStateKeys: ALERT_MIN_STATE_KEYS,
        minScopeRecords: ALERT_MIN_SCOPE_RECORDS,
      },
      metrics: {
        stateValues: stateKeys,
        scopeRecordsTotal,
        covenantAssets: Number(summary?.covenant_assets || 0),
        backupSnapshots: snapshotsCount,
        latestSnapshotAt: latestSnapshot?.created_at || null,
      },
      checks,
    };

    const statusCode = strict && status !== "pass" ? 503 : 200;
    res.status(statusCode).json(responseBody);
  } catch (error) {
    res.status(503).json({
      ok: false,
      status: "fail",
      strict,
      checkedAt,
      error: error.message || "Alert status check failed.",
    });
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
