const { query, withClient } = require("./db");

const BACKUP_TYPE = "falling-waters-portal-backup";
const BACKUP_VERSION = 1;
const VALID_VOTE_CHOICES = new Set(["eliminate", "permit", "undecided"]);
const ALL_SCOPES = [
  "lotSettings",
  "votes",
  "comments",
  "ownerActivity",
  "outreach",
  "eligibility",
  "primaryVoters",
  "adminAccess",
  "userDirectory",
  "covenantDocs",
  "covenantFiles",
  "sessionUser",
];

const SCOPE_CONFIG = {
  lotSettings: {
    stateKeys: ["fw_total_lots", "fw_backup_health_threshold_days"],
    recordScopes: [],
    includesAssets: false,
  },
  votes: {
    stateKeys: ["fw_votes"],
    recordScopes: ["voteLedger", "legacyVoteEntries"],
    includesAssets: false,
  },
  comments: {
    stateKeys: ["fw_comments_data_version"],
    recordScopes: ["comments"],
    includesAssets: false,
  },
  ownerActivity: {
    stateKeys: [],
    recordScopes: ["ownerActivity"],
    includesAssets: false,
  },
  outreach: {
    stateKeys: [],
    recordScopes: ["outreach"],
    includesAssets: false,
  },
  eligibility: {
    stateKeys: [],
    recordScopes: ["voteEligibility"],
    includesAssets: false,
  },
  primaryVoters: {
    stateKeys: ["fw_primary_voter_transfer_audit"],
    recordScopes: ["primaryVoters"],
    includesAssets: false,
  },
  adminAccess: {
    stateKeys: ["fw_admin_access_entries", "fw_admin_access_grades"],
    recordScopes: ["adminAccess", "adminAccessGrades"],
    includesAssets: false,
  },
  userDirectory: {
    stateKeys: [],
    recordScopes: ["userDirectory"],
    includesAssets: false,
  },
  covenantDocs: {
    stateKeys: [],
    recordScopes: ["covenantDocs"],
    includesAssets: false,
  },
  covenantFiles: {
    stateKeys: [],
    recordScopes: [],
    includesAssets: true,
  },
  sessionUser: {
    stateKeys: ["fw_user", "fw_last_backup_export_at"],
    recordScopes: [],
    includesAssets: false,
  },
};

const normalizeNameKey = (name) =>
  String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

const sanitizeObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const normalizeScopes = (inputScopes = {}) => {
  const normalized = {};
  ALL_SCOPES.forEach((scope) => {
    normalized[scope] = true;
  });
  if (!inputScopes || typeof inputScopes !== "object") {
    return normalized;
  }
  ALL_SCOPES.forEach((scope) => {
    if (Object.prototype.hasOwnProperty.call(inputScopes, scope)) {
      normalized[scope] = inputScopes[scope] !== false;
    }
  });
  return normalized;
};

const hasSelectedScope = (scopes) =>
  Object.values(normalizeScopes(scopes)).some(Boolean);

