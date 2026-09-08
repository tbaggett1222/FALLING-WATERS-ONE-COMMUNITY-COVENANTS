const express = require("express");
const cors = require("cors");

const { query } = require("./db");
const { createGzipJsonMiddleware } = require("./gzipJsonMiddleware");
const {
  ALL_SCOPES,
  BACKUP_TYPE,
  BACKUP_VERSION,
  ensureSchema,
  SHARED_REFRESH_SCOPES,
  getRecordCounts,
  getRecords,
  syncBackupToDatabase,
  buildBackupFromDatabase,
  buildSharedChangesFromDatabase,
  createPasswordResetRequest,
  listPasswordResetRequests,
  resolvePasswordResetRequest,
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
const BACKUP_SNAPSHOT_KEEP_COUNT = parsePositiveInt(process.env.BACKUP_SNAPSHOT_KEEP_COUNT, 60);
// Only gzip JSON responses above this size; tiny bodies cost more in headers than they save.
const GZIP_MIN_BYTES = parsePositiveInt(process.env.GZIP_MIN_BYTES, 1024);
const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  const raw = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y"].includes(raw)) return true;
  if (["0", "false", "no", "n"].includes(raw)) return false;
  return fallback;
};

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
// Gzip JSON responses to minimize outbound bandwidth (Render egress).
app.use(createGzipJsonMiddleware({ minBytes: GZIP_MIN_BYTES }));
app.use(express.json({ limit: "100mb" }));

let schemaReady = false;
let schemaInitInFlight = null;

const ensureSchemaReady = async () => {
  if (schemaReady) return;
  if (!schemaInitInFlight) {
    schemaInitInFlight = ensureSchema()
      .then(() => {
        schemaReady = true;
      })
      .finally(() => {
        schemaInitInFlight = null;
      });
  }
  return schemaInitInFlight;
};

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "falling-waters-postgres-api",
    health: "/api/db/health",
    alertStatus: "/api/db/alert-status",
    sharedRefresh: "/api/db/shared-refresh",
  });
});

