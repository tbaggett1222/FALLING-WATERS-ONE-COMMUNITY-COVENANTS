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
const SHARED_REFRESH_SCOPES = [
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
    stateKeys: ["fw_admin_access_entries", "fw_admin_access_grades", "fw_admin_two_factor_registry"],
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
  await query(`
    CREATE TABLE IF NOT EXISTS scope_sync_state (
      scope TEXT PRIMARY KEY,
      last_mode TEXT NOT NULL,
      last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    fw_admin_two_factor_registry: payload.fw_admin_two_factor_registry ?? {},
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

const syncBackupToDatabase = async ({ backup, mode = "replace", scopes = {}, createSnapshot = false }) => {
  const normalizedMode = mode === "merge" || mode === "missing" ? mode : "replace";
  const normalizedScopes = normalizeScopes(scopes);
  const shouldCreateSnapshot = createSnapshot === true;
  if (!hasSelectedScope(normalizedScopes)) {
    throw new Error("At least one scope must be selected.");
  }

  const serialized = serializeBackup(backup || {});
  const shouldTrackSnapshot = trackSnapshot !== false;
  const safeSnapshotKeepCount = Math.max(0, Number(snapshotKeepCount) || 0);
  let prunedSnapshots = 0;

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
        await markScopeSynced(client, scope, normalizedMode);
      }

      if (shouldCreateSnapshot) {
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
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  });

  return {
    mode: normalizedMode,
    scopes: normalizedScopes,
    snapshotCreated: shouldCreateSnapshot,
  };
};

const buildSharedChangesFromDatabase = async ({ since = null } = {}) =>
  withClient(async (client) => {
    const hasSince = since instanceof Date && !Number.isNaN(since.getTime());
    const nowResult = await client.query("SELECT NOW() AS now");
    const refreshedAt = new Date(nowResult.rows[0]?.now || Date.now()).toISOString();
    const refreshCutoffDate = new Date(refreshedAt);

    const sharedStateKeys = [
      "fw_votes",
      "fw_comments_data_version",
      "fw_total_lots",
      "fw_backup_health_threshold_days",
      "fw_primary_voter_transfer_audit",
      "fw_admin_access_entries",
      "fw_admin_access_grades",
      "fw_admin_two_factor_registry",
    ];
    const sharedRecordScopes = [
      "comments",
      "covenantDocs",
      "ownerActivity",
      "voteLedger",
      "primaryVoters",
      "outreach",
      "userDirectory",
      "adminAccess",
      "adminAccessGrades",
      "voteEligibility",
      "legacyVoteEntries",
    ];

    const stateParams = [sharedStateKeys];
    let stateWhere = "key = ANY($1::text[])";
    if (hasSince) {
      stateParams.push(since.toISOString(), refreshedAt);
      stateWhere += " AND updated_at > $2::timestamptz AND updated_at <= $3::timestamptz";
    }
    const stateResult = await client.query(
      `
        SELECT key, value_json, updated_at
        FROM state_values
        WHERE ${stateWhere}
      `,
      stateParams
    );

    const scopeParams = [sharedRecordScopes];
    let scopeWhere = "scope = ANY($1::text[])";
    if (hasSince) {
      scopeParams.push(since.toISOString(), refreshedAt);
      scopeWhere += " AND updated_at > $2::timestamptz AND updated_at <= $3::timestamptz";
    }
    const scopeResult = await client.query(
      `
        SELECT scope, row_id, position, data_json, updated_at
        FROM scope_records
        WHERE ${scopeWhere}
        ORDER BY scope, position NULLS LAST, row_id
      `,
      scopeParams
    );

    const stateMap = {};
    let maxUpdatedAt = hasSince ? since : null;
    const assignMaxTimestamp = (updatedAt) => {
      const parsed = new Date(updatedAt || "");
      if (Number.isNaN(parsed.getTime())) return;
      if (!maxUpdatedAt || parsed > maxUpdatedAt) {
        maxUpdatedAt = parsed;
      }
    };

    stateResult.rows.forEach((row) => {
      stateMap[row.key] = row.value_json;
      assignMaxTimestamp(row.updated_at);
    });

    const grouped = {};
    scopeResult.rows.forEach((row) => {
      if (!grouped[row.scope]) grouped[row.scope] = [];
      grouped[row.scope].push(row);
      assignMaxTimestamp(row.updated_at);
    });

    const rowsToObject = (scopeName, valueResolver = (row) => row.data_json) => {
      const out = {};
      (grouped[scopeName] || []).forEach((row) => {
        out[row.row_id] = valueResolver(row);
      });
      return out;
    };

    const payload = {};
    if (Object.prototype.hasOwnProperty.call(stateMap, "fw_votes")) payload.fw_votes = stateMap.fw_votes;
    if (Object.prototype.hasOwnProperty.call(stateMap, "fw_comments_data_version")) {
      payload.fw_comments_data_version = stateMap.fw_comments_data_version;
    }
    if (Object.prototype.hasOwnProperty.call(stateMap, "fw_total_lots")) payload.fw_total_lots = stateMap.fw_total_lots;
    if (Object.prototype.hasOwnProperty.call(stateMap, "fw_backup_health_threshold_days")) {
      payload.fw_backup_health_threshold_days = stateMap.fw_backup_health_threshold_days;
    }
    if (Object.prototype.hasOwnProperty.call(stateMap, "fw_primary_voter_transfer_audit")) {
      payload.fw_primary_voter_transfer_audit = Array.isArray(stateMap.fw_primary_voter_transfer_audit)
        ? stateMap.fw_primary_voter_transfer_audit
        : [];
    }
    if (Object.prototype.hasOwnProperty.call(stateMap, "fw_admin_access_entries")) {
      payload.fw_admin_access_entries = Array.isArray(stateMap.fw_admin_access_entries)
        ? stateMap.fw_admin_access_entries
        : [];
    }
    if (Object.prototype.hasOwnProperty.call(stateMap, "fw_admin_access_grades")) {
      payload.fw_admin_access_grades = stateMap.fw_admin_access_grades || {};
    }
    if (Object.prototype.hasOwnProperty.call(stateMap, "fw_admin_two_factor_registry")) {
      payload.fw_admin_two_factor_registry = stateMap.fw_admin_two_factor_registry || {};
    }

    if (grouped.comments) payload.fw_comments = grouped.comments.map((row) => row.data_json);
    if (grouped.covenantDocs) payload.fw_covenant_docs = grouped.covenantDocs.map((row) => row.data_json);
    if (grouped.ownerActivity) payload.fw_owner_activity = rowsToObject("ownerActivity");
    if (grouped.primaryVoters) payload.fw_primary_voter_registry = rowsToObject("primaryVoters");
    if (grouped.outreach) payload.fw_outreach_state = rowsToObject("outreach");
    if (grouped.userDirectory) payload.fw_user_directory = rowsToObject("userDirectory");
    if (grouped.voteEligibility) payload.fw_vote_eligibility = rowsToObject("voteEligibility");
    if (grouped.voteLedger) {
      payload.fw_vote_ledger = rowsToObject("voteLedger", (row) => row.data_json?.choice || row.data_json);
    }
    if (grouped.legacyVoteEntries) {
      payload.legacy_vote_entries = rowsToObject("legacyVoteEntries", (row) => row.data_json?.choice || row.data_json);
    }
    if (grouped.adminAccess) {
      payload.fw_admin_access_entries = (grouped.adminAccess || [])
        .map((row) => String(row.data_json?.name || "").trim())
        .filter(Boolean);
    }
    if (grouped.adminAccessGrades) {
      payload.fw_admin_access_grades = rowsToObject("adminAccessGrades");
    }

    const backup = {
      backupType: BACKUP_TYPE,
      version: BACKUP_VERSION,
      exportedAt: refreshedAt,
      payload,
    };

    return {
      backup,
      refreshedAt,
      nextSince: maxUpdatedAt ? maxUpdatedAt.toISOString() : refreshedAt,
      incremental: hasSince,
      scopes: SHARED_REFRESH_SCOPES,
      excludedScopes: ["covenantFiles", "sessionUser"],
      changed: {
        stateValues: stateResult.rows.length,
        scopeRecords: scopeResult.rows.length,
      },
      refreshCutoff: refreshCutoffDate.toISOString(),
    };
  });

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
    fw_admin_two_factor_registry: stateMap.fw_admin_two_factor_registry ?? {},
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

const toIsoIfValid = (value) => {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const getSharedRefreshBundle = async ({ since } = {}) => {
  const sinceIso = toIsoIfValid(since);
  const sinceDate = sinceIso ? new Date(sinceIso) : null;
  const serverNowResult = await query("SELECT NOW() AS now");
  const serverNowIso = toIsoIfValid(serverNowResult.rows[0]?.now) || new Date().toISOString();

  const scopeStatesResult = await query(
    `
      SELECT scope, last_mode, last_synced_at
      FROM scope_sync_state
      WHERE scope = ANY($1::text[])
    `,
    [SHARED_REFRESH_SCOPES]
  );
  const scopeStates = {};
  scopeStatesResult.rows.forEach((row) => {
    scopeStates[row.scope] = {
      lastMode: String(row.last_mode || "merge"),
      lastSyncedAt: toIsoIfValid(row.last_synced_at),
    };
  });

  const includeAllScopes = !sinceDate || Object.keys(scopeStates).length === 0;
  const changedScopes = includeAllScopes
    ? [...SHARED_REFRESH_SCOPES]
    : SHARED_REFRESH_SCOPES.filter((scope) => {
      const lastSyncedAt = scopeStates[scope]?.lastSyncedAt;
      if (!lastSyncedAt) return false;
      return Date.parse(lastSyncedAt) > sinceDate.getTime();
    });

  const payloadByScope = {};
  for (const scope of changedScopes) {
    const config = SCOPE_CONFIG[scope];
    if (!config) continue;
    const mode = includeAllScopes
      ? "replace"
      : (scopeStates[scope]?.lastMode === "replace" ? "replace" : "merge");

    const stateValues = {};
    if (Array.isArray(config.stateKeys) && config.stateKeys.length > 0) {
      const useUpdatedFilter = !includeAllScopes && mode !== "replace";
      const stateQuery = useUpdatedFilter
        ? `
            SELECT key, value_json
            FROM state_values
            WHERE key = ANY($1::text[]) AND updated_at > $2::timestamptz
          `
        : `
            SELECT key, value_json
            FROM state_values
            WHERE key = ANY($1::text[])
          `;
      const params = useUpdatedFilter ? [config.stateKeys, sinceIso] : [config.stateKeys];
      const stateResult = await query(stateQuery, params);
      stateResult.rows.forEach((row) => {
        stateValues[row.key] = row.value_json;
      });
    }

    const groupedRows = {};
    for (const recordScope of config.recordScopes || []) {
      const useUpdatedFilter = !includeAllScopes && mode !== "replace";
      const recordsQuery = useUpdatedFilter
        ? `
            SELECT scope, row_id, position, data_json
            FROM scope_records
            WHERE scope = $1 AND updated_at > $2::timestamptz
            ORDER BY position NULLS LAST, row_id
          `
        : `
            SELECT scope, row_id, position, data_json
            FROM scope_records
            WHERE scope = $1
            ORDER BY position NULLS LAST, row_id
          `;
      const params = useUpdatedFilter ? [recordScope, sinceIso] : [recordScope];
      const result = await query(recordsQuery, params);
      groupedRows[recordScope] = result.rows;
    }

    const scopePayload = {};
    if (scope === "lotSettings") {
      if (Object.prototype.hasOwnProperty.call(stateValues, "fw_total_lots")) {
        scopePayload.fw_total_lots = stateValues.fw_total_lots;
      }
      if (Object.prototype.hasOwnProperty.call(stateValues, "fw_backup_health_threshold_days")) {
        scopePayload.fw_backup_health_threshold_days = stateValues.fw_backup_health_threshold_days;
      }
    }

    if (scope === "votes") {
      if (Object.prototype.hasOwnProperty.call(stateValues, "fw_votes")) {
        scopePayload.fw_votes = stateValues.fw_votes;
      }
      const voteLedger = {};
      (groupedRows.voteLedger || []).forEach((row) => {
        const choice = row.data_json?.choice || row.data_json;
        if (VALID_VOTE_CHOICES.has(choice)) voteLedger[row.row_id] = choice;
      });
      const legacyVoteEntries = {};
      (groupedRows.legacyVoteEntries || []).forEach((row) => {
        const choice = row.data_json?.choice || row.data_json;
        if (VALID_VOTE_CHOICES.has(choice)) legacyVoteEntries[row.row_id] = choice;
      });
      scopePayload.fw_vote_ledger = voteLedger;
      scopePayload.legacy_vote_entries = legacyVoteEntries;
    }

    if (scope === "comments") {
      scopePayload.fw_comments = (groupedRows.comments || []).map((row) => row.data_json);
      if (Object.prototype.hasOwnProperty.call(stateValues, "fw_comments_data_version")) {
        scopePayload.fw_comments_data_version = stateValues.fw_comments_data_version;
      }
    }

    if (scope === "ownerActivity") {
      scopePayload.fw_owner_activity = {};
      (groupedRows.ownerActivity || []).forEach((row) => {
        scopePayload.fw_owner_activity[row.row_id] = row.data_json;
      });
    }

    if (scope === "outreach") {
      scopePayload.fw_outreach_state = {};
      (groupedRows.outreach || []).forEach((row) => {
        scopePayload.fw_outreach_state[row.row_id] = row.data_json;
      });
    }

    if (scope === "eligibility") {
      scopePayload.fw_vote_eligibility = {};
      (groupedRows.voteEligibility || []).forEach((row) => {
        scopePayload.fw_vote_eligibility[row.row_id] = row.data_json;
      });
    }

    if (scope === "primaryVoters") {
      scopePayload.fw_primary_voter_registry = {};
      (groupedRows.primaryVoters || []).forEach((row) => {
        scopePayload.fw_primary_voter_registry[row.row_id] = row.data_json;
      });
      if (Object.prototype.hasOwnProperty.call(stateValues, "fw_primary_voter_transfer_audit")) {
        scopePayload.fw_primary_voter_transfer_audit = Array.isArray(stateValues.fw_primary_voter_transfer_audit)
          ? stateValues.fw_primary_voter_transfer_audit
          : [];
      }
    }

    if (scope === "adminAccess") {
      const adminAccessEntries = (groupedRows.adminAccess || [])
        .map((row) => String(row.data_json?.name || "").trim())
        .filter(Boolean);
      const adminAccessGrades = {};
      (groupedRows.adminAccessGrades || []).forEach((row) => {
        adminAccessGrades[row.row_id] = row.data_json;
      });
      (groupedRows.adminAccess || []).forEach((row) => {
        const key = row.row_id;
        if (!adminAccessGrades[key] && row.data_json?.gradeRecord) {
          adminAccessGrades[key] = row.data_json.gradeRecord;
        }
      });
      scopePayload.fw_admin_access_entries = adminAccessEntries;
      scopePayload.fw_admin_access_grades = adminAccessGrades;
      if (Object.prototype.hasOwnProperty.call(stateValues, "fw_admin_two_factor_registry")) {
        scopePayload.fw_admin_two_factor_registry = stateValues.fw_admin_two_factor_registry;
      }
    }

    if (scope === "userDirectory") {
      scopePayload.fw_user_directory = {};
      (groupedRows.userDirectory || []).forEach((row) => {
        scopePayload.fw_user_directory[row.row_id] = row.data_json;
      });
    }

    payloadByScope[scope] = {
      mode,
      payload: scopePayload,
    };
  }

  return {
    since: sinceIso,
    nextCursor: serverNowIso,
    scopes: payloadByScope,
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

// ── PASSWORD RESET REQUESTS ──────────────────────────────────────────────────
// Residents who forget their per-lot voting password can file a request that an
// admin reviews and clears. Stored in the generic scope_records table under a
// dedicated scope, so no schema migration is needed.
const RESET_REQUEST_SCOPE = "passwordResetRequests";
const RESET_REQUEST_STATUSES = new Set(["pending", "resolved", "denied"]);

const normalizeResetLots = (lots, lot) => {
  const list = Array.isArray(lots) ? lots : lot ? [lot] : [];
  const seen = new Set();
  const out = [];
  list
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .forEach((value) => {
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(value);
    });
  return out;
};

const createPasswordResetRequest = async ({ name, lots, lot, message } = {}) => {
  const safeName = String(name || "").trim();
  const normalizedLots = normalizeResetLots(lots, lot);
  if (!safeName) {
    throw new Error("Your name is required to request a password reset.");
  }
  if (normalizedLots.length === 0) {
    throw new Error("At least one lot number is required to request a password reset.");
  }
  const safeMessage = String(message || "").trim().slice(0, 2000);
  const nowIso = new Date().toISOString();
  const slug = normalizeNameKey(safeName).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "resident";
  const id = `prr_${slug}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const record = {
    id,
    name: safeName,
    nameKey: normalizeNameKey(safeName),
    lots: normalizedLots,
    lot: normalizedLots.join(", "),
    message: safeMessage,
    status: "pending",
    createdAt: nowIso,
  };
  await query(
    `
      INSERT INTO scope_records(scope, row_id, position, data_json, updated_at)
      VALUES($1, $2, $3, $4::jsonb, NOW())
      ON CONFLICT (scope, row_id)
      DO UPDATE SET data_json = EXCLUDED.data_json, updated_at = NOW()
    `,
    [RESET_REQUEST_SCOPE, id, null, JSON.stringify(record)]
  );
  return record;
};

const listPasswordResetRequests = async ({ status = null, limit = 200 } = {}) => {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 200));
  const result = await query(
    `
      SELECT row_id, data_json, updated_at
      FROM scope_records
      WHERE scope = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `,
    [RESET_REQUEST_SCOPE, safeLimit]
  );
  let rows = result.rows.map((row) => ({
    ...(row.data_json || {}),
    id: row.data_json?.id || row.row_id,
    status: row.data_json?.status || "pending",
    updatedAt: row.updated_at,
  }));
  if (status) {
    const wanted = String(status).trim().toLowerCase();
    rows = rows.filter((row) => String(row.status || "pending").toLowerCase() === wanted);
  }
  return rows;
};