const ensureSchema = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS state_values (
      key TEXT PRIMARY KEY,
      value_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS scope_records (
      scope TEXT NOT NULL,
      row_id TEXT NOT NULL,
      position INTEGER,
      data_json JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (scope, row_id)
    );
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_scope_records_scope_position
    ON scope_records(scope, position, row_id);
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS covenant_assets (
      asset_id TEXT PRIMARY KEY,
      file_name TEXT,
      file_type TEXT,
      updated_at_ms BIGINT,
      blob_data_url TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS backup_snapshots (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      backup_type TEXT NOT NULL,
      version INTEGER NOT NULL,
      mode TEXT NOT NULL,
      scopes_json JSONB NOT NULL,
      backup_json JSONB NOT NULL
    );
  `);
};

const serializeBackup = (backup) => {
  const payload = backup?.payload && typeof backup.payload === "object" ? backup.payload : backup || {};
  const stateValues = {
    fw_user: payload.fw_user ?? null,
    fw_votes: payload.fw_votes ?? null,
    fw_comments_data_version: payload.fw_comments_data_version ?? 2,
    fw_total_lots: payload.fw_total_lots ?? null,
    fw_last_backup_export_at: payload.fw_last_backup_export_at ?? null,
    fw_backup_health_threshold_days: payload.fw_backup_health_threshold_days ?? null,
    fw_primary_voter_transfer_audit: Array.isArray(payload.fw_primary_voter_transfer_audit)
      ? payload.fw_primary_voter_transfer_audit
      : [],
    fw_admin_access_entries: Array.isArray(payload.fw_admin_access_entries) ? payload.fw_admin_access_entries : [],
    fw_admin_access_grades: payload.fw_admin_access_grades ?? {},
  };

  const rowsByScope = {
    comments: [],
    covenantDocs: [],
    ownerActivity: [],
    voteLedger: [],
    primaryVoters: [],
    outreach: [],
    userDirectory: [],
    adminAccess: [],
    adminAccessGrades: [],
    voteEligibility: [],
    legacyVoteEntries: [],
  };

  (Array.isArray(payload.fw_comments) ? payload.fw_comments : []).forEach((row, idx) => {
    rowsByScope.comments.push({
      rowId: row?.id ? `id:${row.id}` : `idx:${idx}`,
      position: idx,
      data: row,
    });
  });

  (Array.isArray(payload.fw_covenant_docs) ? payload.fw_covenant_docs : []).forEach((row, idx) => {
    rowsByScope.covenantDocs.push({
      rowId: row?.id ? String(row.id) : `idx:${idx}`,
      position: idx,
      data: row,
    });
  });

  Object.entries(sanitizeObject(payload.fw_owner_activity)).forEach(([rowId, data]) => {
    rowsByScope.ownerActivity.push({ rowId: String(rowId), position: null, data });
  });

  Object.entries(sanitizeObject(payload.fw_vote_ledger)).forEach(([rowId, rawChoice]) => {
    const choice = String(rawChoice || "").trim();
    if (!VALID_VOTE_CHOICES.has(choice)) return;
    rowsByScope.voteLedger.push({ rowId: String(rowId), position: null, data: { choice } });
  });

  Object.entries(sanitizeObject(payload.fw_primary_voter_registry)).forEach(([rowId, data]) => {
    rowsByScope.primaryVoters.push({ rowId: String(rowId), position: null, data });
  });

  Object.entries(sanitizeObject(payload.fw_outreach_state)).forEach(([rowId, data]) => {
    rowsByScope.outreach.push({ rowId: String(rowId), position: null, data });
  });

  Object.entries(sanitizeObject(payload.fw_user_directory)).forEach(([rowId, data]) => {
    rowsByScope.userDirectory.push({ rowId: String(rowId), position: null, data });
  });

  const adminEntries = Array.isArray(payload.fw_admin_access_entries) ? payload.fw_admin_access_entries : [];
  const adminGrades = sanitizeObject(payload.fw_admin_access_grades);
  adminEntries.forEach((name, idx) => {
    const key = normalizeNameKey(name) || `idx:${idx}`;
    rowsByScope.adminAccess.push({
      rowId: key,
      position: idx,
      data: {
        name,
        gradeRecord: adminGrades[key] || null,
      },
    });
  });
  Object.entries(adminGrades).forEach(([rowId, data]) => {
    rowsByScope.adminAccessGrades.push({ rowId: String(rowId), position: null, data });
  });

  Object.entries(sanitizeObject(payload.fw_vote_eligibility)).forEach(([rowId, data]) => {
    rowsByScope.voteEligibility.push({ rowId: String(rowId), position: null, data });
  });

  Object.entries(sanitizeObject(payload.legacy_vote_entries)).forEach(([rowId, rawChoice]) => {
    const choice = String(rawChoice || "").trim();
    if (!VALID_VOTE_CHOICES.has(choice)) return;
    rowsByScope.legacyVoteEntries.push({ rowId: String(rowId), position: null, data: { choice } });
  });

  const assets = (Array.isArray(payload.covenant_asset_records) ? payload.covenant_asset_records : [])
    .map((asset) => ({
      assetId: String(asset?.id || "").trim(),
      fileName: String(asset?.fileName || ""),
      fileType: String(asset?.fileType || ""),
      updatedAtMs: Number(asset?.updatedAt) || null,
      blobDataUrl: String(asset?.blobDataUrl || ""),
    }))
    .filter((asset) => asset.assetId && asset.blobDataUrl.startsWith("data:"));

  return {
    stateValues,
    rowsByScope,
    assets,
  };
};

const applyStateValues = async (client, stateValues, keys, mode) => {
  const safeKeys = Array.isArray(keys) ? keys : [];
  if (safeKeys.length === 0) return;
  if (mode === "replace") {
    await client.query("DELETE FROM state_values WHERE key = ANY($1::text[])", [safeKeys]);
  }
  for (const key of safeKeys) {
    if (!Object.prototype.hasOwnProperty.call(stateValues, key)) continue;
    const value = stateValues[key];
    if (mode === "missing") {
      await client.query(
        "INSERT INTO state_values(key, value_json) VALUES($1, $2::jsonb) ON CONFLICT (key) DO NOTHING",
        [key, JSON.stringify(value)]
      );
      continue;
    }
    await client.query(
      `
        INSERT INTO state_values(key, value_json, updated_at)
        VALUES($1, $2::jsonb, NOW())
        ON CONFLICT (key)
        DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = NOW()
      `,
      [key, JSON.stringify(value)]
    );
  }
};

const applyScopeRows = async (client, scopeName, rows, mode) => {
  if (mode === "replace") {
    await client.query("DELETE FROM scope_records WHERE scope = $1", [scopeName]);
  }
  for (const row of rows) {
    const rowId = String(row?.rowId || "").trim();
    if (!rowId) continue;
    if (mode === "missing") {
      await client.query(
        `
          INSERT INTO scope_records(scope, row_id, position, data_json)
          VALUES($1, $2, $3, $4::jsonb)
          ON CONFLICT (scope, row_id) DO NOTHING
        `,
        [scopeName, rowId, Number.isInteger(row.position) ? row.position : null, JSON.stringify(row.data)]
      );
      continue;
    }
    await client.query(
      `
        INSERT INTO scope_records(scope, row_id, position, data_json, updated_at)
        VALUES($1, $2, $3, $4::jsonb, NOW())
        ON CONFLICT (scope, row_id)
        DO UPDATE SET
          position = EXCLUDED.position,
          data_json = EXCLUDED.data_json,
          updated_at = NOW()
      `,
      [scopeName, rowId, Number.isInteger(row.position) ? row.position : null, JSON.stringify(row.data)]
    );
  }
};

const applyAssets = async (client, assets, mode) => {
  if (mode === "replace") {
    await client.query("DELETE FROM covenant_assets");
  }
  for (const asset of assets) {
    if (mode === "missing") {
      await client.query(
        `
          INSERT INTO covenant_assets(asset_id, file_name, file_type, updated_at_ms, blob_data_url)
          VALUES($1, $2, $3, $4, $5)
          ON CONFLICT (asset_id) DO NOTHING
        `,
        [asset.assetId, asset.fileName, asset.fileType, asset.updatedAtMs, asset.blobDataUrl]
      );
      continue;
    }
    await client.query(
      `
        INSERT INTO covenant_assets(asset_id, file_name, file_type, updated_at_ms, blob_data_url, updated_at)
        VALUES($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (asset_id)
        DO UPDATE SET
          file_name = EXCLUDED.file_name,
          file_type = EXCLUDED.file_type,
          updated_at_ms = EXCLUDED.updated_at_ms,
          blob_data_url = EXCLUDED.blob_data_url,
          updated_at = NOW()
      `,
      [asset.assetId, asset.fileName, asset.fileType, asset.updatedAtMs, asset.blobDataUrl]
    );
  }
};

const syncBackupToDatabase = async ({ backup, mode = "replace", scopes = {} }) => {
  const normalizedMode = mode === "merge" || mode === "missing" ? mode : "replace";
  const normalizedScopes = normalizeScopes(scopes);
  if (!hasSelectedScope(normalizedScopes)) {
    throw new Error("At least one scope must be selected.");
  }

  const serialized = serializeBackup(backup || {});

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      for (const scope of ALL_SCOPES) {
        if (!normalizedScopes[scope]) continue;
        const config = SCOPE_CONFIG[scope];
        if (!config) continue;
        await applyStateValues(client, serialized.stateValues, config.stateKeys, normalizedMode);
        for (const recordScope of config.recordScopes) {
          await applyScopeRows(client, recordScope, serialized.rowsByScope[recordScope] || [], normalizedMode);
        }
        if (config.includesAssets) {
          await applyAssets(client, serialized.assets, normalizedMode);
        }
      }

      await client.query(
        `
          INSERT INTO backup_snapshots(backup_type, version, mode, scopes_json, backup_json)
          VALUES($1, $2, $3, $4::jsonb, $5::jsonb)
        `,
        [
          backup?.backupType || BACKUP_TYPE,
          Number(backup?.version) || BACKUP_VERSION,
          normalizedMode,
          JSON.stringify(normalizedScopes),
          JSON.stringify(backup || {}),
        ]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return {
    mode: normalizedMode,
    scopes: normalizedScopes,
  };
};

const buildBackupFromDatabase = async () => {
  const [stateResult, scopeResult, assetResult] = await Promise.all([
    query("SELECT key, value_json FROM state_values"),
    query("SELECT scope, row_id, position, data_json FROM scope_records ORDER BY scope, position NULLS LAST, row_id"),
    query("SELECT asset_id, file_name, file_type, updated_at_ms, blob_data_url FROM covenant_assets ORDER BY asset_id"),
  ]);

  const stateMap = {};
  stateResult.rows.forEach((row) => {
    stateMap[row.key] = row.value_json;
  });

  const grouped = {};
  scopeResult.rows.forEach((row) => {
    if (!grouped[row.scope]) grouped[row.scope] = [];
    grouped[row.scope].push(row);
  });

  const rowsToObject = (scopeName) => {
    const out = {};
    (grouped[scopeName] || []).forEach((row) => {
      out[row.row_id] = row.data_json;
    });
    return out;
  };

  const comments = (grouped.comments || []).map((row) => row.data_json);
  const covenantDocs = (grouped.covenantDocs || []).map((row) => row.data_json);
  const ownerActivity = rowsToObject("ownerActivity");
  const primaryVoters = rowsToObject("primaryVoters");
  const outreach = rowsToObject("outreach");
  const userDirectory = rowsToObject("userDirectory");
  const voteEligibility = rowsToObject("voteEligibility");
  const voteLedger = {};
  (grouped.voteLedger || []).forEach((row) => {
    const choice = row.data_json?.choice || row.data_json;
    if (VALID_VOTE_CHOICES.has(choice)) {
      voteLedger[row.row_id] = choice;
    }
  });

  const legacyVoteEntries = {};
  (grouped.legacyVoteEntries || []).forEach((row) => {
    const choice = row.data_json?.choice || row.data_json;
    if (VALID_VOTE_CHOICES.has(choice)) {
      legacyVoteEntries[row.row_id] = choice;
    }
  });

  const adminAccessEntries = (grouped.adminAccess || [])
    .map((row) => String(row.data_json?.name || "").trim())
    .filter(Boolean);
  const adminAccessGrades = rowsToObject("adminAccessGrades");
  (grouped.adminAccess || []).forEach((row) => {
    const key = row.row_id;
    if (!adminAccessGrades[key] && row.data_json?.gradeRecord) {
      adminAccessGrades[key] = row.data_json.gradeRecord;
    }
  });

  const payload = {
    fw_user: stateMap.fw_user ?? null,
    fw_votes: stateMap.fw_votes ?? null,
    fw_comments: comments,
    fw_comments_data_version: stateMap.fw_comments_data_version ?? 2,
    fw_covenant_docs: covenantDocs,
    fw_owner_activity: ownerActivity,
    fw_vote_ledger: voteLedger,
    fw_primary_voter_registry: primaryVoters,
    fw_primary_voter_transfer_audit: Array.isArray(stateMap.fw_primary_voter_transfer_audit)
      ? stateMap.fw_primary_voter_transfer_audit
      : [],
    fw_outreach_state: outreach,
    fw_user_directory: userDirectory,
    fw_admin_access_entries: adminAccessEntries,
    fw_admin_access_grades: adminAccessGrades,
    fw_total_lots: stateMap.fw_total_lots ?? null,
    fw_vote_eligibility: voteEligibility,
    legacy_vote_entries: legacyVoteEntries,
    covenant_asset_records: assetResult.rows.map((row) => ({
      id: row.asset_id,
      fileName: row.file_name || "",
      fileType: row.file_type || "",
      updatedAt: Number(row.updated_at_ms) || Date.now(),
      blobDataUrl: row.blob_data_url,
    })),
    fw_last_backup_export_at: stateMap.fw_last_backup_export_at ?? null,
    fw_backup_health_threshold_days: stateMap.fw_backup_health_threshold_days ?? null,
  };

  return {
    backupType: BACKUP_TYPE,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    payload,
  };
};

const getRecordCounts = async () => {
  const [stateCount, scopeCounts, assetCount, snapshotCount] = await Promise.all([
    query("SELECT COUNT(*)::int AS count FROM state_values"),
    query("SELECT scope, COUNT(*)::int AS count FROM scope_records GROUP BY scope ORDER BY scope"),
    query("SELECT COUNT(*)::int AS count FROM covenant_assets"),
    query("SELECT COUNT(*)::int AS count FROM backup_snapshots"),
  ]);

  return {
    state_values: stateCount.rows[0]?.count || 0,
    scope_records: scopeCounts.rows,
    covenant_assets: assetCount.rows[0]?.count || 0,
    backup_snapshots: snapshotCount.rows[0]?.count || 0,
  };
};

const getRecords = async ({ table, limit = 200, offset = 0 }) => {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
  const safeOffset = Math.max(0, Number(offset) || 0);
  if (table === "state_values") {
    const result = await query(
      "SELECT key, value_json, updated_at FROM state_values ORDER BY key LIMIT $1 OFFSET $2",
      [safeLimit, safeOffset]
    );
    return result.rows;
  }
  if (table === "covenant_assets") {
    const result = await query(
      "SELECT asset_id, file_name, file_type, updated_at_ms, updated_at FROM covenant_assets ORDER BY asset_id LIMIT $1 OFFSET $2",
      [safeLimit, safeOffset]
    );
    return result.rows;
  }
  if (table === "backup_snapshots") {
    const result = await query(
      "SELECT id, created_at, backup_type, version, mode, scopes_json FROM backup_snapshots ORDER BY id DESC LIMIT $1 OFFSET $2",
      [safeLimit, safeOffset]
    );
    return result.rows;
  }
  const result = await query(
    `
      SELECT scope, row_id, position, data_json, updated_at
      FROM scope_records
      WHERE scope = $1
      ORDER BY position NULLS LAST, row_id
      LIMIT $2 OFFSET $3
    `,
    [table, safeLimit, safeOffset]
  );
  return result.rows;
};

module.exports = {
  BACKUP_TYPE,
  BACKUP_VERSION,
  ALL_SCOPES,
  ensureSchema,
  normalizeScopes,
  hasSelectedScope,
  syncBackupToDatabase,
  buildBackupFromDatabase,
  getRecordCounts,
  getRecords,
};