app.get("/api/db/health", async (_req, res) => {
  try {
    await ensureSchemaReady();
    const ping = await query("SELECT NOW() AS now");
    res.json({
      ok: true,
      backupType: BACKUP_TYPE,
      backupVersion: BACKUP_VERSION,
      now: ping.rows[0]?.now || null,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: error.message || "Database health check failed.",
      hint: "Ensure PostgreSQL is running and DATABASE_URL points to a reachable Postgres host.",
    });
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
    const [pingResult, summary, latestSnapshotResult, latestScopeSyncResult] = await Promise.all([
      query("SELECT NOW() AS now"),
      getRecordCounts(),
      query("SELECT id, created_at FROM backup_snapshots ORDER BY created_at DESC LIMIT 1"),
      query("SELECT MAX(last_synced_at) AS last_synced_at FROM scope_sync_state"),
    ]);

    checks.push({
      check: "database_connection",
      status: "pass",
      detail: `Database responded at ${pingResult.rows[0]?.now || "unknown"}.`,
    });

    const snapshotsCount = Number(summary?.backup_snapshots || 0);
    const latestSnapshot = latestSnapshotResult.rows[0] || null;
    const latestScopeSyncAt = latestScopeSyncResult.rows[0]?.last_synced_at || null;
    const latestDataSyncAt = [latestSnapshot?.created_at || null, latestScopeSyncAt]
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((a, b) => b.getTime() - a.getTime())[0] || null;
    if (!latestDataSyncAt) {
      checks.push({
        check: "sync_freshness",
        status: "warn",
        detail: "No sync activity found yet. Run a portal sync to establish baseline data.",
      });
      escalate("warn");
    } else {
      const ageMinutes = Math.floor((Date.now() - latestDataSyncAt.getTime()) / 60000);
      if (ageMinutes > ALERT_MAX_SYNC_AGE_MINUTES) {
        checks.push({
          check: "sync_freshness",
          status: "warn",
          detail: `Latest sync activity is stale (${ageMinutes} minutes old, threshold ${ALERT_MAX_SYNC_AGE_MINUTES} minutes).`,
        });
        escalate("warn");
      } else {
        checks.push({
          check: "sync_freshness",
          status: "pass",
          detail: `Latest sync activity is ${ageMinutes} minutes old.`,
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
        latestScopeSyncAt,
        latestDataSyncAt: latestDataSyncAt ? latestDataSyncAt.toISOString() : null,
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
    await ensureSchemaReady();
    const summary = await getRecordCounts();
    res.json({ ok: true, summary });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Could not fetch database summary." });
  }
});

app.get("/api/db/shared-refresh", async (req, res) => {
  try {
    await ensureSchemaReady();
    const since = req.query.since ? String(req.query.since) : null;
    const refresh = await getSharedRefreshBundle({ since });
    res.json({
      ok: true,
      sharedScopes: SHARED_REFRESH_SCOPES,
      refresh,
      message:
        Object.keys(refresh.scopes || {}).length > 0
          ? `Shared refresh payload ready for ${Object.keys(refresh.scopes || {}).length} scope(s).`
          : "No shared scope changes since the provided cursor.",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Could not load shared refresh data." });
  }
});

app.get("/api/db/records/:table", async (req, res) => {
  try {
    await ensureSchemaReady();
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
    await ensureSchemaReady();
    const body = req.body || {};
    const backup = body.backup || {};
    const mode = body.mode || "replace";
    const scopes = normalizeScopes(body.scopes);
    const createSnapshot = body.createSnapshot === true;
    const result = await syncBackupToDatabase({
      backup,
      mode,
      scopes,
      createSnapshot,
    });
    res.json({
      ok: true,
      result,
      message: createSnapshot
        ? "PostgreSQL sync completed and a backup snapshot was recorded."
        : "PostgreSQL sync completed.",
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || "Could not sync data to PostgreSQL." });
  }
});

// Residents who are locked out (forgot their per-lot voting password) file a
// reset request here without being signed in. Kept intentionally narrow: it can
// only append a request, never read or overwrite portal data.
app.post("/api/db/reset-requests", async (req, res) => {
  try {
    await ensureSchemaReady();
    const body = req.body || {};
    const request = await createPasswordResetRequest({
      name: body.name,
      lots: body.lots,
      lot: body.lot,
      message: body.message,
    });
    res.json({
      ok: true,
      request,
      message: "Password reset request submitted. An administrator will review it.",
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || "Could not submit password reset request." });
  }
});

// Admin-only review + resolution of reset requests. Gated by the same
// x-portal-admin-action header the export/restore endpoints use.
const requireAdminAction = (req, res, allowed) => {
  const action = String(req.headers["x-portal-admin-action"] || "").trim().toLowerCase();
  if (!allowed.includes(action)) {
    res.status(403).json({
      ok: false,
      error: "This action is restricted to portal administrators.",
    });
    return false;
  }
  return true;
};

app.get("/api/db/reset-requests", async (req, res) => {
  if (!requireAdminAction(req, res, ["reset-review", "reset-resolve", "backup", "restore"])) return;
  try {
    await ensureSchemaReady();
    const status = req.query.status ? String(req.query.status) : null;
    const requests = await listPasswordResetRequests({ status });
    res.json({ ok: true, requests });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Could not load password reset requests." });
  }
});

app.post("/api/db/reset-requests/resolve", async (req, res) => {
  if (!requireAdminAction(req, res, ["reset-resolve", "reset-review"])) return;
  try {
    await ensureSchemaReady();
    const body = req.body || {};
    const request = await resolvePasswordResetRequest({
      id: body.id,
      status: body.status,
      resolvedBy: body.resolvedBy,
    });
    res.json({ ok: true, request, message: "Password reset request updated." });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message || "Could not update password reset request." });
  }
});

app.get("/api/db/shared/changes", async (req, res) => {
  try {
    await ensureSchemaReady();
    const rawSince = String(req.query.since || "").trim();
    let since = null;
    if (rawSince) {
      const parsed = new Date(rawSince);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ ok: false, error: "Invalid 'since' timestamp." });
      }
      since = parsed;
    }
    const result = await buildSharedChangesFromDatabase({ since });
    res.json({
      ok: true,
      result,
      message: since
        ? "Shared refresh delta generated."
        : "Shared refresh baseline generated.",
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message || "Could not fetch shared refresh changes." });
  }
});

app.post("/api/db/export", async (req, res) => {
  try {
    await ensureSchemaReady();
    const adminAction = String(req.headers["x-portal-admin-action"] || "").trim().toLowerCase();
    if (!["backup", "restore"].includes(adminAction)) {
      return res.status(403).json({
        ok: false,
        error: "Full export is restricted to administrator backup/restore actions.",
      });
    }
    const backup = await buildBackupFromDatabase();
    res.json({
      ok: true,
      backup,
      scope: "full",
      allowedFor: "administrator_backup_restore",
      message: "PostgreSQL full export completed.",
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

const start = () => {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`PostgreSQL API listening on port ${PORT}`);
  });
  ensureSchemaReady().catch((error) => {
    // eslint-disable-next-line no-console
    console.error("PostgreSQL API started, but database initialization failed:", error);
  });
};

start();