const resolvePasswordResetRequest = async ({ id, status = "resolved", resolvedBy = "" } = {}) => {
  const safeId = String(id || "").trim();
  if (!safeId) {
    throw new Error("A password reset request id is required.");
  }
  const nextStatus = RESET_REQUEST_STATUSES.has(status) ? status : "resolved";
  const existing = await query(
    "SELECT data_json FROM scope_records WHERE scope = $1 AND row_id = $2",
    [RESET_REQUEST_SCOPE, safeId]
  );
  if (existing.rows.length === 0) {
    throw new Error("Password reset request not found.");
  }
  const record = { ...(existing.rows[0].data_json || {}) };
  record.id = record.id || safeId;
  record.status = nextStatus;
  record.resolvedAt = new Date().toISOString();
  record.resolvedBy = String(resolvedBy || "").trim();
  await query(
    "UPDATE scope_records SET data_json = $3::jsonb, updated_at = NOW() WHERE scope = $1 AND row_id = $2",
    [RESET_REQUEST_SCOPE, safeId, JSON.stringify(record)]
  );
  return record;
};

module.exports = {
  BACKUP_TYPE,
  BACKUP_VERSION,
  ALL_SCOPES,
  SHARED_REFRESH_SCOPES,
  ensureSchema,
  normalizeScopes,
  hasSelectedScope,
  syncBackupToDatabase,
  buildBackupFromDatabase,
  buildSharedChangesFromDatabase,
  createPasswordResetRequest,
  listPasswordResetRequests,
  resolvePasswordResetRequest,
  getRecordCounts,
  getRecords,
};
