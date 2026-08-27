import React, { useState, useEffect } from "react";

// ── PALETTE & CONSTANTS ──────────────────────────────────────────────────────
const C = {
  forest: "#1C3A2E",
  forestLight: "#2A5240",
  stone: "#C4A882",
  stoneDark: "#A08060",
  parchment: "#F7F4EF",
  parchmentDark: "#EDE9E0",
  ink: "#1A1A1A",
  muted: "#6B7280",
  danger: "#8B1A1A",
  dangerLight: "#FEE2E2",
  success: "#14532D",
  successLight: "#DCFCE7",
  amber: "#78350F",
  amberLight: "#FEF3C7",
  border: "#D4CFC6",
  white: "#FFFFFF",
};

// ── SEED DATA ────────────────────────────────────────────────────────────────
const SEED_COMMENTS = [];
const COMMENTS_DATA_VERSION = 2;
const LEGACY_SAMPLE_COMMENT_KEYS = new Set([
  "Lot 12|J. Harmon|Aug 18, 2026",
  "Lot 47|M. Delgado|Aug 19, 2026",
  "Lot 88|R. Patel|Aug 20, 2026",
  "Lot 23|C. Whitfield|Aug 21, 2026",
  "Lot 156|T. Nguyen|Aug 22, 2026",
  "Lot 34|S. Burke|Aug 23, 2026",
]);

const DEFAULT_TOTAL_LOTS = 200;
const MAX_TOTAL_LOTS = 500;
const MIN_TOTAL_LOTS = 1;
const MOBILE_BREAKPOINT_PX = 920;
const MIN_LOGIN_SECRET_LENGTH = 4;
const DEFAULT_BACKUP_HEALTH_MAX_AGE_DAYS = 7;
const MIN_BACKUP_HEALTH_MAX_AGE_DAYS = 1;
const MAX_BACKUP_HEALTH_MAX_AGE_DAYS = 60;
const LAST_BACKUP_EXPORT_KEY = "fw_last_backup_export_at";
const BACKUP_HEALTH_THRESHOLD_KEY = "fw_backup_health_threshold_days";
const DB_API_BASE_URL_KEY = "fw_db_api_base_url";
const LAST_DB_SYNC_AT_KEY = "fw_last_db_sync_at";
const PRIMARY_VOTER_TRANSFER_AUDIT_KEY = "fw_primary_voter_transfer_audit";
const DEFAULT_DB_API_BASE_URL = "https://falling-waters-postgres-api.onrender.com";
const MAX_INLINE_ATTACHMENT_BYTES = 1024 * 1024 * 1.5;
const MAX_UPLOAD_BYTES = 1024 * 1024 * 12;
const STR_CONCERN_OPTIONS = [
  "Traffic & parking pressure",
  "Parties, loud noise, and disturbances",
  "Drug activity / security concerns",
  "Wildlife safety (future CC&R topic)",
  "Property value and neighborhood character",
  "Legal clarity and enforceability",
];
const ACC_CONCERN_OPTIONS = [
  "Minimum home size and design consistency",
  "Exterior materials, colors, and aesthetics",
  "Setbacks, grading, and site planning",
  "Construction timelines and compliance",
  "ACC review transparency and appeals",
];
const GENERAL_CONCERN_OPTIONS = [
  "Legal clarity and enforceability",
  "Fairness across all lots",
  "Governance and decision transparency",
  "Assessment and budget impact",
  "Question or other",
];
const COMMENT_TOPIC_OPTIONS = [
  { value: "str", label: "Short-term rentals" },
  { value: "acc", label: "ACC Building Guidelines" },
  { value: "general", label: "General covenants" },
  { value: "process", label: "Process & voting" },
];
const COMMENT_STANCE_OPTIONS_BY_TOPIC = {
  str: [
    { value: "restrict", label: "I support restricting STRs" },
    { value: "permit", label: "I support permitting STRs" },
    { value: "neutral", label: "Neutral / I have a question" },
  ],
  acc: [
    { value: "restrict", label: "I support stricter ACC standards" },
    { value: "permit", label: "I support more flexible ACC standards" },
    { value: "neutral", label: "Neutral / I have a question" },
  ],
  general: [
    { value: "restrict", label: "I support this covenant direction" },
    { value: "permit", label: "I want changes to this direction" },
    { value: "neutral", label: "Neutral / I have a question" },
  ],
  process: [
    { value: "restrict", label: "I support the current process" },
    { value: "permit", label: "I want process changes" },
    { value: "neutral", label: "Neutral / I have a question" },
  ],
};
const commentStanceOptionsForTopic = (topic) =>
  COMMENT_STANCE_OPTIONS_BY_TOPIC[topic] || COMMENT_STANCE_OPTIONS_BY_TOPIC.general;
const commentConcernOptionsForTopic = (topic) =>
  topic === "str"
    ? STR_CONCERN_OPTIONS
    : topic === "acc"
      ? ACC_CONCERN_OPTIONS
      : GENERAL_CONCERN_OPTIONS;
const DOC_STATUS_OPTIONS = [
  { value: "original", label: "Original" },
  { value: "active2014", label: "Active — Phase II lots" },
  { value: "disputed", label: "Disputed — consent form only" },
  { value: "uploaded", label: "Uploaded for review" },
];
const ADMIN_ALLOWED_USERS = [
  "Tracy Baggett",
];
const ADMIN_ALLOWED_ALIASES = [
  // Add explicit admin name variants here when needed.
];
const ADMIN_ACCESS_ENTRIES = [...ADMIN_ALLOWED_USERS, ...ADMIN_ALLOWED_ALIASES];
const ADMIN_GRADE_OPTIONS = [
  { value: "full_admin", label: "Full admin" },
  { value: "operations_admin", label: "Operations admin" },
  { value: "read_only_admin", label: "Read-only admin" },
];
const DEFAULT_ADMIN_GRADE = "full_admin";
const BACKUP_RESTORE_SCOPE_OPTIONS = [
  { key: "lotSettings", label: "Lot count settings" },
  { key: "votes", label: "Voting ledger + per-lot vote keys" },
  { key: "comments", label: "Community comments" },
  { key: "ownerActivity", label: "Owner activity records" },
  { key: "outreach", label: "Outreach contact state" },
  { key: "eligibility", label: "Vote eligibility flags" },
  { key: "primaryVoters", label: "Primary voter assignments" },
  { key: "adminAccess", label: "Admin access roster + grades" },
  { key: "userDirectory", label: "User access directory" },
  { key: "covenantDocs", label: "Covenant document metadata" },
  { key: "covenantFiles", label: "Stored covenant file blobs" },
  { key: "sessionUser", label: "Current signed-in session" },
];

const defaultBackupRestoreScopes = () =>
  BACKUP_RESTORE_SCOPE_OPTIONS.reduce((acc, scope) => {
    acc[scope.key] = true;
    return acc;
  }, {});

// ── STORAGE HELPERS ──────────────────────────────────────────────────────────
const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};

const todayLabel = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const isLegacySampleComment = (comment) =>
  LEGACY_SAMPLE_COMMENT_KEYS.has(`${comment?.lot || ""}|${comment?.name || ""}|${comment?.ts || ""}`);

const normalizeLotLabel = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.toLowerCase() === "admin") return "ADMIN";
  const stripped = raw.replace(/^lot\s*/i, "").trim();
  if (!stripped) return null;
  return `Lot ${stripped}`;
};

const normalizeLoginSecret = (value) => String(value || "").trim();

const hashString = (value) => {
  let hash = 5381;
  const input = String(value || "");
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return `h${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

const buildPrimaryCredentialHash = (lotLabel, secret) =>
  hashString(`${normalizeLotLabel(lotLabel) || String(lotLabel || "")}|${normalizeLoginSecret(secret)}`);

const buildLotLabels = (totalLots) =>
  Array.from({ length: Math.max(MIN_TOTAL_LOTS, Number(totalLots) || DEFAULT_TOTAL_LOTS) }, (_, idx) => `Lot ${idx + 1}`);

const votesNeededForLots = (totalLots) =>
  Math.ceil((Math.max(MIN_TOTAL_LOTS, Number(totalLots) || DEFAULT_TOTAL_LOTS) * 2) / 3);

const sanitizeDbApiBaseUrl = (inputValue, { allowEmpty = true } = {}) => {
  const raw = String(inputValue || "").trim();
  if (!raw) {
    if (allowEmpty) return { value: "" };
    return { error: "Enter a Database API URL like http://localhost:8787." };
  }

  if (/^postgres(ql)?:\/\//i.test(raw)) {
    return {
      error:
        "This field expects the API URL (for example http://localhost:8787), not DATABASE_URL.",
    };
  }

  if (/\bnpm\s+run\b/i.test(raw) || /\bexport\b/i.test(raw) || /\s/.test(raw)) {
    const urlMatch = raw.match(/https?:\/\/[^\s"'`]+/i);
    if (urlMatch) return sanitizeDbApiBaseUrl(urlMatch[0], { allowEmpty });
    return {
      error:
        "Paste only the API URL, not a terminal command. Example: http://localhost:8787",
    };
  }

  if (!/^https?:\/\//i.test(raw)) {
    return { error: "Database API URL must start with http:// or https://." };
  }

  let value = raw.replace(/\/+$/, "");
  if (value.endsWith("/api")) {
    value = value.slice(0, -4);
  }
  return { value };
};

const formatIsoDateTime = (isoValue) => {
  if (!isoValue) return "";
  const parsed = new Date(String(isoValue));
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString();
};

const normalizePrimaryVoterTransferAuditEntries = (entries) => {
  const list = Array.isArray(entries) ? entries : [];
  return list
    .map((entry, idx) => {
      const lot = normalizeLotLabel(entry?.lot);
      const toName = String(entry?.toName || "").trim();
      const fromName = String(entry?.fromName || "").trim();
      const note = String(entry?.note || "").trim();
      const byName = String(entry?.byName || "").trim();
      const tsIsoRaw = String(entry?.tsIso || "").trim();
      const tsIso = tsIsoRaw && !Number.isNaN(Date.parse(tsIsoRaw)) ? new Date(tsIsoRaw).toISOString() : null;
      if (!lot || lot === "ADMIN" || !toName || !note || !byName || !tsIso) return null;
      return {
        id: String(entry?.id || `pvt_${lot.replace(/\s+/g, "_")}_${idx}`).trim(),
        lot,
        fromName,
        toName,
        note,
        byName,
        tsIso,
        tsLabel: String(entry?.tsLabel || formatIsoDateTime(tsIso)).trim() || formatIsoDateTime(tsIso),
      };
    })
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.tsIso) - Date.parse(a.tsIso));
};

const mergePrimaryVoterTransferAuditEntries = (currentEntries, incomingEntries) => {
  const merged = [...normalizePrimaryVoterTransferAuditEntries(currentEntries)];
  const seenIds = new Set(merged.map((entry) => entry.id));
  normalizePrimaryVoterTransferAuditEntries(incomingEntries).forEach((entry) => {
    if (seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    merged.push(entry);
  });
  return merged.sort((a, b) => Date.parse(b.tsIso) - Date.parse(a.tsIso));
};

const computeVoteTotalsFromLedger = (ledger = {}, lotLabels = buildLotLabels(DEFAULT_TOTAL_LOTS)) => {
  let eliminate = 0;
  let permit = 0;
  let undecided = 0;
  lotLabels.forEach((lot) => {
    const choice = ledger?.[lot];
    if (choice === "eliminate") eliminate += 1;
    if (choice === "permit") permit += 1;
    if (choice === "undecided") undecided += 1;
  });
  return {
    eliminate,
    permit,
    undecided,
  };
};

const formatMegabytes = (bytes) => `${(Number(bytes || 0) / (1024 * 1024)).toFixed(1)}MB`;

const parseLotsInput = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return [];
  if (raw.toLowerCase() === "admin") return ["ADMIN"];
  const normalizedDelimiters = raw.replace(/\band\b/gi, ",");
  const tokens = normalizedDelimiters.split(/[,;/]+/).map((token) => normalizeLotLabel(token)).filter(Boolean);
  return [...new Set(tokens)];
};

const normalizeUserLots = (user) => {
  if (!user) return [];
  if (user.isAdmin) return ["ADMIN"];
  if (Array.isArray(user.lots) && user.lots.length > 0) {
    return [...new Set(user.lots.map((lot) => normalizeLotLabel(lot)).filter(Boolean))];
  }
  return parseLotsInput(user.lot);
};

const getUserLotDisplay = (user) => {
  const lots = normalizeUserLots(user);
  if (lots.length <= 1) return lots[0] || user?.lot || "";
  return lots.join(", ");
};

const choiceLabel = (choice) =>
  choice === "eliminate"
    ? "Eliminate STRs"
    : choice === "permit"
      ? "Permit with regulation"
      : choice === "undecided"
        ? "Undecided"
        : "Not voted";

const ACCESS_ROLES = {
  primary: "primary_voter",
  commentOnly: "comment_only",
};

const normalizeAccessRole = (role) =>
  role === ACCESS_ROLES.commentOnly ? ACCESS_ROLES.commentOnly : ACCESS_ROLES.primary;

const accessRoleLabel = (role) =>
  normalizeAccessRole(role) === ACCESS_ROLES.commentOnly
    ? "Comment-only household member"
    : "Primary voter";

const isPrimaryVoter = (user) =>
  !user?.isAdmin && normalizeAccessRole(user?.accessRole) === ACCESS_ROLES.primary;

const normalizeNameKey = (name) =>
  String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

const normalizeAdminGrade = (grade) =>
  ADMIN_GRADE_OPTIONS.some((option) => option.value === grade) ? grade : DEFAULT_ADMIN_GRADE;

const adminGradeLabel = (grade) =>
  ADMIN_GRADE_OPTIONS.find((option) => option.value === normalizeAdminGrade(grade))?.label || "Full admin";

const normalizeAdminAccessEntries = (entries) => {
  const list = Array.isArray(entries) ? entries : [];
  const seen = new Set();
  const normalized = [];
  list.forEach((entry) => {
    const safeEntry = String(entry || "").trim();
    if (!safeEntry) return;
    const key = normalizeNameKey(safeEntry);
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push(safeEntry);
  });
  return normalized;
};

const getInitialAdminAccessEntries = () => {
  const seeded = normalizeAdminAccessEntries(ADMIN_ACCESS_ENTRIES);
  const saved = store.get("fw_admin_access_entries");
  const normalizedSaved = normalizeAdminAccessEntries(saved);
  return normalizedSaved.length > 0 ? normalizedSaved : seeded;
};

const isAdminUserAllowed = (name, adminAccessEntries = ADMIN_ACCESS_ENTRIES) => {
  const candidate = normalizeNameKey(name);
  if (!candidate) return false;
  const allowedNames = normalizeAdminAccessEntries(adminAccessEntries).map((entry) => normalizeNameKey(entry));
  return allowedNames.includes(candidate);
};

const generateUserId = (name = "resident") =>
  `usr_${normalizeNameKey(name).replace(/[^a-z0-9]+/g, "-") || "resident"}_${Date.now()}`;

const lotNumberFromLabel = (lotLabel) => {
  const match = String(lotLabel || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
};

const normalizeBoolean = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return ["1", "true", "yes", "y", "contacted"].includes(raw);
};

const normalizeImportedEligibility = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (
    ["eligible", "yes", "y", "true", "1", "current", "dues paid", "paid", "good standing"].includes(raw)
    || raw.includes("good standing")
    || raw.includes("dues paid")
  ) {
    return true;
  }
  if (
    ["ineligible", "no", "n", "false", "0", "dues unpaid", "unpaid", "delinquent", "not current", "suspended", "disqualified"].includes(raw)
    || raw.includes("unpaid")
    || raw.includes("delinquent")
    || raw.includes("not current")
    || raw.includes("ineligible")
    || raw.includes("disqual")
  ) {
    return false;
  }
  return null;
};

const normalizeImportedVoteChoice = (value) => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (["eliminate", "eliminate strs", "ban", "prohibit", "no str"].includes(raw)) return "eliminate";
  if (["permit", "permit with regulation", "allow", "allow str", "regulated permit"].includes(raw)) return "permit";
  if (["undecided", "neutral"].includes(raw)) return "undecided";
  if (["not voted", "no vote", "none", "na", "n/a"].includes(raw)) return null;
  return null;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
};

const parseCsvText = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return headers.reduce((acc, header, idx) => {
      acc[header] = cols[idx] || "";
      return acc;
    }, {});
  });
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read uploaded file."));
    reader.readAsDataURL(file);
  });

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read text from uploaded file."));
    reader.readAsText(file);
  });

const PORTAL_BACKUP_TYPE = "falling-waters-portal-backup";
const PORTAL_BACKUP_VERSION = 1;

const COVENANT_ASSET_DB_NAME = "fw-covenant-assets";
const COVENANT_ASSET_STORE = "files";

const VALID_VOTE_CHOICES = new Set(["eliminate", "permit", "undecided"]);

const readBlobAsDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not serialize stored covenant file."));
    reader.readAsDataURL(blob);
  });

const dataUrlToBlob = (dataUrl) => {
  const raw = String(dataUrl || "");
  const [meta, payload = ""] = raw.split(",", 2);
  if (!meta.startsWith("data:")) {
    throw new Error("Backup file contains an invalid covenant attachment encoding.");
  }
  const mimeMatch = meta.match(/^data:([^;]+)/);
  const mime = mimeMatch?.[1] || "application/octet-stream";
  const isBase64 = /;base64$/i.test(meta);
  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let idx = 0; idx < binary.length; idx += 1) {
    bytes[idx] = binary.charCodeAt(idx);
  }
  return new Blob([bytes], { type: mime });
};

const listCovenantAssetRecords = async () => {
  const db = await openCovenantAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVENANT_ASSET_STORE, "readonly");
    const request = tx.objectStore(COVENANT_ASSET_STORE).getAll();
    request.onsuccess = async () => {
      try {
        const records = Array.isArray(request.result) ? request.result : [];
        const serialized = [];
        for (const record of records) {
          if (!record?.id || !(record?.blob instanceof Blob)) continue;
          const blobDataUrl = await readBlobAsDataUrl(record.blob);
          serialized.push({
            id: record.id,
            fileName: record.fileName || "",
            fileType: record.fileType || record.blob.type || "application/octet-stream",
            updatedAt: Number(record.updatedAt) || Date.now(),
            blobDataUrl,
          });
        }
        db.close();
        resolve(serialized);
      } catch {
        db.close();
        reject(new Error("Could not prepare covenant attachments for backup export."));
      }
    };
    request.onerror = () => {
      db.close();
      reject(new Error("Could not read covenant attachments from browser storage."));
    };
  });
};

const replaceCovenantAssetRecords = async (records) => {
  const safeRecords = Array.isArray(records) ? records : [];
  const db = await openCovenantAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVENANT_ASSET_STORE, "readwrite");
    const storeRef = tx.objectStore(COVENANT_ASSET_STORE);
    storeRef.clear();
    safeRecords.forEach((record) => {
      const id = String(record?.id || "").trim();
      if (!id) return;
      const encoded = String(record?.blobDataUrl || "");
      if (!encoded.startsWith("data:")) return;
      try {
        const blob = dataUrlToBlob(encoded);
        storeRef.put({
          id,
          blob,
          fileName: record?.fileName || "",
          fileType: record?.fileType || blob.type || "application/octet-stream",
          updatedAt: Number(record?.updatedAt) || Date.now(),
        });
      } catch {}
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Could not restore covenant attachments from backup."));
    };
  });
};

const collectLegacyVoteEntries = () => {
  const entries = {};
  if (typeof localStorage === "undefined") return entries;
  for (let idx = 0; idx < localStorage.length; idx += 1) {
    const key = localStorage.key(idx);
    if (!key || !key.startsWith("vote_")) continue;
    const choice = store.get(key);
    if (VALID_VOTE_CHOICES.has(choice)) {
      entries[key] = choice;
    }
  }
  return entries;
};

const clearLegacyVoteEntries = () => {
  if (typeof localStorage === "undefined") return;
  const keys = [];
  for (let idx = 0; idx < localStorage.length; idx += 1) {
    const key = localStorage.key(idx);
    if (key && key.startsWith("vote_")) keys.push(key);
  }
  keys.forEach((key) => store.del(key));
};

const normalizeRestoreScopes = (scopes) => {
  const defaults = defaultBackupRestoreScopes();
  if (!scopes || typeof scopes !== "object") return defaults;
  const normalized = { ...defaults };
  Object.keys(defaults).forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(scopes, key)) {
      normalized[key] = scopes[key] !== false;
    }
  });
  return normalized;
};

const hasSelectedRestoreScope = (scopes) =>
  Object.values(normalizeRestoreScopes(scopes)).some(Boolean);

const mergeCommentsBySignature = (existingComments, incomingComments) => {
  const list = [];
  const seen = new Set();
  const add = (comment) => {
    if (!comment || typeof comment !== "object") return;
    const key = [
      comment.id || "",
      comment.name || "",
      comment.lot || "",
      comment.topic || "",
      comment.stance || "",
      comment.ts || "",
      comment.text || "",
    ].join("|");
    if (seen.has(key)) return;
    seen.add(key);
    list.push(comment);
  };
  (Array.isArray(existingComments) ? existingComments : []).forEach(add);
  (Array.isArray(incomingComments) ? incomingComments : []).forEach(add);
  return list;
};

const mergeCovenantDocsById = (existingDocs, incomingDocs) => {
  const map = new Map();
  (Array.isArray(existingDocs) ? existingDocs : []).forEach((doc, idx) => {
    const id = String(doc?.id || `existing-${idx}`);
    map.set(id, doc);
  });
  (Array.isArray(incomingDocs) ? incomingDocs : []).forEach((doc, idx) => {
    const id = String(doc?.id || `incoming-${idx}`);
    map.set(id, doc);
  });
  return Array.from(map.values());
};

const openCovenantAssetDb = () =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser does not support large local file storage."));
      return;
    }
    const request = indexedDB.open(COVENANT_ASSET_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(COVENANT_ASSET_STORE)) {
        db.createObjectStore(COVENANT_ASSET_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not open browser storage for covenant files."));
  });

const putCovenantAssetBlob = async (id, blob, fileName = "", fileType = "") => {
  const db = await openCovenantAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVENANT_ASSET_STORE, "readwrite");
    tx.objectStore(COVENANT_ASSET_STORE).put({
      id,
      blob,
      fileName,
      fileType,
      updatedAt: Date.now(),
    });
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Could not store large covenant file in browser storage."));
    };
  });
};

const getCovenantAssetBlob = async (id) => {
  const db = await openCovenantAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVENANT_ASSET_STORE, "readonly");
    const request = tx.objectStore(COVENANT_ASSET_STORE).get(id);
    request.onsuccess = () => {
      db.close();
      resolve(request.result?.blob || null);
    };
    request.onerror = () => {
      db.close();
      reject(new Error("Could not load stored covenant file from browser storage."));
    };
  });
};

const deleteCovenantAssetBlob = async (id) => {
  if (!id) return;
  const db = await openCovenantAssetDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVENANT_ASSET_STORE, "readwrite");
    tx.objectStore(COVENANT_ASSET_STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(new Error("Could not remove stored covenant file from browser storage."));
    };
  });
};

const summarizeUploadedCovenant = (rawText, existingDocsCount) => {
  const text = (rawText || "").toLowerCase();
  if (!text.trim()) {
    return [
      "Automatic comparison summary unavailable: file text could not be extracted. Upload a text-based copy for richer analysis.",
      `Document stored successfully and compared at metadata level against ${existingDocsCount} existing covenant record(s).`,
    ];
  }

  const points = [];
  const mentionsStr = /short[\s-]?term|airbnb|vrbo|homeaway|transient/.test(text);
  const mentionsLeaseYear = /(12\s*month|one\s*year|min(imum)?\s+lease)/.test(text);
  const mentionsSevenNight = /7[\s-]?night|min(imum)?\s+stay/.test(text);
  const mentionsAmendSuperMajority = /(2\/3|two-thirds|67%|sixty-seven)/.test(text);
  const mentionsQuorum = /quorum/.test(text);
  const mentionsPoaAct = /(o\.?c\.?g\.?a\.?\s*§?\s*44-3-220|poa act|property owners.? association act)/.test(text);
  const mentionsAssessmentCap = /(10%|15%|assessment cap|dues cap|max(imum)? annual increase)/.test(text);
  const mentionsMediation = /(mediation|arbitration|dispute resolution)/.test(text);

  if (mentionsStr) {
    if (mentionsLeaseYear) {
      points.push("STR/Leasing signal: text references minimum one-year (or 12-month) leasing, aligning with stricter anti-STR posture.");
    } else if (mentionsSevenNight) {
      points.push("STR/Leasing signal: text references 7-night minimum or regulated short-term stays, suggesting a permit-with-rules model.");
    } else {
      points.push("STR/Leasing signal: text contains short-term rental language; verify whether it is a ban, regulated allowance, or undefined.");
    }
  } else {
    points.push("STR/Leasing signal: no explicit short-term rental keywords detected; this may recreate enforceability ambiguity for some lots.");
  }

  points.push(
    mentionsAmendSuperMajority
      ? "Governance signal: supermajority amendment language detected (2/3 or 67%)."
      : "Governance signal: no clear supermajority amendment threshold found in extracted text."
  );
  points.push(
    mentionsQuorum
      ? "Governance signal: quorum language detected; check whether outcomes can be decided by low attendance."
      : "Governance signal: no quorum language detected in extracted text."
  );
  points.push(
    mentionsPoaAct
      ? "Enforcement signal: POA Act language detected (or likely referenced)."
      : "Enforcement signal: POA Act reference not detected in extracted text."
  );
  points.push(
    mentionsAssessmentCap
      ? "Financial signal: assessment-cap language appears present."
      : "Financial signal: no annual assessment-cap language detected."
  );
  points.push(
    mentionsMediation
      ? "Dispute signal: mediation/arbitration language appears present."
      : "Dispute signal: no clear mediation-first language detected."
  );
  points.push(`Comparison scope: automatic scan evaluated this upload against ${existingDocsCount} covenant record(s) currently stored in the portal.`);
  return points;
};

const CANONICAL_DOC_IDS = new Set(["2008", "2014", "2021"]);
const CANONICAL_DECLARATION_YEARS = new Set(["2008", "2014", "2021"]);

const normalizedDocYear = (doc) => {
  const match = String(doc?.year || "").match(/\d{4}/) || String(doc?.title || "").match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : "";
};

const normalizedDocTitleKey = (title) =>
  String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isDeclarationStyleDoc = (doc) => {
  const titleKey = normalizedDocTitleKey(doc?.title);
  return (
    titleKey.includes("declaration")
    || titleKey.includes("ccr")
    || titleKey.includes("cc r")
    || (titleKey.includes("covenant") && titleKey.includes("restriction"))
  );
};

const docRecencyScore = (doc) => {
  const idMatch = String(doc?.id || "").match(/^upload_(\d+)$/);
  if (idMatch) return Number(idMatch[1]);
  const uploadedAtMs = Date.parse(String(doc?.uploadedAt || ""));
  if (Number.isFinite(uploadedAtMs)) return uploadedAtMs;
  return 0;
};

const covenantDocDedupKey = (doc) => {
  const year = normalizedDocYear(doc);
  if (year && (isDeclarationStyleDoc(doc) || CANONICAL_DECLARATION_YEARS.has(year))) return `declaration-year:${year}`;
  const titleKey = normalizedDocTitleKey(doc?.title);
  return `${year || "na"}|${titleKey || String(doc?.id || "")}`;
};

const consolidateCovenantDocs = (docs) => {
  const sourceDocs = Array.isArray(docs) ? docs : [];
  const buckets = {};
  const order = [];
  sourceDocs.forEach((doc) => {
    const key = covenantDocDedupKey(doc);
    if (!buckets[key]) {
      buckets[key] = [];
      order.push(key);
    }
    buckets[key].push(doc);
  });

  const nextDocs = [];
  const removedDocs = [];
  let consolidatedGroups = 0;

  order.forEach((key) => {
    const group = buckets[key];
    if (group.length <= 1) {
      nextDocs.push(group[0]);
      return;
    }
    consolidatedGroups += 1;
    const canonicalDoc = group.find((doc) => CANONICAL_DOC_IDS.has(String(doc?.id || "")));
    const richestDoc = [...group].sort(
      (a, b) => (Array.isArray(b?.sections) ? b.sections.length : 0) - (Array.isArray(a?.sections) ? a.sections.length : 0)
    )[0];
    const keepDoc = canonicalDoc || richestDoc || group[0];
    const uploadLikeDocs = group.filter(
      (doc) => doc?.source === "uploaded" || doc?.uploadedBy || doc?.fileDataUrl || doc?.fileAssetKey || doc?.externalUrl
    );
    const latestUploadLike = [...uploadLikeDocs].sort((a, b) => docRecencyScore(b) - docRecencyScore(a))[0] || null;
    let mergedDoc = { ...keepDoc };

    if (latestUploadLike) {
      mergedDoc = {
        ...mergedDoc,
        uploadedBy: latestUploadLike.uploadedBy || mergedDoc.uploadedBy,
        uploadedAt: latestUploadLike.uploadedAt || mergedDoc.uploadedAt,
        fileName: latestUploadLike.fileName || mergedDoc.fileName || "",
        fileType: latestUploadLike.fileType || mergedDoc.fileType || "",
        fileSizeBytes: latestUploadLike.fileSizeBytes || mergedDoc.fileSizeBytes || 0,
        fileDataUrl: latestUploadLike.fileDataUrl || mergedDoc.fileDataUrl || null,
        fileAssetKey: latestUploadLike.fileAssetKey || mergedDoc.fileAssetKey || "",
        externalUrl: latestUploadLike.externalUrl || mergedDoc.externalUrl || "",
        attachmentNotice: latestUploadLike.attachmentNotice || mergedDoc.attachmentNotice || "",
        notes: latestUploadLike.notes || mergedDoc.notes || "",
        autoCompareSummary:
          Array.isArray(latestUploadLike.autoCompareSummary) && latestUploadLike.autoCompareSummary.length > 0
            ? latestUploadLike.autoCompareSummary
            : mergedDoc.autoCompareSummary,
      };
    }

    nextDocs.push(mergedDoc);
    group.forEach((doc) => {
      if (doc !== keepDoc) removedDocs.push(doc);
    });
  });

  return {
    docs: nextDocs,
    removedDocs,
    removedCount: removedDocs.length,
    consolidatedGroups,
  };
};

const cleanupRemovedCovenantAssets = (removedDocs, keptDocs) => {
  const keepAssetKeys = new Set((Array.isArray(keptDocs) ? keptDocs : []).map((doc) => doc?.fileAssetKey).filter(Boolean));
  (Array.isArray(removedDocs) ? removedDocs : []).forEach((doc) => {
    const assetKey = doc?.fileAssetKey;
    if (assetKey && !keepAssetKeys.has(assetKey)) {
      deleteCovenantAssetBlob(assetKey).catch(() => {});
    }
  });
};

const covenantDisplayRank = (doc) => {
  const year = normalizedDocYear(doc);
  if (String(doc?.id || "") === "2008" || year === "2008") return 0;
  if (String(doc?.id || "") === "2014" || year === "2014") return 1;
  if (String(doc?.id || "") === "2021" || year === "2021") return 2;
  return 3;
};

const sortCovenantDocsForDisplay = (docs) =>
  (Array.isArray(docs) ? docs : [])
    .map((doc, idx) => ({ doc, idx }))
    .sort((a, b) => {
      const rankDiff = covenantDisplayRank(a.doc) - covenantDisplayRank(b.doc);
      if (rankDiff !== 0) return rankDiff;
      const recencyDiff = docRecencyScore(b.doc) - docRecencyScore(a.doc);
      if (recencyDiff !== 0) return recencyDiff;
      return a.idx - b.idx;
    })
    .map((entry) => entry.doc);

// ── ICONS ────────────────────────────────────────────────────────────────────
const Icon = {
  home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  doc: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
  compare: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="18" rx="1"/><rect x="13" y="3" width="8" height="18" rx="1"/></svg>,
  warn: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 2,22 22,22"/><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  home2: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  vote: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20,6 9,17 4,12"/></svg>,
  chat: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  dash: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  user: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  menu: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
  close: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  logout: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  lock: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  star: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  mountain: () => (
    <svg width="32" height="20" viewBox="0 0 120 40" fill="none">
      <polyline points="0,40 30,8 50,22 75,2 100,20 120,12 120,40" fill={C.forest} opacity="0.15" stroke={C.stone} strokeWidth="1.5"/>
    </svg>
  ),
};

// ── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  app: { display:"flex", minHeight:"100vh", background:C.parchment, fontFamily:"system-ui,-apple-system,sans-serif", color:C.ink },
  sidebar: { width:240, background:C.forest, display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", flexShrink:0 },
  sidebarTop: { padding:"24px 20px 16px", borderBottom:`1px solid rgba(255,255,255,0.1)` },
  sidebarLogo: { fontFamily:"Georgia,serif", fontSize:18, fontWeight:"bold", color:C.white, lineHeight:1.2, marginBottom:4 },
  sidebarSub: { fontSize:11, color:C.stone, textTransform:"uppercase", letterSpacing:"0.08em" },
  sidebarUser: { padding:"12px 20px", borderBottom:`1px solid rgba(255,255,255,0.1)`, fontSize:12, color:C.stone },
  sidebarNav: { flex:1, padding:"12px 0", overflowY:"auto" },
  navItem: (active) => ({ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", cursor:"pointer", fontSize:13, fontWeight: active ? 600 : 400, color: active ? C.white : "rgba(255,255,255,0.65)", background: active ? "rgba(196,168,130,0.2)" : "transparent", borderLeft: active ? `3px solid ${C.stone}` : "3px solid transparent", transition:"all .15s" }),
  sidebarBottom: { padding:"16px 20px", borderTop:`1px solid rgba(255,255,255,0.1)` },
  main: { flex:1, overflowY:"auto", minWidth: 0 },
  topbar: { background:C.white, borderBottom:`1px solid ${C.border}`, padding:"14px 32px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:10 },
  topbarTitle: { fontFamily:"Georgia,serif", fontSize:20, fontWeight:"bold", color:C.forest },
  content: { padding:"28px 32px", maxWidth:1100, margin:"0 auto" },
  card: { background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"20px 24px", marginBottom:16 },
  cardTitle: { fontFamily:"Georgia,serif", fontSize:17, fontWeight:"bold", color:C.forest, marginBottom:8 },
  badge: (color, bg) => ({ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, padding:"3px 10px", borderRadius:20, background:bg, color:color, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em" }),
  btn: (variant="primary") => ({
    display:"inline-flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:8, fontSize:14, fontWeight:600, cursor:"pointer", border:"none", transition:"all .15s", touchAction:"manipulation",
    ...(variant === "primary" ? { background:C.forest, color:C.white } :
       variant === "stone" ? { background:C.stone, color:C.forest } :
       variant === "danger" ? { background:C.danger, color:C.white } :
       variant === "outline" ? { background:"transparent", color:C.forest, border:`1px solid ${C.forest}` } :
       { background:C.parchmentDark, color:C.ink, border:`1px solid ${C.border}` })
  }),
  input: { width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:16, lineHeight:1.3, fontFamily:"inherit", background:C.white, color:C.ink, outline:"none", boxSizing:"border-box" },
  textarea: { width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:16, lineHeight:1.35, fontFamily:"inherit", background:C.white, color:C.ink, outline:"none", resize:"vertical", minHeight:100, boxSizing:"border-box" },
  label: { display:"block", fontSize:12, fontWeight:600, color:C.muted, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" },
  select: { width:"100%", padding:"10px 12px", border:`1px solid ${C.border}`, borderRadius:8, fontSize:16, lineHeight:1.3, fontFamily:"inherit", background:C.white, color:C.ink, outline:"none" },
  alert: (type) => ({ padding:"12px 16px", borderRadius:6, fontSize:13, lineHeight:1.6, marginBottom:12, border:`1px solid`, ...(type==="warn" ? { background:C.amberLight, color:C.amber, borderColor:"#D97706" } : type==="danger" ? { background:C.dangerLight, color:C.danger, borderColor:C.danger } : type==="success" ? { background:C.successLight, color:C.success, borderColor:"#16A34A" } : { background:"#EFF6FF", color:"#1E40AF", borderColor:"#3B82F6" }) }),
  table: { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th: { textAlign:"left", padding:"8px 12px", fontWeight:600, background:C.forest, color:C.white, fontSize:12, textTransform:"uppercase", letterSpacing:"0.05em" },
  td: { padding:"9px 12px", borderBottom:`1px solid ${C.border}`, verticalAlign:"top", lineHeight:1.5 },
  meter: { height:20, borderRadius:10, background:C.parchmentDark, overflow:"hidden", position:"relative", margin:"8px 0" },
  meterFill: (pct, color) => ({ height:"100%", width:`${pct}%`, background:color, borderRadius:10, transition:"width 1s ease" }),
  pill: (c, bg) => ({ display:"inline-block", padding:"2px 10px", borderRadius:20, fontSize:11, fontWeight:600, color:c, background:bg }),
  statGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(170px, 1fr))", gap:12, marginBottom:20 },
  statCard: (accent) => ({ background:C.white, border:`1px solid ${C.border}`, borderRadius:8, padding:"16px 20px", borderTop:`3px solid ${accent}` }),
  statNum: { fontSize:28, fontWeight:700, color:C.forest, fontFamily:"Georgia,serif" },
  statLabel: { fontSize:12, color:C.muted, marginTop:2 },
};

// ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, adminAccessEntries }) {
  const [lot, setLot] = useState(""); const [name, setName] = useState(""); const [pw, setPw] = useState(""); const [accessRole, setAccessRole] = useState(ACCESS_ROLES.primary); const [err, setErr] = useState("");
  const handle = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const hasAdminApproval = isAdminUserAllowed(trimmedName, adminAccessEntries);
    const lots = hasAdminApproval ? ["ADMIN"] : parseLotsInput(lot);
    if ((!hasAdminApproval && lots.length === 0) || !trimmedName || pw.length < MIN_LOGIN_SECRET_LENGTH) {
      setErr(`Please enter your name, lot number(s), and a password (min ${MIN_LOGIN_SECRET_LENGTH} characters).`);
      return;
    }
    const isAdmin = lots.length === 1 && lots[0] === "ADMIN";
    if (isAdmin && !hasAdminApproval) {
      setErr("This account is not authorized for admin access. Contact the HOA administrator.");
      return;
    }
    const user = {
      lot: isAdmin ? "ADMIN" : lots.length === 1 ? lots[0] : lots.join(", "),
      lots,
      name: trimmedName,
      accessRole: isAdmin ? ACCESS_ROLES.primary : normalizeAccessRole(accessRole),
      isAdmin,
      loginSecret: pw,
    };
    const loginError = onLogin(user);
    if (loginError) {
      setErr(loginError);
    }
  };
  return (
    <div style={{ minHeight:"100vh", background:C.forest, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ background:C.white, borderRadius:12, padding:40, width:"100%", maxWidth:420, boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:8 }}><Icon.mountain/></div>
          <div style={{ fontFamily:"Georgia,serif", fontSize:22, fontWeight:"bold", color:C.forest, lineHeight:1.2 }}>Falling Waters</div>
          <div style={{ fontSize:13, color:C.muted, marginTop:4 }}>Community Covenant Portal</div>
        </div>
        <div style={S.alert("info")}>
          Enter your lot number(s), name, and password to access the portal. Primary voter logins lock voting rights by lot to the registered primary voter identity, preventing duplicate voting from alternate IDs.
          Approved admin names receive admin access automatically.
        </div>
        {err && <div style={S.alert("danger")}>{err}</div>}
        <form onSubmit={handle}>
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Lot number(s)</label>
            <input
              style={S.input}
              placeholder="e.g. Lot 36, Lot 37 (admins can leave blank)"
              value={lot}
              onChange={e=>setLot(e.target.value)}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={S.label}>Your name</label>
            <input
              style={S.input}
              placeholder="First and last name"
              value={name}
              onChange={e=>setName(e.target.value)}
              autoCapitalize="words"
              autoCorrect="on"
              enterKeyHint="next"
            />
            {isAdminUserAllowed(name.trim(), adminAccessEntries) && (
              <div style={{ fontSize: 11, color: C.success, marginTop: 6, fontWeight: 600 }}>
                Admin recognized. You will enter Admin Control Mode after sign in.
              </div>
            )}
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={S.label}>Create / enter a password</label>
            <input
              style={S.input}
              type="password"
              placeholder={`Min ${MIN_LOGIN_SECRET_LENGTH} characters`}
              value={pw}
              onChange={e=>setPw(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="go"
            />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={S.label}>Access role</label>
            <select style={S.select} value={accessRole} onChange={e=>setAccessRole(e.target.value)}>
              <option value={ACCESS_ROLES.primary}>Primary voter (can vote + comment)</option>
              <option value={ACCESS_ROLES.commentOnly}>Comment-only household member</option>
            </select>
          </div>
          <button type="submit" style={{ ...S.btn("primary"), width:"100%", justifyContent:"center", padding:"11px 20px", fontSize:14 }}>
            <Icon.lock/> Enter the portal
          </button>
        </form>
        <div style={{ fontSize:11, color:C.muted, marginTop:16, textAlign:"center", lineHeight:1.6 }}>
          This portal is for Falling Waters lot owners only.<br/>Your participation is voluntary and your vote is confidential.
        </div>
      </div>
    </div>
  );
}

// ── HOME PAGE ────────────────────────────────────────────────────────────────
function HomePage({ votes, stats, totalLots, votesNeeded }) {
  const communityEngaged = Math.min(totalLots, stats.votedLots);
  const notVotedLots = Math.max(totalLots - communityEngaged, 0);
  const engPct = Math.round((communityEngaged / totalLots) * 100);
  const yesPct = Math.round((votes.eliminate / totalLots) * 100);
  const voteResponseCount = votes.eliminate + votes.permit + votes.undecided;
  const totalCoverage = voteResponseCount + notVotedLots;
  const integrityChecks = [
    {
      label: "Vote response buckets",
      equation: `${votes.eliminate} + ${votes.permit} + ${votes.undecided} + ${notVotedLots} = ${totalCoverage} of ${totalLots}`,
      pass: totalCoverage === totalLots,
    },
    {
      label: "Engagement aligns with ledger",
      equation: `${communityEngaged} engaged = ${voteResponseCount} voted-response lots`,
      pass: communityEngaged === voteResponseCount,
    },
    {
      label: "Portal totals align",
      equation: `stats.votedLots (${stats.votedLots}) = engaged (${communityEngaged})`,
      pass: stats.votedLots === communityEngaged,
    },
  ];
  const integrityPass = integrityChecks.every((check) => check.pass);
  return (
    <div>
      <div style={{ background:`linear-gradient(135deg, ${C.forest} 0%, ${C.forestLight} 100%)`, borderRadius:10, padding:"28px 32px", marginBottom:20, color:C.white, position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", right:0, bottom:0, opacity:0.12 }}>
          <svg width="300" height="100" viewBox="0 0 300 100"><polyline points="0,100 60,20 100,55 160,5 220,40 280,15 300,25 300,100" fill={C.white}/></svg>
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontSize:13, color:C.stone, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>Falling Waters Residential Association</div>
        <h1 style={{ fontFamily:"Georgia,serif", fontSize:28, margin:"0 0 8px", lineHeight:1.2 }}>One Community, One Covenant</h1>
        <p style={{ fontSize:14, color:"rgba(255,255,255,0.8)", maxWidth:560, margin:"0 0 20px", lineHeight:1.6 }}>A community-led effort to adopt a single, legally valid set of CC&Rs binding all {totalLots} lots — transparently, fairly, and permanently.</p>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          <span style={{ background:"rgba(196,168,130,0.25)", border:`1px solid ${C.stone}`, color:C.stone, padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:600 }}>⚖ Phase 1 — Legal review in progress</span>
          <span style={{ background:"rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.8)", padding:"4px 14px", borderRadius:20, fontSize:12 }}>Attorney engaged · Aug 2026</span>
        </div>
      </div>

      <div style={S.statGrid}>
        {[
          { num:totalLots, label:"Total lots", accent:C.forest },
          { num:votesNeeded, label:"Votes needed (2/3)", accent:C.stone },
          { num:communityEngaged, label:"Owners engaged", accent:"#2563EB" },
          { num:`${yesPct}%`, label:"Supporting STR elimination", accent:C.danger },
        ].map((s,i) => (
          <div key={i} style={S.statCard(s.accent)}>
            <div style={S.statNum}>{s.num}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:16, marginBottom:16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Overall engagement</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:10 }}>Owners who have participated in the survey process</div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted, marginBottom:4 }}><span>{communityEngaged} of {totalLots} lots engaged</span><span>{engPct}%</span></div>
          <div style={S.meter}><div style={S.meterFill(engPct, C.forest)}/></div>
          <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>Goal: 100% engagement before vote · {notVotedLots} owners not yet reached</div>
          <div style={{ marginTop:10, fontSize:12, color:C.muted, lineHeight:1.55 }}>
            Portal-tracked engagement: <strong>{stats.loggedInLots}</strong> lots logged in · <strong>{stats.commentedLots}</strong> lots commented · <strong>{stats.votedLots}</strong> lots cast a portal vote.
          </div>
        </div>
        <div style={S.card}>
          <div style={S.cardTitle}>STR vote progress</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:10 }}>Current STR policy preference within the one-community CC&R campaign</div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted, marginBottom:4 }}><span>{votes.eliminate} eliminate · {votes.permit} permit · {votes.undecided} undecided · {notVotedLots} not voted</span><span>{yesPct}% support elimination</span></div>
          <div style={{ height:20, borderRadius:10, overflow:"hidden", display:"flex", margin:"8px 0" }}>
            <div style={{ width:`${(votes.eliminate/totalLots)*100}%`, background:C.danger, transition:"width 1s" }}/>
            <div style={{ width:`${(votes.permit/totalLots)*100}%`, background:C.stone, transition:"width 1s" }}/>
            <div style={{ width:`${(votes.undecided/totalLots)*100}%`, background:"#3B82F6", transition:"width 1s" }}/>
            <div style={{ width:`${(notVotedLots/totalLots)*100}%`, background:C.parchmentDark, transition:"width 1s" }}/>
          </div>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap", fontSize:11, color:C.muted }}>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, background:C.danger, borderRadius:2, display:"inline-block" }}/> Eliminate STRs ({votes.eliminate})</span>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, background:C.stone, borderRadius:2, display:"inline-block" }}/> Permit STRs ({votes.permit})</span>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, background:"#3B82F6", borderRadius:2, display:"inline-block" }}/> Undecided ({votes.undecided})</span>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}><span style={{ width:10, height:10, background:C.parchmentDark, border:`1px solid ${C.border}`, borderRadius:2, display:"inline-block" }}/> Not voted ({notVotedLots})</span>
          </div>
          <div style={{ ...S.alert("warn"), marginTop:12, marginBottom:0, fontSize:12 }}>Need {votesNeeded} votes to eliminate STRs. Currently {Math.max(votesNeeded - votes.eliminate, 0)} votes short.</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, marginBottom:8, flexWrap:"wrap" }}>
          <div style={S.cardTitle}>Data integrity check (live)</div>
          <span style={S.badge(integrityPass ? C.success : C.danger, integrityPass ? C.successLight : C.dangerLight)}>
            {integrityPass ? "PASS" : "REVIEW NEEDED"}
          </span>
        </div>
        <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>
          Calculated from current vote ledger and lot count in real time.
        </div>
        <div style={{ display:"grid", gap:8 }}>
          {integrityChecks.map((check, idx) => (
            <div key={idx} style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"8px 10px", background:C.white }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <div style={{ fontSize:12, fontWeight:600, color:C.forest }}>{check.label}</div>
                <span style={S.badge(check.pass ? C.success : C.danger, check.pass ? C.successLight : C.dangerLight)}>
                  {check.pass ? "OK" : "Mismatch"}
                </span>
              </div>
              <div style={{ fontSize:12, color:C.muted, marginTop:6, fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                {check.equation}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Why this matters — the urgent case for a unified CC&R</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12, marginTop:12 }}>
          {[
            { icon:"⚖", title:"Three conflicting covenant sets", text:"Falling Waters currently operates under 2008, 2014, and 2021 declarations simultaneously. Title companies flag this when you try to sell. Lenders may decline to finance. Every month without a unified CC&R is a month this problem compounds." },
            { icon:"🏠", title:"Short-term rental gap — confirmed by attorney", text:"Our attorney confirmed that 2014-lot owners have no enforceable STR restriction in their chain of title. Without a unified CC&R, the community cannot establish consistent STR rules. The STR question can only be settled by the vote you're being asked to participate in." },
            { icon:"🐻", title:"Safety and community character", text:"STR guests don't always know our community rules — noise, parking, and fire safety. Wildlife-specific restrictions can be addressed in a future CC&R amendment. A unified CC&R with clear STR rules and guest conduct standards gives the HOA enforceable authority over behavior that puts residents at risk." },
          ].map((item,i) => (
            <div key={i} style={{ background:C.parchment, borderRadius:6, padding:"14px 16px" }}>
              <div style={{ fontSize:20, marginBottom:6 }}>{item.icon}</div>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:6, color:C.forest }}>{item.title}</div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{item.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DOCUMENTS PAGE ───────────────────────────────────────────────────────────
const DEFAULT_COVENANT_DOCS = [
    { id:"2008", year:2008, title:"Master Declaration of CC&Rs", preparer:"Clear Creek Properties LLC · Balch & Bingham LLP", filed:"May 28, 2008", ref:"Deed Book 1479, Page 194 — Gilmer County", status:"original", statusLabel:"Original", sections:[
      { heading:"Amendment threshold", text:"Section 14.2(c): 67% of total Class A votes in the Association. By-Laws set a quorum of 10% for meetings. This is the foundational threshold against which all subsequent amendment attempts must be measured." },
      { heading:"Leasing (Section 10.4)", text:"Lots may be leased for residential purposes only. All leases shall be in writing and for a term of at least one (1) year. No hardship system — leasing was broadly permitted with a 1-year minimum. This is the original standard the working group proposes to restore." },
      { heading:"Short-term rentals", text:"Silent on STRs by name — Airbnb/VRBO didn't exist in 2008. However, the 1-year minimum lease requirement in Section 10.4 effectively prohibited rentals shorter than 12 months from day one. Our attorney has confirmed this." },
      { heading:"Georgia POA Act", text:"Explicitly opted OUT of O.C.G.A. §44-3-220. The 2008 document states it was not intended to create a property owners' development within the meaning of that Act. This is a developer protection, not an owner protection." },
      { heading:"Minimum home size", text:"Not specified in the declaration — deferred entirely to the Architectural Review Board (ARB) and design guidelines. No square footage minimums are set in the 2008 document itself." },
      { heading:"Assessment cap", text:"No annual increase cap. Budget may be disapproved by 67% of Class A votes. The Board sets amounts at its discretion." },
      { heading:"Dispute resolution (Section 14.5)", text:"Strongly encourages mediation and arbitration before litigation. Litigation requires 80% of Class A votes — a high bar designed to prevent the Association from becoming litigious." },
      { heading:"Duration", text:"Perpetual. Auto-renews every 20 years. Termination within first 20 years requires 90% owner consent — very high bar for dissolution." },
    ]},
    { id:"2014", year:2014, title:"Declaration of Covenants, Reservations and Restrictions", preparer:"Highland Falls LLC (post-bankruptcy declarant)", filed:"April 14, 2014", ref:"Deed Book 1860, Pages 188-202 — Gilmer/Pickens Counties", status:"active2014", statusLabel:"Active — Phase II lots", sections:[
      { heading:"Amendment threshold", text:"67% of members voting at a duly noticed meeting, with a 50% quorum required. This is meaningfully different from the 2008 document — with 50% quorum (100 lots present), only 67 votes could pass an amendment. The lower turnout required makes this easier to satisfy." },
      { heading:"Short-term rentals — THE CRITICAL GAP", text:"Completely silent. No rental restriction of any kind appears in this document. Our attorney has confirmed that under Georgia law, which disfavors restrictions on land use, a 2014-lot owner whose chain of title does not include the 2008 document has no enforceable STR restriction. This is the gap the unified CC&R must close." },
      { heading:"Long-term leasing", text:"Also not addressed. The 2014 document contains no leasing section whatsoever, creating uncertainty for tenants, lenders, and title companies on Phase II lots." },
      { heading:"Minimum home size", text:"1,400 sf for single-level residences; 1,800 sf for two-level residences; minimum 1,400 sf on first floor. The only document of the three to specify minimums. The working group proposes restoring this standard in the unified CC&R." },
      { heading:"Assessment cap", text:"Maximum 10% annual increase without a member vote. The only document with a cap. This provision protects owners from unchecked dues increases and was quietly removed in the 2021 document." },
      { heading:"Georgia POA Act", text:"Not addressed — neither opts in nor opts out. This creates further ambiguity about which statutory protections apply to Phase II lot owners." },
      { heading:"Duration", text:"Runs until January 1, 2040, then auto-renews in 10-year increments. A future expiration date — unlike the 2008 and 2021 documents, which are perpetual." },
    ]},
    { id:"2021", year:2021, title:"Consolidated, Amended and Restated Declaration", preparer:"Falling Waters Residential Association, Inc. · Dorough & Dorough LLC", filed:"December 3, 2021", ref:"Deed Book 02453 — Gilmer County", status:"disputed", statusLabel:"Disputed — consent form only", sections:[
      { heading:"Adoption method — the legitimacy issue", text:"The 2021 document was adopted through individual owner consent forms, not a community-wide vote meeting the 67% threshold required by the 2008 and 2014 documents. Only lots whose owners signed consent forms are bound by it. Non-signers remain under their prior declaration. This patchwork is the core legal problem." },
      { heading:"Amendment threshold", text:"2/3 of ALL 200 lot owners (134 votes), regardless of meeting attendance. The most rigorous standard of the three — and the standard the working group proposes to adopt for the unified CC&R, because it prevents a low-turnout meeting from permanently changing everyone's property rights." },
      { heading:"Short-term rentals (Section 8.6)", text:"Absolute prohibition. 'Under no circumstances shall a Unit be leased, rented or used for short-term transient or hotel purposes or rented through short-term internet rental services, including, without limitation, VRBO, Airbnb, HomeAway, or such other similar rental services.' However, this ban only binds consent-form signers." },
      { heading:"Long-term leasing (Section 8.5)", text:"Near-total prohibition — a hardship permit system requiring board approval for any leasing. Hardship defined narrowly as death, involuntary relocation, or temporary absence. Attorney has flagged this as legally risky given recent Georgia POAA changes protecting leasing rights. The working group proposes replacing this with the 2008 standard." },
      { heading:"Georgia POA Act", text:"Explicitly submits the community to O.C.G.A. §44-3-220. The working group endorses retaining this — POA Act submission gives the HOA clearer enforcement tools and lender-friendly governance." },
      { heading:"Minimum home size", text:"Not specified — deferred to ACC and Community-Wide Standard. Reverts to the ambiguity of the 2008 document, losing the clarity that the 2014 document established." },
      { heading:"Assessment cap", text:"No cap. Board has full discretion to set annual assessments at any amount. The removal of the 2014 document's 10% cap was not highlighted during the consent form process and is a significant change most owners may not be aware of." },
      { heading:"Dispute resolution", text:"2/3 vote required to authorize litigation. No mandatory mediation. The working group proposes restoring the 2008 document's mediation-first requirement." },
    ]},
];

function DocumentsPage({ docs }) {
  const [open, setOpen] = useState(null);
  const [viewerDocId, setViewerDocId] = useState(null);
  const [viewerAssetUrl, setViewerAssetUrl] = useState("");
  const [viewerAssetError, setViewerAssetError] = useState("");
  const safeDocs = sortCovenantDocsForDisplay(docs);
  const viewerDoc = safeDocs.find((doc) => doc.id === viewerDocId) || null;
  const viewerSrc = viewerDoc?.fileDataUrl || viewerAssetUrl || viewerDoc?.externalUrl || "";
  const statusColors = {
    original:{ bg:"#DBEAFE", c:"#1E40AF" },
    active2014:{ bg:C.amberLight, c:C.amber },
    disputed:{ bg:C.dangerLight, c:C.danger },
    uploaded:{ bg:"#E0E7FF", c:"#4338CA" },
  };

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    setViewerAssetUrl("");
    setViewerAssetError("");
    if (!viewerDoc || viewerDoc.fileDataUrl || !viewerDoc.fileAssetKey) return undefined;
    (async () => {
      try {
        const blob = await getCovenantAssetBlob(viewerDoc.fileAssetKey);
        if (!blob) {
          throw new Error("Stored file is not available in this browser. Ask admin to re-upload or provide external URL.");
        }
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setViewerAssetUrl(objectUrl);
        } else {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setViewerAssetError(err?.message || "Could not load local browser copy of this covenant.");
        }
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [viewerDoc?.id, viewerDoc?.fileAssetKey, viewerDoc?.fileDataUrl]);

  return (
    <div>
      <div style={S.alert("info")}><strong>These are the covenant records currently in Falling Waters.</strong> Depending on your lot number and whether you signed the 2021 consent form, one of these documents governs your property. Click any document to read key provisions and uploaded comparison notes.</div>
      {safeDocs.map(doc => {
        const sc = statusColors[doc.status] || statusColors.uploaded;
        return (
          <div key={doc.id} style={{ ...S.card, borderLeft:`4px solid ${sc.c}` }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <span style={{ fontFamily:"Georgia,serif", fontSize:22, fontWeight:"bold", color:C.forest }}>{doc.year}</span>
                  <span style={S.badge(sc.c, sc.bg)}>{doc.statusLabel}</span>
                </div>
                <div style={{ fontFamily:"Georgia,serif", fontSize:16, fontWeight:"bold", color:C.ink, marginBottom:4 }}>{doc.title}</div>
                <div style={{ fontSize:12, color:C.muted, marginBottom:2 }}>{doc.preparer}</div>
                <div style={{ fontSize:12, color:C.muted }}>Filed: {doc.filed} · {doc.ref}</div>
                {doc.source === "uploaded" && (
                  <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>
                    Uploaded by {doc.uploadedBy || "Admin"} on {doc.uploadedAt || "Unknown date"}
                  </div>
                )}
              </div>
              <button style={S.btn("outline")} onClick={() => setOpen(open === doc.id ? null : doc.id)}>
                {open === doc.id ? "Collapse ▲" : "Read details ▼"}
              </button>
            </div>
            {open === doc.id && (
              <div style={{ marginTop:16, borderTop:`1px solid ${C.border}`, paddingTop:16 }}>
                {Array.isArray(doc.sections) && doc.sections.length > 0 && doc.sections.map((s,i) => (
                  <div key={i} style={{ marginBottom:14 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:C.forest, marginBottom:4 }}>{s.heading}</div>
                    <div style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>{s.text}</div>
                  </div>
                ))}
                {doc.notes && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:C.forest, marginBottom:4 }}>Admin notes</div>
                    <div style={{ fontSize:13, color:C.muted, lineHeight:1.7 }}>{doc.notes}</div>
                  </div>
                )}
                {doc.autoCompareSummary?.length > 0 && (
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontWeight:700, fontSize:13, color:C.forest, marginBottom:6 }}>Auto-compare summary</div>
                    <ul style={{ margin:"0 0 0 18px", color:C.muted, fontSize:12, lineHeight:1.7 }}>
                      {doc.autoCompareSummary.map((item, idx) => <li key={idx}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {doc.attachmentNotice && (
                  <div style={{ ...S.alert("warn"), marginBottom: 12 }}>
                    {doc.attachmentNotice}
                  </div>
                )}
                {(doc.fileDataUrl || doc.fileAssetKey || doc.externalUrl) && (
                  <div>
                    <button style={S.btn("outline")} onClick={() => setViewerDocId(doc.id)}>
                      Read-only view covenant
                    </button>
                    <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>
                      Resident access is view-only in this portal.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {viewerDoc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setViewerDocId(null)}
        >
          <div
            style={{
              width: "min(1100px, 96vw)",
              height: "min(90vh, 860px)",
              background: C.white,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.forest }}>
                Read-only covenant viewer · {viewerDoc.title}
              </div>
              <button style={{ ...S.btn("outline"), padding: "6px 10px" }} onClick={() => setViewerDocId(null)}>
                Close
              </button>
            </div>
            {viewerSrc ? (
              <iframe
                title={`Read-only covenant viewer ${viewerDoc.id}`}
                src={viewerSrc}
                style={{ border: "none", width: "100%", flex: 1, background: C.white }}
              />
            ) : (
              <div style={{ padding: 16, fontSize: 12, color: C.muted }}>
                {viewerAssetError || "No embedded viewer source is available for this document."}
              </div>
            )}
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span>If the document does not render in the embedded viewer, open it in a new tab.</span>
              {viewerSrc && (
                <a href={viewerSrc} target="_blank" rel="noreferrer" style={{ color: "#1D4ED8", textDecoration: "none", fontWeight: 600 }}>
                  Open read-only view in new tab
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ADMIN DOCUMENTS PAGE ─────────────────────────────────────────────────────
function AdminDocumentsPage({ user, docs, onAddDocument, onDeleteDocument, onConsolidateDocuments }) {
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [preparer, setPreparer] = useState("");
  const [filed, setFiled] = useState("");
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState("uploaded");
  const [notes, setNotes] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const uploadedDocs = docs.filter((d) => d.source === "uploaded");

  const resetForm = () => {
    setYear("");
    setTitle("");
    setPreparer("");
    setFiled("");
    setRef("");
    setStatus("uploaded");
    setNotes("");
    setExternalUrl("");
    setFile(null);
  };

  const runConsolidation = () => {
    setError("");
    setSuccess("");
    const result = onConsolidateDocuments?.();
    if (result?.error) {
      setError(result.error);
      return;
    }
    setSuccess(result?.message || "Duplicate entries consolidated.");
  };

  const saveDocument = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const normalizedExternalUrl = String(externalUrl || "").trim();
    if (!file && !normalizedExternalUrl) {
      setError("Please select a covenant file or provide an external document URL.");
      return;
    }
    if (file && file.size > MAX_UPLOAD_BYTES) {
      setError(`File is too large. Please keep uploads under ${formatMegabytes(MAX_UPLOAD_BYTES)}.`);
      return;
    }

    setIsSaving(true);
    try {
      const documentId = `upload_${Date.now()}`;
      let fileDataUrl = null;
      let fileAssetKey = "";
      let attachmentNotice = "";
      if (file && file.size <= MAX_INLINE_ATTACHMENT_BYTES) {
        fileDataUrl = await readFileAsDataUrl(file);
      } else if (file && file.size > MAX_INLINE_ATTACHMENT_BYTES) {
        try {
          await putCovenantAssetBlob(documentId, file, file.name, file.type || "application/octet-stream");
          fileAssetKey = documentId;
          attachmentNotice = `Large file stored in this browser for read-only viewing: ${file.name} (${formatMegabytes(file.size)}). This local copy may not be visible on other devices unless you provide an external URL.`;
        } catch (storageErr) {
          if (!normalizedExternalUrl) {
            throw new Error("Large file could not be stored in browser storage. Please provide an external document URL.");
          }
          attachmentNotice = `Large file could not be stored locally in this browser. Residents can use the provided external URL to view the document.`;
        }
      }
      let extractedText = "";
      if (file) {
        try {
          if (file.type?.includes("text") || file.size <= 2 * 1024 * 1024) {
            extractedText = await readFileAsText(file);
          } else {
            extractedText = "";
          }
        } catch {
          extractedText = "";
        }
      }

      const autoCompareSummary = summarizeUploadedCovenant(extractedText, docs.length);
      const statusLabel =
        DOC_STATUS_OPTIONS.find((opt) => opt.value === status)?.label || "Uploaded for review";

      onAddDocument({
        id: documentId,
        year: year.trim() || "N/A",
        title: title.trim(),
        preparer: preparer.trim() || "Uploaded by HOA admin",
        filed: filed.trim() || todayLabel(),
        ref: ref.trim() || "Owner portal upload",
        status,
        statusLabel,
        source: "uploaded",
        uploadedBy: user.name,
        uploadedAt: todayLabel(),
        fileName: file?.name || "",
        fileType: file?.type || "",
        fileSizeBytes: file?.size || 0,
        fileDataUrl,
        fileAssetKey,
        externalUrl: normalizedExternalUrl,
        attachmentNotice,
        notes: notes.trim(),
        sections: notes.trim() ? [{ heading: "Admin summary", text: notes.trim() }] : [],
        autoCompareSummary,
      });

      setSuccess(fileDataUrl
        ? "Covenant uploaded and added to CC&R Documents with automatic comparison summary."
        : fileAssetKey
          ? "Covenant uploaded. Large file stored in browser for read-only viewing."
          : "Covenant record saved. Residents can use the external URL for read-only viewing.");
      resetForm();
    } catch (err) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div style={S.alert("info")}>
        <strong>Admin tools:</strong> upload existing covenants here. New uploads appear in the CC&R Documents page with metadata and auto-generated comparison notes.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Upload covenant document</div>
          {error && <div style={S.alert("danger")}>{error}</div>}
          {success && <div style={S.alert("success")}>{success}</div>}
          <form onSubmit={saveDocument}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <div>
                <label style={S.label}>Document year</label>
                <input style={S.input} value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2026" />
              </div>
              <div>
                <label style={S.label}>Status tag</label>
                <select style={S.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {DOC_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>Title</label>
              <input style={S.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Declaration title" />
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>Preparer / source</label>
              <input style={S.input} value={preparer} onChange={(e) => setPreparer(e.target.value)} placeholder="Law firm, board, owner group, etc." />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
              <div>
                <label style={S.label}>Filed date</label>
                <input style={S.input} value={filed} onChange={(e) => setFiled(e.target.value)} placeholder="e.g. Aug 25, 2026" />
              </div>
              <div>
                <label style={S.label}>Reference</label>
                <input style={S.input} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Deed book / page / county" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>Upload covenant file (PDF, DOCX, TXT)</label>
              <input
                style={{ ...S.input, padding: "7px 10px" }}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.rtf,.md"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                Files up to {formatMegabytes(MAX_INLINE_ATTACHMENT_BYTES)} are embedded directly. Larger files up to {formatMegabytes(MAX_UPLOAD_BYTES)} are stored in browser storage for read-only viewing.
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>External document URL (optional, recommended for large files)</label>
              <input
                style={S.input}
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://... link residents can open"
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                Optional fallback link, especially useful when the document must also be viewable from other devices.
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label style={S.label}>Admin notes (optional)</label>
              <textarea
                style={S.textarea}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context, legal notes, or committee summary to display with the upload."
              />
            </div>
            <button type="submit" style={{ ...S.btn("primary"), marginTop: 12 }} disabled={isSaving}>
              {isSaving ? "Uploading..." : "Upload and publish to Documents"}
            </button>
          </form>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Uploaded documents</div>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
            {uploadedDocs.length} uploaded by admins
          </div>
          <button
            style={{ ...S.btn("stone"), marginBottom: 10, padding: "7px 12px", fontSize: 12 }}
            onClick={runConsolidation}
          >
            Consolidate duplicate entries
          </button>
          {uploadedDocs.length === 0 && (
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
              No uploads yet. Use the form to add existing covenants and make them available to owners.
            </div>
          )}
          {uploadedDocs.map((doc) => (
            <div key={doc.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.forest }}>{doc.title}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                {doc.year} · {doc.fileName || (doc.externalUrl ? "External link only" : "No attachment")} · {doc.uploadedAt || "Unknown"}
              </div>
              {!doc.fileDataUrl && doc.attachmentNotice && (
                <div style={{ fontSize: 11, color: C.amber, marginTop: 6 }}>{doc.attachmentNotice}</div>
              )}
              <button
                style={{ ...S.btn("outline"), marginTop: 8, padding: "6px 10px", fontSize: 12 }}
                onClick={() => onDeleteDocument(doc.id)}
              >
                Remove upload
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── COMPARISON PAGE ──────────────────────────────────────────────────────────
function ComparisonPage() {
  const rows = [
    { topic:"Amendment vote", c2008:"67% of all Class A votes; 10% quorum", c2014:"67% of members voting; 50% quorum required", c2021:"2/3 of ALL 200 lots regardless of attendance", risk:"high", proposed:"Adopt 2021 standard — 2/3 of all 200 lots — with certified mail notice, proxy voting, and attorney-supervised count" },
    { topic:"Short-term rentals", c2008:"Silent — but 1-yr lease minimum effectively prohibits", c2014:"⚠ Completely silent — NO restriction confirmed by attorney", c2021:"Absolute ban — VRBO, Airbnb, HomeAway named (consent-form signers only)", risk:"critical", proposed:"Regulated permission: 7-night minimum stay, HOA registration, $1M liability insurance, occupancy limits, nuisance enforcement OR outright prohibition — community vote decides" },
    { topic:"Long-term leasing", c2014:"Not addressed", c2008:"Permitted; 1-year minimum; written lease required", c2021:"Near-total ban — hardship permit system only", risk:"high", proposed:"Restore 2008 standard: permitted, 1-year minimum, written lease, tenant gets docs, HOA notified within 30 days" },
    { topic:"Georgia POA Act", c2008:"Explicitly opted OUT", c2014:"Not addressed", c2021:"Explicitly opted IN", risk:"medium", proposed:"Adopt 2021 standard — submit to O.C.G.A. §44-3-220 for stronger enforcement authority and lender-friendly governance" },
    { topic:"Minimum home size", c2008:"Not specified — deferred to ARB", c2014:"1,400 sf (1-level); 1,800 sf (2-level)", c2021:"Not specified — deferred to ACC", risk:"medium", proposed:"Restore 2014 standard with ACC variance process for unusual lots" },
    { topic:"Annual assessment cap", c2008:"No cap — 67% vote to disapprove budget", c2014:"Max 10% increase without member vote", c2021:"No cap — Board full discretion", risk:"medium", proposed:"Restore a 15% cap without member vote; increases above 15% require simple majority vote" },
    { topic:"Dispute resolution", c2008:"Mediation/arbitration encouraged; 80% to sue", c2014:"Not addressed", c2021:"2/3 vote to sue; no mediation requirement", risk:"medium", proposed:"Restore 2008 mediation-first requirement; keep 2021 litigation threshold (2/3 vote)" },
    { topic:"Lake & wetlands", c2008:"Comprehensive — 5 detailed sections", c2014:"Not addressed", c2021:"Comprehensive — mirrors 2008 with updates", risk:"low", proposed:"Retain 2021 lake/wetlands provisions verbatim" },
    { topic:"Duration", c2008:"Perpetual; 90% to terminate in first 20 yrs", c2014:"Expires Jan 1 2040; auto-renews 10 yrs", c2021:"Perpetual; auto-renews 20 yrs; 2/3 to change", risk:"low", proposed:"Adopt 2021 perpetual model for stability" },
    { topic:"ACC / ARB authority", c2008:"ARB — Declarant appoints until all lots sold", c2014:"ACC appointed by Executive Board; detailed standards", c2021:"ACC 3–5 members; 2-year terms; 'BOD?ACC' confusion in 2026 draft", risk:"medium", proposed:"Clearly separate: ACC handles architecture, Board handles governance; Board appoints ACC but cannot override architectural decisions" },
    { topic:"Wildlife & outdoor safety rules", c2008:"Not addressed", c2014:"Not addressed", c2021:"Not addressed", risk:"new", proposed:"Future addition candidate: consider a dedicated wildlife and outdoor-safety section in a later amendment after one unified CC&R is adopted." },
  ];
  const risk = { critical:{ label:"Critical", c:C.danger, bg:C.dangerLight }, high:{ label:"High", c:"#9A3412", bg:"#FFEDD5" }, medium:{ label:"Medium", c:C.amber, bg:C.amberLight }, low:{ label:"Low", c:C.success, bg:C.successLight }, new:{ label:"New provision", c:"#6B21A8", bg:"#F3E8FF" } };
  return (
    <div>
      <div style={S.alert("warn")}><strong>Attorney-confirmed:</strong> Georgia will not impose a restriction not in an owner's chain of title. Owners whose title only includes the 2014 declaration have no short-term rental restriction today. The unified CC&R is the only way to establish consistent, enforceable rules for all 200 lots.</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:12, marginBottom:12 }}>
        {[
          { title:"Biggest legal mismatch", body:"Only the 2021 document uses the strict 2/3 of all lots threshold. 2008 and 2014 rely on quorum-based meeting votes.", color:C.stone },
          { title:"Biggest STR mismatch", body:"2014 has no STR language, 2008 implied restriction by 1-year leases, and 2021 has explicit prohibition only for consent-form signers.", color:C.danger },
          { title:"Biggest owner-protection mismatch", body:"2014 capped annual dues increases at 10%, but 2008 and 2021 do not include a cap.", color:"#1D4ED8" },
        ].map((item, idx) => (
          <div key={idx} style={{ ...S.card, marginBottom:0, borderTop:`3px solid ${item.color}` }}>
            <div style={{ fontWeight:700, fontSize:13, color:item.color, marginBottom:6 }}>{item.title}</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.6 }}>{item.body}</div>
          </div>
        ))}
      </div>
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, minWidth:130 }}>Provision</th>
                <th style={{ ...S.th, minWidth:150 }}>2008 Original</th>
                <th style={{ ...S.th, minWidth:150 }}>2014 Highland Falls</th>
                <th style={{ ...S.th, minWidth:160 }}>2021 Consolidated</th>
                <th style={{ ...S.th, minWidth:80 }}>Risk</th>
                <th style={{ ...S.th, minWidth:200 }}>Proposed unified standard</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i) => {
                const ri = risk[r.risk];
                return (
                  <tr key={i} style={{ background: i%2===0 ? C.white : C.parchment }}>
                    <td style={{ ...S.td, fontWeight:700, fontSize:12, color:C.forest }}>{r.topic}</td>
                    <td style={S.td}>{r.c2008}</td>
                    <td style={{ ...S.td, background: r.risk==="critical" ? "#FFF7ED" : "inherit" }}>{r.c2014}</td>
                    <td style={S.td}>{r.c2021}</td>
                    <td style={S.td}><span style={S.badge(ri.c, ri.bg)}>{ri.label}</span></td>
                    <td style={{ ...S.td, fontSize:12, color:C.forest, fontWeight:500, borderLeft:`2px solid ${C.stone}` }}>{r.proposed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── PROPOSED UNIFIED CC&R PAGE ───────────────────────────────────────────────
function ProposedCovenantPage() {
  const strategy = [
    {
      phase: "1. Validate legal foundation",
      detail:
        "Finalize attorney memo confirming lawful adoption pathway, required notice periods, and recording requirements for all 200 lots.",
    },
    {
      phase: "2. Publish one plain-language draft",
      detail:
        "Release one consolidated CC&R draft with change tracking from 2008, 2014, and 2021 documents so owners can see every difference.",
    },
    {
      phase: "3. Owner comment and refinement",
      detail:
        "Collect lot-owner comments in the portal and by certified mail response cards, then issue a revised draft with response notes.",
    },
    {
      phase: "4. Certified vote execution",
      detail:
        "Issue ballot package to every owner, allow proxy voting, and complete attorney-supervised tabulation against the 2/3-of-all-lots threshold.",
    },
    {
      phase: "5. Record and enforce one standard",
      detail:
        "Record the approved declaration in county records and retire legacy ambiguity so one enforceable covenant applies to all lots.",
    },
  ];

  const proposedArticles = [
    {
      article: "Article 1 — Community-Wide Applicability",
      summary:
        "One declaration binds all lots and supersedes inconsistent provisions from prior instruments upon valid adoption and recording.",
      source: "Resolves 2008 / 2014 / 2021 patchwork and title ambiguity.",
    },
    {
      article: "Article 2 — Amendment & Voting Standard",
      summary:
        "Any amendment requires affirmative approval of two-thirds (2/3) of all lots (134 of 200), not just a meeting quorum.",
      source: "Uses the stricter 2021 threshold to prevent low-turnout governance changes.",
    },
    {
      article: "Article 3 — Leasing and STR Rule",
      summary:
        "No rentals under 12 months unless the community later approves a regulated STR framework by the same 2/3 standard.",
      source: "Restores original 2008 long-term leasing posture while creating explicit, enforceable STR clarity.",
    },
    {
      article: "Article 4 — Nuisance, Safety, and Conduct",
      summary:
        "Adds explicit standards for noise, large parties, illegal drug activity, and parking obstruction. Wildlife-specific language is reserved for a future CC&R amendment.",
      source: "Responds to owner concerns and closes enforcement gaps in current documents.",
    },
    {
      article: "Article 5 — Assessment Guardrails",
      summary:
        "Annual assessment increases above 15% require owner approval; ordinary increases remain board-managed for operational continuity.",
      source: "Balances 2014 owner protections with practical HOA operations.",
    },
    {
      article: "Article 6 — Dispute Resolution",
      summary:
        "Mandatory mediation before litigation, while keeping a supermajority owner threshold for major litigation decisions.",
      source: "Combines 2008 mediation-first posture with stronger community oversight.",
    },
  ];

  return (
    <div>
      <div style={S.alert("info")}>
        <strong>Draft proposal for One Community Covenant:</strong> this page presents the unified CC&R structure owners are being asked to evaluate. Final legal text will follow attorney markup and owner feedback.
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>What changes if we do nothing?</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 10 }}>
          {[
            {
              title: "No single enforceable STR rule",
              detail:
                "Some lots remain unrestricted while others are restricted, increasing conflict, perceived unfairness, and enforcement failures.",
              color: C.danger,
            },
            {
              title: "Higher sale and financing friction",
              detail:
                "Conflicting covenants continue to trigger lender/title scrutiny, delaying closings and adding legal cost for owners.",
              color: "#9A3412",
            },
            {
              title: "Governance legitimacy risk",
              detail:
                "Selective enforcement weakens trust in the HOA and increases legal disputes over board authority.",
              color: C.amber,
            },
          ].map((item, idx) => (
            <div key={idx} style={{ border: `1px solid ${C.border}`, borderTop: `3px solid ${item.color}`, borderRadius: 8, padding: "12px 14px", background: C.white }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: item.color, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{item.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Proposed unified CC&R articles</div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, minWidth: 220 }}>Proposed article</th>
                <th style={{ ...S.th, minWidth: 320 }}>Summary</th>
                <th style={{ ...S.th, minWidth: 280 }}>Why this provision exists</th>
              </tr>
            </thead>
            <tbody>
              {proposedArticles.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? C.white : C.parchment }}>
                  <td style={{ ...S.td, fontWeight: 700, color: C.forest }}>{row.article}</td>
                  <td style={S.td}>{row.summary}</td>
                  <td style={{ ...S.td, color: C.muted }}>{row.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Strategy to get to One Community Covenant</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 }}>
          {strategy.map((step, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", background: C.parchment }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.forest, marginBottom: 4 }}>{step.phase}</div>
              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>{step.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── STR PAGE ─────────────────────────────────────────────────────────────────
function STRPage({ user, votes, voteLedger, onVote, totalLots, votesNeeded }) {
  const votingLots = normalizeUserLots(user).filter((lot) => lot !== "ADMIN");
  const canVote = isPrimaryVoter(user);
  const lotChoices = votingLots.map((lot) => voteLedger[lot] || store.get(`vote_${lot}`) || null);
  const allUnvoted = lotChoices.every((choice) => !choice);
  const uniformChoice = !allUnvoted && lotChoices.every((choice) => choice && choice === lotChoices[0]);
  const userVoted = allUnvoted ? null : uniformChoice ? lotChoices[0] : "mixed";
  const notVotedLots = Math.max(totalLots - (votes.eliminate + votes.permit + votes.undecided), 0);
  const lotChoiceMap = votingLots.reduce((acc, lot, idx) => {
    acc[lot] = lotChoices[idx] || null;
    return acc;
  }, {});
  const reasons = [
    { icon:"🚗", title:"Increased traffic and parking", text:"Short-term rental guests unfamiliar with private mountain roads park on roadways, block shared driveways, and generate traffic volumes the infrastructure was not designed for. Our private roads — maintained at owner expense — experience accelerated wear." },
    { icon:"🔊", title:"Noise, parties, and disturbances", text:"Vacation renters operate on a different code of conduct than permanent residents and long-term tenants. Late-night parties, amplified music, and large gatherings that violate our nuisance provisions are consistently reported near STR properties. Enforcement is difficult when the owner isn't present." },
    { icon:"🐻", title:"Wildlife-area stewardship", text:"STR guests may be unfamiliar with mountain-community wildlife expectations such as secure garbage and outdoor food handling. These standards are important but will be addressed as a future CC&R amendment topic rather than in the current STR decision language." },
    { icon:"🏘", title:"Community character and property values", text:"Falling Waters was designed as a residential community — not a resort destination. When neighboring lots operate as hotels with rotating occupants, the character of the surrounding properties changes. Long-term studies consistently show mixed residential/STR neighborhoods experience higher property value volatility." },
    { icon:"⚖", title:"Enforcement and liability", text:"The HOA has limited enforcement capacity. Every STR guest who violates a rule requires the Association to identify them, trace them to an owner, and pursue enforcement — while the owner may be hundreds of miles away. The Association's liability exposure from guest incidents is also heightened when the lot is functioning commercially." },
    { icon:"🏛", title:"Legal history — STRs were never permitted", text:"The original 2008 declaration required all leases to be for at least one year, effectively prohibiting short-term rentals before Airbnb existed. No owner has ever had a legally clear right to operate an STR in Falling Waters. The unified CC&R makes explicit what the community intended from the beginning." },
  ];
  return (
    <div>
      <div style={S.alert("warn")}>
        <strong>STR &amp; Unified CC&amp;R Vote:</strong> this section captures each lot's STR policy preference as part of the one-community covenant adoption effort.
      </div>
      <div style={{ ...S.card, background:`linear-gradient(135deg, ${C.dangerLight}, #FFF7ED)`, border:`1px solid ${C.danger}` }}>
        <div style={{ fontFamily:"Georgia,serif", fontSize:18, fontWeight:"bold", color:C.danger, marginBottom:8 }}>Short-Term Rentals — The Central Issue</div>
        <p style={{ fontSize:13, color:C.ink, lineHeight:1.7, margin:"0 0 12px" }}>Our attorney has confirmed: <strong>owners whose chain of title only includes the 2014 declaration have no enforceable short-term rental restriction today.</strong> Georgia courts will not imply a restriction that is not in an owner's title. Without a unified CC&R, Falling Waters cannot establish a consistent, community-wide STR rule — whether permissive or restrictive.</p>
        <p style={{ fontSize:13, color:C.ink, lineHeight:1.7, margin:0 }}>This is the third attempt to solve this problem. The 2021 consent-form effort and the 2026 draft revision both fell short. Your vote below determines whether the unified CC&R eliminates short-term rentals or permits them with regulation. <strong>Every lot owner's voice matters — this is why we need 100% engagement.</strong></p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))", gap:12, marginBottom:20 }}>
        {[
          { label:"Eliminate STRs", count:votes.eliminate, pct:Math.round((votes.eliminate/totalLots)*100), color:C.danger, desc:"No rentals shorter than 12 months. Clear prohibition with 18-month transition for current operators." },
          { label:"Permit with regulation", count:votes.permit, pct:Math.round((votes.permit/totalLots)*100), color:C.stone, desc:"7-night minimum, HOA registration, $1M insurance, occupancy limits, strict nuisance enforcement." },
          { label:"Undecided response", count:votes.undecided, pct:Math.round((votes.undecided/totalLots)*100), color:"#3B82F6", desc:"Owners who participated but need more time or information before choosing eliminate/permit." },
          { label:"Not yet voted", count:notVotedLots, pct:Math.round((notVotedLots/totalLots)*100), color:C.parchmentDark, desc:"Owners who have not yet submitted any preference. Your voice is needed." },
        ].map((v,i) => (
          <div key={i} style={{ background:C.white, border:`2px solid ${v.color}`, borderRadius:8, padding:"16px 20px" }}>
            <div style={{ fontSize:28, fontWeight:700, fontFamily:"Georgia,serif", color:v.color }}>{v.count}</div>
            <div style={{ fontWeight:600, fontSize:13, marginBottom:6, color:C.ink }}>{v.label}</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.5, marginBottom:8 }}>{v.desc}</div>
            <div style={S.meter}><div style={S.meterFill(v.pct, v.color)}/></div>
            <div style={{ fontSize:11, color:C.muted }}>{v.pct}% of {totalLots} lots</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Six reasons Falling Waters needs a clear STR restriction</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12, marginTop:12 }}>
          {reasons.map((r,i) => (
            <div key={i} style={{ background:C.parchment, borderRadius:6, padding:"14px 16px", borderLeft:`3px solid ${C.stone}` }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{r.icon}</div>
              <div style={{ fontWeight:700, fontSize:13, color:C.forest, marginBottom:4 }}>{r.title}</div>
              <div style={{ fontSize:12, color:C.muted, lineHeight:1.65 }}>{r.text}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Cast your STR policy vote for the unified CC&R package</div>
        <div style={S.alert("info")}>
          <strong>Vote context:</strong> this ballot records each lot's preference on STR policy as part of the one-community CC&R effort. Final adoption of one unified declaration still requires the community-wide 2/3 threshold ({votesNeeded} lots).
        </div>
        {!canVote && (
          <div style={S.alert("warn")}>
            This login is set as <strong>{accessRoleLabel(user.accessRole)}</strong>. Voting is restricted to the designated primary voter for each lot, but you can still add community comments.
          </div>
        )}
        {votingLots.length > 1 && (
          <div style={S.alert("info")}>
            You are currently voting for <strong>{votingLots.length} lots</strong> ({votingLots.join(", ")}). Use per-lot controls below for separate votes, or quick actions to apply one choice across all listed lots.
          </div>
        )}
        {userVoted ? (
          <div style={userVoted === "mixed" ? S.alert("warn") : S.alert("success")}>
            <strong>
              {userVoted === "mixed"
                ? "Your listed lots currently have mixed selections."
                : `Your vote has been recorded: "${userVoted === "eliminate" ? "Eliminate STRs" : userVoted === "permit" ? "Permit with regulation" : "Undecided"}".`}
            </strong>{" "}
            You can change your vote at any time before the formal ballot closes. Thank you for participating.
          </div>
        ) : (
          <div style={S.alert("info")}>This is a preliminary preference survey — not the formal legal vote. Results inform the working group's drafting process. The formal certified-mail ballot will follow attorney review and draft completion.</div>
        )}
        {votingLots.length > 1 && (
          <div style={{ marginTop: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Per-lot voting status</div>
            <div style={{ display: "grid", gap: 8 }}>
              {votingLots.map((lot) => (
                <div key={lot} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", background: C.white }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 10 }}>
                    <div style={{ fontWeight: 700, color: C.forest, fontSize: 13 }}>{lot}</div>
                    <span style={S.badge(lotChoiceMap[lot] ? C.success : C.muted, lotChoiceMap[lot] ? C.successLight : C.parchmentDark)}>
                      {choiceLabel(lotChoiceMap[lot])}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      style={{ ...S.btn(lotChoiceMap[lot] === "eliminate" ? "danger" : "outline"), padding: "6px 10px", fontSize: 12 }}
                      onClick={() => canVote && onVote("eliminate", lot)}
                      disabled={!canVote}
                    >
                      Eliminate
                    </button>
                    <button
                      style={{ ...S.btn(lotChoiceMap[lot] === "permit" ? "stone" : "outline"), padding: "6px 10px", fontSize: 12 }}
                      onClick={() => canVote && onVote("permit", lot)}
                      disabled={!canVote}
                    >
                      Permit
                    </button>
                    <button
                      style={{ ...S.btn(lotChoiceMap[lot] === "undecided" ? "ghost" : "outline"), padding: "6px 10px", fontSize: 12 }}
                      onClick={() => canVote && onVote("undecided", lot)}
                      disabled={!canVote}
                    >
                      Undecided
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display:"flex", gap:12, marginTop:16, flexWrap:"wrap" }}>
          <button style={{ ...S.btn(userVoted==="eliminate" ? "danger" : "outline"), borderColor: userVoted==="eliminate" ? C.danger : C.forest, color: userVoted==="eliminate" ? C.white : C.forest, background: userVoted==="eliminate" ? C.danger : "transparent", opacity: canVote ? 1 : 0.55 }} onClick={() => canVote && onVote("eliminate")} disabled={!canVote}>
            🚫 {votingLots.length > 1 ? "Apply to all lots: eliminate STRs" : "Eliminate STRs — prohibit rentals under 12 months"}
          </button>
          <button style={{ ...S.btn("outline"), borderColor: userVoted==="permit" ? C.stoneDark : C.border, background: userVoted==="permit" ? C.stone : "transparent", color: userVoted==="permit" ? C.white : C.ink, opacity: canVote ? 1 : 0.55 }} onClick={() => canVote && onVote("permit")} disabled={!canVote}>
            📋 {votingLots.length > 1 ? "Apply to all lots: permit with regulation" : "Permit with regulation — 7-night minimum + rules"}
          </button>
          <button style={{ ...S.btn("ghost"), background: userVoted==="undecided" ? C.parchmentDark : "transparent", border:`1px solid ${C.border}`, opacity: canVote ? 1 : 0.55 }} onClick={() => canVote && onVote("undecided")} disabled={!canVote}>
            ❓ {votingLots.length > 1 ? "Apply to all lots: undecided" : "Undecided — need more information"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RISKS PAGE ───────────────────────────────────────────────────────────────
function RisksPage() {
  const risks = [
    { sev:"Critical", title:"Title insurance and property sales", detail:"Title companies must identify the governing covenants before issuing a policy. When three versions compete with incomplete consent-form records, title companies flag the issue, slow closings, or require additional legal opinions at the seller's expense. One owner reported losing a deal in 2025 because of this problem. Every lot in Falling Waters is harder to sell today than it would be under a unified CC&R.", color:C.danger, bg:C.dangerLight },
    { sev:"Critical", title:"Mortgage financing risk", detail:"Lenders — especially secondary market lenders like Fannie Mae and Freddie Mac — require clear, enforceable HOA governance documents. Multiple conflicting declarations, a disputed 2021 adoption, and a community operating under three different covenant regimes create underwriting red flags that can result in loan denial or higher interest rates for buyers.", color:C.danger, bg:C.dangerLight },
    { sev:"Critical", title:"STR enforcement gap — unequal standards", detail:"Our attorney confirmed that 2014-lot owners have no enforceable STR restriction today. This means some lots can legally operate Airbnb/VRBO while neighboring lots cannot. This inequality breeds exactly the kind of neighbor conflict and resentment that makes governance impossible and erodes community trust.", color:C.danger, bg:C.dangerLight },
    { sev:"High", title:"2021 enforcement challenges", detail:"Any HOA enforcement action taken under the 2021 declaration could be challenged by a non-signer arguing the document doesn't bind them. Fines, liens, and enforcement letters issued under the 2021 covenant may be legally unenforceable against 2008 and 2014 lot owners who didn't sign the consent form. The HOA's enforcement authority is fundamentally compromised.", color:"#9A3412", bg:"#FFEDD5" },
    { sev:"High", title:"Uncapped assessment increases", detail:"The 2021 document removed the 2014 declaration's 10% annual assessment cap without highlighting the change during the consent-form process. Under the 2021 document, the Board has unlimited discretion to raise annual assessments. Owners who signed the 2021 consent form may have unknowingly waived the cap that existed in the 2014 document.", color:"#9A3412", bg:"#FFEDD5" },
    { sev:"High", title:"Covenant expiration in 2040", detail:"The 2014 declaration expires January 1, 2040 — only 14 years away. Lots governed by the 2014 document will have no governing CC&R after that date unless renewed. A community without CC&Rs loses all restrictions on use, construction standards, and HOA authority. Any buyer purchasing a 2014-lot lot should be aware of this expiration.", color:"#9A3412", bg:"#FFEDD5" },
    { sev:"Medium", title:"Wildlife and safety policy gap", detail:"Without a unified, enforceable covenant covering all 200 lots, the Association's ability to enforce consistent safety and nuisance standards is limited. Wildlife-specific restrictions are best treated as a future amendment once one community-wide CC&R is in place.", color:C.amber, bg:C.amberLight },
    { sev:"Medium", title:"Community governance legitimacy", detail:"An HOA board that enforces rules selectively — because it can only clearly enforce them on some lots — loses the trust and respect of the broader community. Governance works when rules are fair, consistent, and known. The current three-covenant situation makes genuine community governance nearly impossible.", color:C.amber, bg:C.amberLight },
  ];
  return (
    <div>
      <div style={S.alert("danger")}><strong>The status quo is not neutral.</strong> Failing to adopt a unified CC&R has real, documented financial and legal consequences for every lot owner in Falling Waters — whether or not you are personally affected by any disputed covenant provision today.</div>
      {risks.map((r,i) => (
        <div key={i} style={{ ...S.card, borderLeft:`4px solid ${r.color}`, background:r.bg }}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
            <span style={S.badge(r.color, "transparent")}>{r.sev} risk</span>
          </div>
          <div style={{ fontFamily:"Georgia,serif", fontSize:16, fontWeight:"bold", color:r.color, margin:"8px 0 6px" }}>{r.title}</div>
          <div style={{ fontSize:13, color:C.ink, lineHeight:1.7 }}>{r.detail}</div>
        </div>
      ))}
    </div>
  );
}

// ── COMMENTS PAGE ────────────────────────────────────────────────────────────
function CommentsPage({ user, comments, onAdd, onUpdate }) {
  const [formTopic, setFormTopic] = useState("str");
  const [formStance, setFormStance] = useState("");
  const [formConcern, setFormConcern] = useState(commentConcernOptionsForTopic("str")[0]);
  const [filterTopic, setFilterTopic] = useState("all");
  const [filterStance, setFilterStance] = useState("");
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState("");
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editTopic, setEditTopic] = useState("general");
  const [editStance, setEditStance] = useState("neutral");
  const [editConcern, setEditConcern] = useState(commentConcernOptionsForTopic("general")[0]);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState("");
  const filtered = comments.filter(c => (filterTopic==="all" || c.topic===filterTopic) && (filterStance==="" || c.stance===filterStance));
  const topicLabels = COMMENT_TOPIC_OPTIONS.reduce((acc, topic) => {
    acc[topic.value] = topic.label;
    return acc;
  }, {});
  const stanceOptions = commentStanceOptionsForTopic(formTopic);
  const concernOptions = commentConcernOptionsForTopic(formTopic);
  const editStanceOptions = commentStanceOptionsForTopic(editTopic);
  const editConcernOptions = commentConcernOptionsForTopic(editTopic);
  const stanceColors = {
    restrict:{ c:C.danger, bg:C.dangerLight, label:"Supports stricter standards" },
    permit:{ c:C.stoneDark, bg:"#FEF3C7", label:"Supports more flexibility" },
    neutral:{ c:C.muted, bg:C.parchmentDark, label:"Neutral / question" },
  };
  const userLots = normalizeUserLots(user).filter((lot) => lot !== "ADMIN");
  const canEditComment = (comment) => {
    if (user?.isAdmin) return true;
    const commentLots = (Array.isArray(comment?.lots) && comment.lots.length > 0 ? comment.lots : [comment?.lot])
      .map((lot) => normalizeLotLabel(lot))
      .filter(Boolean);
    const lotMatch = commentLots.some((lot) => userLots.includes(lot));
    return (
      !!comment?.userId && !!user?.userId && comment.userId === user.userId
    ) || (
      normalizeNameKey(comment?.name) === normalizeNameKey(user?.name)
      && lotMatch
    );
  };
  useEffect(() => {
    setFormConcern((current) => (concernOptions.includes(current) ? current : concernOptions[0]));
  }, [formTopic]);
  useEffect(() => {
    const stanceValues = stanceOptions.map((option) => option.value);
    setFormStance((current) => (current && stanceValues.includes(current) ? current : ""));
  }, [formTopic]);
  useEffect(() => {
    if (!editingCommentId) return;
    setEditConcern((current) => (editConcernOptions.includes(current) ? current : editConcernOptions[0]));
    const stanceValues = editStanceOptions.map((option) => option.value);
    setEditStance((current) => (current && stanceValues.includes(current) ? current : "neutral"));
  }, [editTopic, editingCommentId]);
  const submit = (e) => {
    e.preventDefault();
    if (text.trim().length < 20) return;
    setSubmitting(true);
    setTimeout(() => {
      onAdd({
        id:Date.now(),
        lot:user.lot,
        lots: normalizeUserLots(user),
        userId: user.userId,
        name:user.name,
        ts:todayLabel(),
        topic:formTopic,
        stance: formStance || "neutral",
        concern: formConcern,
        text:text.trim(),
      });
      setText(""); setFormStance(""); setDone("Comment posted. Thank you."); setSubmitting(false);
      setTimeout(() => setDone(""), 4000);
    }, 600);
  };
  const startEdit = (comment) => {
    const nextTopic = COMMENT_TOPIC_OPTIONS.some((topic) => topic.value === comment?.topic) ? comment.topic : "general";
    const nextStanceOptions = commentStanceOptionsForTopic(nextTopic);
    const nextConcernOptions = commentConcernOptionsForTopic(nextTopic);
    setEditingCommentId(comment?.id ?? null);
    setEditTopic(nextTopic);
    setEditStance(nextStanceOptions.some((option) => option.value === comment?.stance) ? comment.stance : "neutral");
    setEditConcern(nextConcernOptions.includes(comment?.concern) ? comment.concern : nextConcernOptions[0]);
    setEditText(String(comment?.text || ""));
    setEditErr("");
    setDone("");
  };
  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditErr("");
  };
  const saveEdit = (comment) => {
    if (!comment || editBusy) return;
    if (editText.trim().length < 20) {
      setEditErr("Comment must be at least 20 characters.");
      return;
    }
    setEditBusy(true);
    setEditErr("");
    setTimeout(() => {
      const result = onUpdate?.(comment.id, {
        topic: editTopic,
        stance: editStance || "neutral",
        concern: editConcern,
        text: editText.trim(),
      });
      if (result?.error) {
        setEditErr(result.error);
        setEditBusy(false);
        return;
      }
      setEditingCommentId(null);
      setEditBusy(false);
      setDone("Comment updated successfully.");
      setTimeout(() => setDone(""), 4000);
    }, 300);
  };
  return (
    <div>
      <div style={S.alert("info")}>
        <strong>Community comments topics include ACC Building Guidelines.</strong> Use the Topic dropdown to post feedback specifically on ACC standards, design rules, and approval process concerns.
      </div>
      <div style={{ ...S.card, marginBottom: 14 }}>
        <div style={S.cardTitle}>Quick topic select</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          Choose the discussion focus before writing your comment.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COMMENT_TOPIC_OPTIONS.map((topic) => (
            <button
              key={topic.value}
              style={{ ...S.btn(formTopic === topic.value ? "stone" : "outline"), padding: "7px 12px" }}
              onClick={() => setFormTopic(topic.value)}
            >
              {topic.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))", gap:20 }}>
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Add your comment</div>
            <p style={{ fontSize:13, color:C.muted, marginBottom:14, lineHeight:1.6 }}>Comments are attributed to your lot number. Be specific — detailed input helps the working group draft a covenant that reflects real community concerns.</p>
            {!!done && <div style={S.alert("success")}>{done}</div>}
            <form onSubmit={submit}>
              <div style={{ marginBottom:12 }}>
                <label style={S.label}>Topic</label>
                <select style={S.select} value={formTopic} onChange={e=>setFormTopic(e.target.value)}>
                  {COMMENT_TOPIC_OPTIONS.map((topic) => (
                    <option key={topic.value} value={topic.value}>{topic.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={S.label}>My position</label>
                <select style={S.select} value={formStance} onChange={e=>setFormStance(e.target.value)}>
                  <option value="">— Select —</option>
                  {stanceOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={S.label}>Primary concern</label>
                <select style={S.select} value={formConcern} onChange={e=>setFormConcern(e.target.value)}>
                  {concernOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={S.label}>Your comment</label>
                <textarea style={S.textarea} placeholder="Share your perspective, concerns, or questions. Min 20 characters." value={text} onChange={e=>setText(e.target.value)}/>
                <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Commenting as {user.name} · {user.lot}</div>
              </div>
              <button type="submit" style={S.btn("primary")} disabled={submitting || text.trim().length < 20}>
                {submitting ? "Posting…" : "Post comment →"}
              </button>
            </form>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Filter comments</div>
            <div style={{ marginBottom:10 }}>
              <label style={S.label}>Topic</label>
              <select style={S.select} value={filterTopic} onChange={e=>setFilterTopic(e.target.value)}>
                <option value="all">All topics</option>
                {COMMENT_TOPIC_OPTIONS.map((topic) => (
                  <option key={topic.value} value={topic.value}>{topic.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={S.label}>Position</label>
              <select style={S.select} value={filterStance} onChange={e=>setFilterStance(e.target.value)}>
                <option value="">All positions</option>
                <option value="restrict">Supports stricter standards</option>
                <option value="permit">Supports more flexibility</option>
                <option value="neutral">Neutral / question</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>{filtered.length} comment{filtered.length !== 1 ? "s" : ""} shown</div>
          {filtered.length === 0 && <div style={{ ...S.card, textAlign:"center", color:C.muted, fontSize:13, padding:32 }}>No comments match your filter. Be the first to comment on this topic.</div>}
          {filtered.map(c => {
            const sc = stanceColors[c.stance] || stanceColors.neutral;
            const isEditing = editingCommentId === c.id;
            const canEdit = canEditComment(c);
            return (
              <div key={c.id} style={{ ...S.card, marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8, alignItems:"flex-start", gap:8, flexWrap:"wrap" }}>
                  <div style={{ minWidth: 180 }}>
                    <span style={{ fontWeight:700, fontSize:13, color:C.forest }}>{c.name}</span>
                    <span style={{ fontSize:12, color:C.muted, marginLeft:8 }}>{c.lot} · {c.ts}</span>
                    {c.editedAt && (
                      <span style={{ fontSize:11, color:C.muted, marginLeft:8 }}>
                        Edited {c.editedAt}
                      </span>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:1, flexWrap:"wrap", justifyContent:"flex-end", marginLeft:"auto", maxWidth:"100%" }}>
                    <span style={{ ...S.badge(sc.c, sc.bg), maxWidth: "100%" }}>{sc.label}</span>
                    <span style={{ ...S.badge(C.muted, C.parchmentDark), maxWidth: "100%" }}>{topicLabels[c.topic] || c.topic}</span>
                    {c.concern && (
                      <span
                        style={{
                          ...S.badge("#4338CA", "#E0E7FF"),
                          maxWidth: "100%",
                          whiteSpace: "normal",
                          textTransform: "none",
                          letterSpacing: "0.02em",
                          lineHeight: 1.3,
                          wordBreak: "break-word",
                        }}
                      >
                        {c.concern}
                      </span>
                    )}
                    {canEdit && !isEditing && (
                      <button
                        type="button"
                        style={{ ...S.btn("outline"), padding: "4px 8px", fontSize: 11 }}
                        onClick={() => startEdit(c)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
                {isEditing ? (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.parchment, padding: 10 }}>
                    {editErr && <div style={S.alert("danger")}>{editErr}</div>}
                    <div style={{ marginBottom: 10 }}>
                      <label style={S.label}>Topic</label>
                      <select style={S.select} value={editTopic} onChange={(event) => setEditTopic(event.target.value)} disabled={editBusy}>
                        {COMMENT_TOPIC_OPTIONS.map((topic) => (
                          <option key={topic.value} value={topic.value}>{topic.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={S.label}>My position</label>
                      <select style={S.select} value={editStance} onChange={(event) => setEditStance(event.target.value)} disabled={editBusy}>
                        {editStanceOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={S.label}>Primary concern</label>
                      <select style={S.select} value={editConcern} onChange={(event) => setEditConcern(event.target.value)} disabled={editBusy}>
                        {editConcernOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <label style={S.label}>Your comment</label>
                      <textarea
                        style={S.textarea}
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
                        disabled={editBusy}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" style={{ ...S.btn("primary"), padding: "6px 10px" }} onClick={() => saveEdit(c)} disabled={editBusy || editText.trim().length < 20}>
                        {editBusy ? "Saving..." : "Save changes"}
                      </button>
                      <button type="button" style={{ ...S.btn("outline"), padding: "6px 10px" }} onClick={cancelEdit} disabled={editBusy}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize:13, color:C.ink, lineHeight:1.7 }}>{c.text}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── PROFILE PAGE ──────────────────────────────────────────────────────────────
function ProfilePage({ user, voteLedger, onUpdateProfile }) {
  const [name, setName] = useState(user.name || "");
  const [lotsInput, setLotsInput] = useState(normalizeUserLots(user).filter((lot) => lot !== "ADMIN").join(", "));
  const [accessRole, setAccessRole] = useState(normalizeAccessRole(user.accessRole));
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const lots = normalizeUserLots(user).filter((lot) => lot !== "ADMIN");

  const save = (e) => {
    e.preventDefault();
    const parsedLots = parseLotsInput(lotsInput).filter((lot) => lot !== "ADMIN");
    if (parsedLots.length === 0) {
      setErr("Please include at least one valid lot number.");
      setMsg("");
      return;
    }
    if (!name.trim()) {
      setErr("Please include your name.");
      setMsg("");
      return;
    }
    const updateError = onUpdateProfile({ name: name.trim(), lots: parsedLots, accessRole });
    if (updateError) {
      setErr(updateError);
      setMsg("");
      return;
    }
    setErr("");
    setMsg(
      normalizeAccessRole(accessRole) === ACCESS_ROLES.commentOnly
        ? "Profile saved. This account is comment-only and cannot cast official votes."
        : `Profile saved. Voting rights are now tied to ${parsedLots.length} lot${parsedLots.length === 1 ? "" : "s"}.`
    );
  };

  return (
    <div>
      <div style={S.alert("info")}>
        Keep your profile current. Primary-voter accounts can cast one vote per non-combined lot; comment-only accounts can participate in discussion without casting official votes.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Resident profile</div>
          {err && <div style={S.alert("danger")}>{err}</div>}
          {msg && <div style={S.alert("success")}>{msg}</div>}
          <form onSubmit={save}>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Name</label>
              <input
                style={S.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoCapitalize="words"
                autoCorrect="on"
                enterKeyHint="next"
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Lot numbers</label>
              <input
                style={S.input}
                value={lotsInput}
                onChange={(e) => setLotsInput(e.target.value)}
                placeholder="e.g. Lot 36, Lot 37"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="text"
              />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                Separate multiple lots with commas. Example: Lot 36, Lot 37.
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Access role</label>
              <select style={S.select} value={accessRole} onChange={(e) => setAccessRole(e.target.value)}>
                <option value={ACCESS_ROLES.primary}>Primary voter (official lot voting)</option>
                <option value={ACCESS_ROLES.commentOnly}>Comment-only household member</option>
              </select>
            </div>
            <button type="submit" style={S.btn("primary")}>Save profile</button>
          </form>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Current lot voting status</div>
          {lots.length === 0 && <div style={{ fontSize: 12, color: C.muted }}>No lots assigned.</div>}
          {lots.map((lot) => {
            const currentChoice = voteLedger[lot] || store.get(`vote_${lot}`) || null;
            return (
              <div key={lot} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, color: C.forest, fontSize: 13 }}>{lot}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Vote: {choiceLabel(currentChoice)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ADMIN VOTING PAGE ────────────────────────────────────────────────────────
function AdminVotingPage({
  comments,
  ownerActivity,
  voteLedger,
  primaryVoterRegistry,
  primaryVoterTransferAudit,
  outreachState,
  eligibilityState,
  userDirectory,
  adminAccessEntries,
  adminAccessGrades,
  totalLots,
  votesNeeded,
  isMobile,
  lastBackupExportAt,
  backupHealthThresholdDays,
  dbApiBaseUrl,
  lastDbSyncAt,
  onImportCsv,
  onExportBackup,
  onRestoreBackup,
  onRecordBackupExport,
  onUpdateBackupHealthThresholdDays,
  onUpdateDbApiBaseUrl,
  onTestDbConnection,
  onSyncToDb,
  onRestoreFromDb,
  onFetchDbSummary,
  onFetchDbRecords,
  onRunDbChecklist,
  onUpdateEligibility,
  onUpdateTotalLots,
  onSetAdminAccessGrade,
  onGrantAdminAccess,
  onRevokeAdminAccess,
  onTransferPrimaryVoter,
}) {
  const [filter, setFilter] = useState("all");
  const [lotQuery, setLotQuery] = useState("");
  const [lotCountInput, setLotCountInput] = useState(String(totalLots));
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importErr, setImportErr] = useState("");
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [backupErr, setBackupErr] = useState("");
  const [bundleBusy, setBundleBusy] = useState(false);
  const [restoreMode, setRestoreMode] = useState("replace");
  const [restoreScopes, setRestoreScopes] = useState(() => defaultBackupRestoreScopes());
  const [gradeMsg, setGradeMsg] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminGrade, setNewAdminGrade] = useState(DEFAULT_ADMIN_GRADE);
  const [gradeErr, setGradeErr] = useState("");
  const [backupThresholdInput, setBackupThresholdInput] = useState(String(backupHealthThresholdDays));
  const [backupThresholdMsg, setBackupThresholdMsg] = useState("");
  const [backupThresholdErr, setBackupThresholdErr] = useState("");
  const [dbApiInput, setDbApiInput] = useState(String(dbApiBaseUrl || ""));
  const [dbBusy, setDbBusy] = useState(false);
  const [dbMsg, setDbMsg] = useState("");
  const [dbErr, setDbErr] = useState("");
  const [dbSummary, setDbSummary] = useState(null);
  const [dbRecordsTable, setDbRecordsTable] = useState("state_values");
  const [dbRecords, setDbRecords] = useState([]);
  const [dbChecklist, setDbChecklist] = useState(null);
  const [transferLot, setTransferLot] = useState("");
  const [transferPrimaryName, setTransferPrimaryName] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferMsg, setTransferMsg] = useState("");
  const [transferErr, setTransferErr] = useState("");
  const effectiveBackupHealthThresholdDays =
    Number.isInteger(Number(backupHealthThresholdDays)) &&
    Number(backupHealthThresholdDays) >= MIN_BACKUP_HEALTH_MAX_AGE_DAYS &&
    Number(backupHealthThresholdDays) <= MAX_BACKUP_HEALTH_MAX_AGE_DAYS
      ? Number(backupHealthThresholdDays)
      : DEFAULT_BACKUP_HEALTH_MAX_AGE_DAYS;
  const parsedLastBackupAt = lastBackupExportAt ? new Date(lastBackupExportAt) : null;
  const backupTimestampMs = parsedLastBackupAt && !Number.isNaN(parsedLastBackupAt.getTime()) ? parsedLastBackupAt.getTime() : null;
  const backupAgeDays = backupTimestampMs === null ? null : Math.floor((Date.now() - backupTimestampMs) / (1000 * 60 * 60 * 24));
  const backupHealthLevel = backupTimestampMs === null ? "missing" : backupAgeDays > effectiveBackupHealthThresholdDays ? "stale" : "healthy";
  const backupHealthText =
    backupHealthLevel === "healthy"
      ? `Last full backup export: ${parsedLastBackupAt.toLocaleString()} (${backupAgeDays} day${backupAgeDays === 1 ? "" : "s"} ago).`
      : backupHealthLevel === "stale"
        ? `Last full backup export is stale: ${parsedLastBackupAt.toLocaleString()} (${backupAgeDays} days ago).`
        : "No recorded full backup export yet.";
  const backupHealthGuidance =
    backupHealthLevel === "healthy"
      ? "Backup cadence is healthy."
      : `Recommendation: export a full backup at least every ${effectiveBackupHealthThresholdDays} days and after each admin session.`;
  const lotLabels = buildLotLabels(totalLots);
  const directoryRows = Object.values(userDirectory || {})
    .sort((a, b) => {
      if (!!a.isAdmin !== !!b.isAdmin) return a.isAdmin ? -1 : 1;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  const adminDirectoryRows = directoryRows.filter((row) => row.isAdmin);
  const approvedAdminRows = normalizeAdminAccessEntries(adminAccessEntries).map((entry) => {
    const nameKey = normalizeNameKey(entry);
    const gradeRecord = adminAccessGrades?.[nameKey] || {};
    const grade = normalizeAdminGrade(gradeRecord.grade || DEFAULT_ADMIN_GRADE);
    return {
      name: entry,
      nameKey,
      grade,
      gradeUpdatedAt: gradeRecord.updatedAt || "",
    };
  });

  useEffect(() => {
    setLotCountInput(String(totalLots));
  }, [totalLots]);
  useEffect(() => {
    setBackupThresholdInput(String(effectiveBackupHealthThresholdDays));
  }, [effectiveBackupHealthThresholdDays]);
  useEffect(() => {
    setDbApiInput(String(dbApiBaseUrl || ""));
  }, [dbApiBaseUrl]);
  useEffect(() => {
    if (!lotLabels.includes(transferLot)) {
      setTransferLot(lotLabels[0] || "");
    }
  }, [lotLabels, transferLot]);

  const checklistRows = dbChecklist?.rows || [
    { key: "api", label: "API reachable", status: "unknown", detail: "Run checklist to verify API endpoint response." },
    { key: "browser", label: "Browser/CORS access", status: "unknown", detail: "Run checklist from this browser session." },
    { key: "schema", label: "DB schema ready", status: "unknown", detail: "Run checklist to verify schema + summary query." },
    {
      key: "lastSync",
      label: "Last DB sync",
      status: lastDbSyncAt ? "pass" : "warn",
      detail: lastDbSyncAt
        ? `Last successful sync: ${formatIsoDateTime(lastDbSyncAt)}`
        : "No successful sync recorded yet.",
    },
  ];
  const checklistCheckedAt = dbChecklist?.checkedAt ? formatIsoDateTime(dbChecklist.checkedAt) : "";

  const lotRows = lotLabels.map((lotLabel) => {
    const activity = ownerActivity[lotLabel] || null;
    const outreach = outreachState?.[lotLabel] || null;
    const eligibility = eligibilityState?.[lotLabel] || null;
    const choice = voteLedger[lotLabel] || store.get(`vote_${lotLabel}`) || null;
    const hasVoted = !!choice;
    const voteEligible = eligibility?.eligible === false ? false : true;
    return {
      lot: lotLabel,
      lotNum: lotNumberFromLabel(lotLabel),
      ownerName: activity?.name || "",
      primaryVoter: primaryVoterRegistry?.[lotLabel]?.name || "",
      hasVoted,
      choice,
      status: hasVoted ? (voteEligible ? "Voted" : "Voted - non-eligible") : activity ? "Registered - not voted" : "Not engaged",
      voteEligible,
      ineligibleReason: voteEligible ? "" : String(eligibility?.reason || "").trim(),
      eligibilityUpdatedAt: eligibility?.updatedAt || "",
      commented: !!activity?.commented,
      lastActive: activity?.lastActive || "",
      contacted: !!outreach?.contacted,
      outreachNotes: outreach?.notes || "",
      lastContact: outreach?.lastContact || "",
    };
  });

  const votedRows = lotRows.filter((row) => row.hasVoted);
  const eligibleVotedRows = lotRows.filter((row) => row.voteEligible && row.hasVoted);
  const ineligibleRows = lotRows.filter((row) => !row.voteEligible);
  const ineligibleVotedRows = lotRows.filter((row) => !row.voteEligible && row.hasVoted);
  const eligibleEliminateVotes = eligibleVotedRows.filter((row) => row.choice === "eliminate").length;
  const eligiblePermitVotes = eligibleVotedRows.filter((row) => row.choice === "permit").length;
  const eligibleUndecidedVotes = lotRows.filter((row) => row.voteEligible && !row.hasVoted).length;
  const notVotedRows = lotRows.filter((row) => !row.hasVoted);
  const filteredByStatus =
    filter === "voted"
      ? votedRows
      : filter === "not-voted"
        ? notVotedRows
        : filter === "ineligible"
          ? ineligibleRows
        : lotRows;
  const normalizedLotQuery = String(lotQuery || "").trim().toLowerCase();
  const filteredRows = normalizedLotQuery
    ? filteredByStatus.filter((row) => {
      const lotLabel = String(row.lot || "").toLowerCase();
      const lotNum = String(row.lotNum || "");
      return lotLabel.includes(normalizedLotQuery) || lotNum.includes(normalizedLotQuery);
    })
    : filteredByStatus;
  const sortedFilteredRows = [...filteredRows].sort((a, b) => (a.lotNum || 9999) - (b.lotNum || 9999));
  const transferAuditRows = normalizePrimaryVoterTransferAuditEntries(primaryVoterTransferAudit);

  const exportCsv = () => {
    const headers = [
      "Lot",
      "Status",
      "Vote Choice",
      "Vote Eligible",
      "Ineligible Reason",
      "Eligibility Last Updated",
      "Primary Voter",
      "Owner Name (if known)",
      "Commented",
      "Last Active",
      "Contacted",
      "Outreach Notes",
      "Last Contact Date",
    ];
    const lines = [
      headers.join(","),
      ...lotRows.map((row) =>
        [
          row.lot,
          row.status,
          choiceLabel(row.choice),
          row.voteEligible ? "Yes" : "No",
          row.ineligibleReason || "",
          row.eligibilityUpdatedAt || "",
          row.primaryVoter || "",
          row.ownerName || "",
          row.commented ? "Yes" : "No",
          row.lastActive || "",
          row.contacted ? "Yes" : "No",
          row.outreachNotes || "",
          row.lastContact || "",
        ]
          .map((val) => `"${String(val).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fw-voting-roster-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadCsvFile = (fileName, headers, rows) => {
    const lines = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((val) => `"${String(val ?? "").replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportCsvBundle = async () => {
    setBackupErr("");
    setBackupMsg("");
    setBundleBusy(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const lotRowsSorted = [...lotRows].sort((a, b) => (a.lotNum || 9999) - (b.lotNum || 9999));
      const storedCovenantDocs = store.get("fw_covenant_docs");
      const covenantDocCount = Array.isArray(storedCovenantDocs) ? storedCovenantDocs.length : 0;

      const storageKeys = [];
      if (typeof localStorage !== "undefined") {
        for (let idx = 0; idx < localStorage.length; idx += 1) {
          const key = localStorage.key(idx);
          if (key && (key.startsWith("fw_") || key.startsWith("vote_"))) {
            storageKeys.push(key);
          }
        }
      }
      storageKeys.sort((a, b) => a.localeCompare(b));

      const covenantAssetRecords = await listCovenantAssetRecords().catch(() => []);
      const allRows = [];
      const lotNameMap = new Map();
      const addLotName = (lot, name) => {
        const normalizedLot = normalizeLotLabel(lot);
        const safeName = String(name || "").trim();
        if (!normalizedLot || !safeName || normalizedLot === "ADMIN") return;
        if (!lotNameMap.has(normalizedLot)) {
          lotNameMap.set(normalizedLot, new Set());
        }
        lotNameMap.get(normalizedLot).add(safeName);
      };
      lotRowsSorted.forEach((row) => {
        addLotName(row.lot, row.ownerName);
        addLotName(row.lot, row.primaryVoter);
      });
      directoryRows.forEach((row) => {
        if (!row || row.isAdmin || !Array.isArray(row.lots)) return;
        row.lots.forEach((lot) => addLotName(lot, row.name));
      });

      const appendField = (section, rowId, field, value) => {
        let printable = "";
        let valueType = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
        if (value === undefined) {
          printable = "";
          valueType = "undefined";
        } else if (typeof value === "string") {
          printable = value;
        } else {
          try {
            printable = JSON.stringify(value);
          } catch {
            printable = String(value);
          }
        }
        allRows.push([section, rowId, field, valueType, printable]);
      };
      const appendObject = (section, rowId, obj) => {
        const safeObj = obj && typeof obj === "object" ? obj : {};
        Object.entries(safeObj).forEach(([field, value]) => appendField(section, rowId, field, value));
      };

      lotRowsSorted.forEach((row) => {
        const associatedNames = Array.from(lotNameMap.get(row.lot) || []);
        const bestAvailableName = row.ownerName || row.primaryVoter || associatedNames[0] || "";
        appendObject("votes", row.lot, {
          lot: row.lot,
          vote_choice: row.choice || null,
          vote_choice_label: choiceLabel(row.choice),
          has_voted: row.hasVoted,
          status: row.status,
          owner_name: row.ownerName || "",
          primary_voter: row.primaryVoter || "",
          associated_names: associatedNames,
          best_available_name: bestAvailableName,
        });
        appendObject("eligibility", row.lot, {
          vote_eligible: row.voteEligible,
          ineligible_reason: row.ineligibleReason || "",
          eligibility_updated_at: row.eligibilityUpdatedAt || "",
          best_available_name: bestAvailableName,
        });
        appendObject("outreach", row.lot, {
          contacted: row.contacted,
          outreach_notes: row.outreachNotes || "",
          last_contact: row.lastContact || "",
          owner_name: row.ownerName || "",
          primary_voter: row.primaryVoter || "",
          associated_names: associatedNames,
          best_available_name: bestAvailableName,
        });
      });

      lotRowsSorted.forEach((row) => {
        const associatedNames = Array.from(lotNameMap.get(row.lot) || []);
        appendObject("lot_name_directory", row.lot, {
          lot: row.lot,
          owner_name: row.ownerName || "",
          primary_voter: row.primaryVoter || "",
          directory_names: associatedNames,
          best_available_name: row.ownerName || row.primaryVoter || associatedNames[0] || "",
        });
      });

      (Array.isArray(comments) ? comments : []).forEach((comment, idx) => {
        appendObject("comments", `comment_${idx + 1}`, {
          ts: comment?.ts || "",
          name: comment?.name || "",
          lot: comment?.lot || "",
          lots: Array.isArray(comment?.lots) ? comment.lots : [],
          topic: comment?.topic || "",
          stance: comment?.stance || "",
          text: comment?.text || "",
        });
      });

      approvedAdminRows.forEach((row) => {
        appendObject("admin_access", row.nameKey || row.name, {
          approved_admin: row.name,
          admin_grade: row.grade,
          admin_grade_label: adminGradeLabel(row.grade),
          grade_updated_at: row.gradeUpdatedAt || "",
        });
      });

      transferAuditRows.forEach((entry) => {
        appendObject("primary_voter_transfers", entry.id || `${entry.lot}_${entry.tsIso}`, {
          lot: entry.lot,
          from_name: entry.fromName || "",
          to_name: entry.toName || "",
          audit_note: entry.note || "",
          changed_by: entry.byName || "",
          changed_at_iso: entry.tsIso || "",
          changed_at_label: entry.tsLabel || "",
        });
      });

      directoryRows.forEach((row, idx) => {
        const rowKey = row.userId || `user_${idx + 1}`;
        appendObject("user_directory", rowKey, {
          name: row.name || "",
          is_admin: !!row.isAdmin,
          admin_grade: row.isAdmin ? adminGradeLabel(adminAccessGrades?.[normalizeNameKey(row.name)]?.grade || DEFAULT_ADMIN_GRADE) : "",
          access_role: row.isAdmin ? "Admin control" : accessRoleLabel(row.accessRole),
          lots: Array.isArray(row.lots) ? row.lots : [],
          last_seen: row.lastSeen || "",
        });
      });

      storageKeys.forEach((key) => {
        const rawValue = typeof localStorage !== "undefined" ? String(localStorage.getItem(key) ?? "") : "";
        let parsedValue = "";
        try {
          parsedValue = JSON.stringify(JSON.parse(rawValue));
        } catch {
          parsedValue = "";
        }
        appendObject("raw_storage", key, {
          key,
          key_type: key.startsWith("fw_") ? "portal" : "lot-vote",
          parsed_json_value: parsedValue,
          raw_storage_value: rawValue,
        });
      });

      covenantAssetRecords.forEach((record) => {
        appendObject("covenant_file_blobs", record.id || "", {
          asset_id: record.id || "",
          file_name: record.fileName || "",
          file_type: record.fileType || "",
          updated_at_ms: Number(record.updatedAt) || "",
          blob_data_url: record.blobDataUrl || "",
        });
      });

      const stateSnapshot = {
        fw_user: store.get("fw_user"),
        fw_votes: store.get("fw_votes"),
        fw_comments: store.get("fw_comments"),
        fw_comments_data_version: store.get("fw_comments_data_version"),
        fw_covenant_docs: store.get("fw_covenant_docs"),
        fw_owner_activity: store.get("fw_owner_activity"),
        fw_vote_ledger: store.get("fw_vote_ledger"),
        fw_primary_voter_registry: store.get("fw_primary_voter_registry"),
        fw_outreach_state: store.get("fw_outreach_state"),
        fw_user_directory: store.get("fw_user_directory"),
        fw_admin_access_entries: store.get("fw_admin_access_entries"),
        fw_admin_access_grades: store.get("fw_admin_access_grades"),
        fw_total_lots: store.get("fw_total_lots"),
        fw_vote_eligibility: store.get("fw_vote_eligibility"),
      };
      Object.entries(stateSnapshot).forEach(([key, value]) => {
        appendField("portal_state_snapshot", key, "json_value", value);
      });

      appendObject("manifest", "summary", {
        exported_at: nowIso,
        total_lots: totalLots,
        votes_needed: votesNeeded,
        vote_records: Object.keys(voteLedger || {}).length,
        comments_count: (Array.isArray(comments) ? comments : []).length,
        owner_activity_records: Object.keys(ownerActivity || {}).length,
        outreach_records: Object.keys(outreachState || {}).length,
        eligibility_records: Object.keys(eligibilityState || {}).length,
        primary_voter_records: Object.keys(primaryVoterRegistry || {}).length,
        primary_voter_transfer_audit_records: transferAuditRows.length,
        admin_access_entries: (Array.isArray(adminAccessEntries) ? adminAccessEntries : []).length,
        user_directory_records: Object.keys(userDirectory || {}).length,
        covenant_docs: covenantDocCount,
        raw_storage_keys_exported: storageKeys.length,
        covenant_blob_records_exported: covenantAssetRecords.length,
      });

      downloadCsvFile(
        `fw-full-data-export-${stamp}.csv`,
        ["Section", "Row Id", "Field", "Value Type", "Value"],
        allRows
      );

      onRecordBackupExport?.(nowIso);
      setBackupMsg("Full CSV export downloaded as a single file with all sections.");
    } catch (err) {
      setBackupErr(err?.message || "Could not export CSV bundle.");
    } finally {
      setBundleBusy(false);
    }
  };

  const toggleLotEligibility = (row) => {
    if (row.voteEligible) {
      onUpdateEligibility(row.lot, { eligible: false, reason: row.ineligibleReason || "Dues unpaid" });
    } else {
      onUpdateEligibility(row.lot, { eligible: true, reason: "" });
    }
  };

  const saveLotCount = () => {
    const parsed = Number.parseInt(String(lotCountInput || "").trim(), 10);
    if (Number.isNaN(parsed) || parsed < MIN_TOTAL_LOTS || parsed > MAX_TOTAL_LOTS) {
      setImportErr(`Total lots must be a number between ${MIN_TOTAL_LOTS} and ${MAX_TOTAL_LOTS}.`);
      return;
    }
    setImportErr("");
    setImportMsg("");
    onUpdateTotalLots(parsed);
  };

  const updateAdminGrade = (name, grade) => {
    setGradeErr("");
    const result = onSetAdminAccessGrade?.(name, grade);
    if (result?.error) {
      setGradeErr(result.error);
      return;
    }
    setGradeMsg(result?.message || `Updated admin grade for ${name}.`);
    setTimeout(() => setGradeMsg(""), 3500);
  };

  const grantAdminAccess = () => {
    setGradeErr("");
    const result = onGrantAdminAccess?.(newAdminName, newAdminGrade);
    if (result?.error) {
      setGradeErr(result.error);
      return;
    }
    setGradeMsg(result?.message || "Admin access granted.");
    setNewAdminName("");
    setNewAdminGrade(DEFAULT_ADMIN_GRADE);
    setTimeout(() => setGradeMsg(""), 3500);
  };

  const revokeAdminAccess = (name) => {
    setGradeErr("");
    const result = onRevokeAdminAccess?.(name);
    if (result?.error) {
      setGradeErr(result.error);
      return;
    }
    setGradeMsg(result?.message || `Admin access removed for ${name}.`);
    setTimeout(() => setGradeMsg(""), 3500);
  };

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImportErr("");
    setImportMsg("");
    setImporting(true);
    try {
      const csvText = await readFileAsText(file);
      const rows = parseCsvText(csvText);
      if (rows.length === 0) {
        setImportErr("CSV appears empty or missing data rows.");
        return;
      }
      const result = onImportCsv(rows);
      if (result?.error) {
        setImportErr(result.error);
      } else {
        setImportMsg(result?.message || `Imported ${rows.length} CSV rows.`);
      }
    } catch (err) {
      setImportErr(err?.message || "Could not import CSV file.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  const handleBackupExport = async () => {
    setBackupErr("");
    setBackupMsg("");
    setBackupBusy(true);
    try {
      const result = await onExportBackup?.();
      if (result?.error) {
        setBackupErr(result.error);
      } else {
        onRecordBackupExport?.(new Date().toISOString());
        setBackupMsg(result?.message || "Backup exported.");
      }
    } catch (err) {
      setBackupErr(err?.message || "Could not export backup JSON.");
    } finally {
      setBackupBusy(false);
    }
  };

  const handleBackupRestore = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const normalizedScopes = normalizeRestoreScopes(restoreScopes);
    if (!hasSelectedRestoreScope(normalizedScopes)) {
      setBackupErr("Select at least one data scope before restoring.");
      event.target.value = "";
      return;
    }
    setBackupErr("");
    setBackupMsg("");
    setBackupBusy(true);
    try {
      const rawText = await readFileAsText(file);
      const parsed = JSON.parse(rawText);
      const result = await onRestoreBackup?.(parsed, { mode: restoreMode, scopes: normalizedScopes });
      if (result?.error) {
        setBackupErr(result.error);
      } else {
        setBackupMsg(result?.message || "Backup restored.");
      }
    } catch (err) {
      setBackupErr(err?.message || "Could not restore backup JSON.");
    } finally {
      setBackupBusy(false);
      event.target.value = "";
    }
  };

  const setAllRestoreScopes = (value) => {
    const next = {};
    BACKUP_RESTORE_SCOPE_OPTIONS.forEach((scope) => {
      next[scope.key] = value;
    });
    setRestoreScopes(next);
  };

  const toggleRestoreScope = (scopeKey) => {
    setRestoreScopes((prev) => ({
      ...normalizeRestoreScopes(prev),
      [scopeKey]: !(normalizeRestoreScopes(prev)[scopeKey] !== false),
    }));
  };

  const saveBackupHealthThreshold = (valueOverride = null) => {
    setBackupThresholdErr("");
    setBackupThresholdMsg("");
    const candidate = valueOverride === null ? backupThresholdInput : valueOverride;
    const parsed = Number.parseInt(String(candidate || "").trim(), 10);
    if (
      Number.isNaN(parsed)
      || parsed < MIN_BACKUP_HEALTH_MAX_AGE_DAYS
      || parsed > MAX_BACKUP_HEALTH_MAX_AGE_DAYS
    ) {
      setBackupThresholdErr(
        `Backup threshold must be between ${MIN_BACKUP_HEALTH_MAX_AGE_DAYS} and ${MAX_BACKUP_HEALTH_MAX_AGE_DAYS} days.`
      );
      return;
    }
    setBackupThresholdInput(String(parsed));
    const result = onUpdateBackupHealthThresholdDays?.(parsed);
    if (result?.error) {
      setBackupThresholdErr(result.error);
      return;
    }
    setBackupThresholdMsg(result?.message || `Backup health threshold set to ${parsed} days.`);
    setTimeout(() => setBackupThresholdMsg(""), 3500);
  };

  const saveDbApiUrl = () => {
    setDbErr("");
    setDbMsg("");
    const result = onUpdateDbApiBaseUrl?.(dbApiInput);
    if (result?.error) {
      setDbErr(result.error);
      return;
    }
    const safeUrl = String(result?.value || "").trim();
    setDbApiInput(safeUrl);
    setDbMsg(
      safeUrl
        ? `Database API URL saved: ${safeUrl}`
        : "Database API URL cleared (will use same-origin /api routes)."
    );
    setTimeout(() => setDbMsg(""), 3500);
  };

  const testDbConnection = async () => {
    setDbErr("");
    setDbMsg("");
    setDbBusy(true);
    try {
      const result = await onTestDbConnection?.();
      if (result?.error) {
        setDbErr(result.error);
      } else {
        setDbMsg(result?.message || "PostgreSQL API connection is healthy.");
      }
    } catch (err) {
      setDbErr(err?.message || "Could not reach PostgreSQL API.");
    } finally {
      setDbBusy(false);
    }
  };

  const runDbChecklist = async () => {
    setDbErr("");
    setDbMsg("");
    setDbBusy(true);
    try {
      const result = await onRunDbChecklist?.();
      if (result?.error) {
        setDbErr(result.error);
        return;
      }
      if (result?.checklist) {
        setDbChecklist(result.checklist);
      }
      setDbMsg(result?.message || "Database connection checklist completed.");
    } catch (err) {
      setDbErr(err?.message || "Could not complete database checklist.");
    } finally {
      setDbBusy(false);
    }
  };

  const syncPortalToDb = async () => {
    setDbErr("");
    setDbMsg("");
    setDbBusy(true);
    try {
      const normalizedScopes = normalizeRestoreScopes(restoreScopes);
      const result = await onSyncToDb?.({ mode: restoreMode, scopes: normalizedScopes });
      if (result?.error) {
        setDbErr(result.error);
      } else {
        setDbMsg(result?.message || "Portal data synced to PostgreSQL.");
      }
    } catch (err) {
      setDbErr(err?.message || "Could not sync portal data to PostgreSQL.");
    } finally {
      setDbBusy(false);
    }
  };

  const restoreFromDb = async () => {
    setDbErr("");
    setDbMsg("");
    setDbBusy(true);
    try {
      const normalizedScopes = normalizeRestoreScopes(restoreScopes);
      const result = await onRestoreFromDb?.({ mode: restoreMode, scopes: normalizedScopes });
      if (result?.error) {
        setDbErr(result.error);
      } else {
        setDbMsg(result?.message || "Portal restored from PostgreSQL.");
      }
    } catch (err) {
      setDbErr(err?.message || "Could not restore data from PostgreSQL.");
    } finally {
      setDbBusy(false);
    }
  };

  const loadDbSummary = async () => {
    setDbErr("");
    setDbBusy(true);
    try {
      const result = await onFetchDbSummary?.();
      if (result?.error) {
        setDbErr(result.error);
        return;
      }
      setDbSummary(result?.summary || null);
      setDbMsg("Database summary loaded.");
    } catch (err) {
      setDbErr(err?.message || "Could not load database summary.");
    } finally {
      setDbBusy(false);
    }
  };

  const loadDbRecords = async () => {
    setDbErr("");
    setDbBusy(true);
    try {
      const result = await onFetchDbRecords?.(dbRecordsTable, 200, 0);
      if (result?.error) {
        setDbErr(result.error);
        return;
      }
      setDbRecords(Array.isArray(result?.records) ? result.records : []);
      setDbMsg(`Loaded ${Array.isArray(result?.records) ? result.records.length : 0} record(s) from "${dbRecordsTable}".`);
    } catch (err) {
      setDbErr(err?.message || "Could not load database records.");
    } finally {
      setDbBusy(false);
    }
  };

  const submitPrimaryVoterTransfer = () => {
    setTransferErr("");
    setTransferMsg("");
    const safeLot = normalizeLotLabel(transferLot);
    const safeName = String(transferPrimaryName || "").trim();
    const safeNote = String(transferNote || "").trim();
    if (!safeLot || !lotLabels.includes(safeLot)) {
      setTransferErr("Select a valid lot for primary voter transfer.");
      return;
    }
    if (!safeName) {
      setTransferErr("Enter the new primary voter full name.");
      return;
    }
    if (safeNote.length < 10) {
      setTransferErr("Audit note must be at least 10 characters.");
      return;
    }
    const result = onTransferPrimaryVoter?.({
      lot: safeLot,
      toName: safeName,
      note: safeNote,
    });
    if (result?.error) {
      setTransferErr(result.error);
      return;
    }
    setTransferPrimaryName("");
    setTransferNote("");
    setTransferMsg(result?.message || "Primary voter transfer recorded.");
    setTimeout(() => setTransferMsg(""), 4500);
  };

  return (
    <div>
      <div style={S.alert("info")}>
        Admin visibility: this roster tracks lot-level participation, voting, outreach, and vote eligibility. Mark lots as non-eligible (for dues delinquency or other reasons) to flag ballots that should not count toward official totals.
      </div>
      <div style={S.alert(backupHealthLevel === "healthy" ? "success" : backupHealthLevel === "stale" ? "warn" : "danger")}>
        <strong>Backup health:</strong> {backupHealthText} {backupHealthGuidance}
      </div>
      <div style={S.card}>
        <div style={S.cardTitle}>Backup health policy</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
          Set how many days can pass before backup health is marked stale.
        </div>
        {backupThresholdErr && <div style={S.alert("danger")}>{backupThresholdErr}</div>}
        {backupThresholdMsg && <div style={S.alert("success")}>{backupThresholdMsg}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <input
            style={{ ...S.input, maxWidth: 180 }}
            type="number"
            min={MIN_BACKUP_HEALTH_MAX_AGE_DAYS}
            max={MAX_BACKUP_HEALTH_MAX_AGE_DAYS}
            value={backupThresholdInput}
            onChange={(event) => setBackupThresholdInput(event.target.value)}
            inputMode="numeric"
          />
          <button style={{ ...S.btn("stone"), padding: "7px 12px" }} onClick={() => saveBackupHealthThreshold(null)}>
            Save threshold
          </button>
          {[3, 7, 14].map((days) => (
            <button
              key={days}
              style={{ ...S.btn(effectiveBackupHealthThresholdDays === days ? "primary" : "outline"), padding: "7px 12px" }}
              onClick={() => saveBackupHealthThreshold(days)}
            >
              {days} days
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>
          Current stale threshold: <strong>{effectiveBackupHealthThresholdDays} days</strong>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Lot-owner universe settings</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
          Set how many lots are included in official participation and vote math. The 2/3 threshold updates automatically.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...S.input, maxWidth: 180 }}
            type="number"
            min={MIN_TOTAL_LOTS}
            max={MAX_TOTAL_LOTS}
            value={lotCountInput}
            onChange={(event) => setLotCountInput(event.target.value)}
            inputMode="numeric"
          />
          <button style={{ ...S.btn("stone"), padding: "7px 12px" }} onClick={saveLotCount}>Save lot count</button>
          <span style={{ fontSize: 12, color: C.muted }}>
            Current threshold: <strong>{votesNeeded}</strong> yes votes needed
          </span>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Admin access roster</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
          These names are currently approved for admin access in this portal. Assign an access grade for governance and internal control tracking.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, alignItems: "end", marginBottom: 10 }}>
          <div>
            <label style={S.label}>Grant admin rights (name)</label>
            <input
              style={S.input}
              value={newAdminName}
              onChange={(event) => setNewAdminName(event.target.value)}
              placeholder="Full name"
              autoCapitalize="words"
              autoCorrect="on"
            />
          </div>
          <div>
            <label style={S.label}>Admin grade</label>
            <select
              style={S.select}
              value={newAdminGrade}
              onChange={(event) => setNewAdminGrade(event.target.value)}
            >
              {ADMIN_GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <button style={{ ...S.btn("primary"), padding: "8px 12px" }} onClick={grantAdminAccess}>
            Grant admin rights
          </button>
        </div>
        {gradeMsg && <div style={S.alert("success")}>{gradeMsg}</div>}
        {gradeErr && <div style={S.alert("danger")}>{gradeErr}</div>}
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Approved admin</th>
                <th style={S.th}>Access grade</th>
                <th style={S.th}>Last updated</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvedAdminRows.length === 0 && (
                <tr>
                  <td style={S.td} colSpan={4}>No admin names configured.</td>
                </tr>
              )}
              {approvedAdminRows.map((row) => (
                <tr key={row.nameKey}>
                  <td style={{ ...S.td, fontWeight: 700, color: C.forest }}>{row.name}</td>
                  <td style={S.td}>
                    <select
                      style={{ ...S.select, minWidth: 180, padding: "6px 8px" }}
                      value={row.grade}
                      onChange={(event) => updateAdminGrade(row.name, event.target.value)}
                    >
                      {ADMIN_GRADE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td style={S.td}>{row.gradeUpdatedAt || "—"}</td>
                  <td style={S.td}>
                    <button
                      style={{ ...S.btn("outline"), padding: "5px 8px", fontSize: 11 }}
                      onClick={() => revokeAdminAccess(row.name)}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Primary voter transfer (admin only)</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
          Reassign official voting authority for a lot when ownership or household primary contact changes. An audit note is required and stored.
        </div>
        {transferErr && <div style={S.alert("danger")}>{transferErr}</div>}
        {transferMsg && <div style={S.alert("success")}>{transferMsg}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 8, marginBottom: 10 }}>
          <div>
            <label style={S.label}>Lot</label>
            <select style={S.select} value={transferLot} onChange={(event) => setTransferLot(event.target.value)}>
              {lotLabels.map((lotLabel) => (
                <option key={lotLabel} value={lotLabel}>{lotLabel}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={S.label}>New primary voter name</label>
            <input
              style={S.input}
              value={transferPrimaryName}
              onChange={(event) => setTransferPrimaryName(event.target.value)}
              placeholder="Full legal name"
              autoCapitalize="words"
              autoCorrect="on"
            />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={S.label}>Audit note (required)</label>
          <textarea
            style={S.textarea}
            value={transferNote}
            onChange={(event) => setTransferNote(event.target.value)}
            placeholder="Explain why this transfer is needed (ownership change, household update, etc.)"
          />
        </div>
        <button style={{ ...S.btn("primary"), padding: "8px 12px" }} onClick={submitPrimaryVoterTransfer}>
          Record transfer
        </button>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>When</th>
                <th style={S.th}>Lot</th>
                <th style={S.th}>From</th>
                <th style={S.th}>To</th>
                <th style={S.th}>By</th>
                <th style={S.th}>Audit note</th>
              </tr>
            </thead>
            <tbody>
              {transferAuditRows.length === 0 && (
                <tr>
                  <td style={S.td} colSpan={6}>No primary voter transfers recorded yet.</td>
                </tr>
              )}
              {transferAuditRows.map((entry) => (
                <tr key={entry.id}>
                  <td style={S.td}>{entry.tsLabel || formatIsoDateTime(entry.tsIso) || "—"}</td>
                  <td style={{ ...S.td, fontWeight: 700, color: C.forest }}>{entry.lot}</td>
                  <td style={S.td}>{entry.fromName || "—"}</td>
                  <td style={S.td}>{entry.toName || "—"}</td>
                  <td style={S.td}>{entry.byName || "—"}</td>
                  <td style={{ ...S.td, fontSize: 12, color: C.muted }}>{entry.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>User access directory (from login/profile activity)</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
          Each person appears here after sign-in or profile save. Use this list to identify which users currently have admin rights.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={S.badge(C.amber, C.amberLight)}>Admin users: {adminDirectoryRows.length}</span>
          <span style={S.badge(C.forest, C.parchmentDark)}>All known users: {directoryRows.length}</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Name</th>
                <th style={S.th}>Admin rights</th>
                <th style={S.th}>Admin grade</th>
                <th style={S.th}>Access role</th>
                <th style={S.th}>Lots</th>
                <th style={S.th}>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {directoryRows.length === 0 && (
                <tr>
                  <td style={S.td} colSpan={6}>No users recorded yet. Users appear after they log in or save profile changes.</td>
                </tr>
              )}
              {directoryRows.map((row) => (
                <tr key={row.userId || row.name} style={{ background: row.isAdmin ? "#FFFBF5" : C.white }}>
                  <td style={{ ...S.td, fontWeight: 700, color: C.forest }}>{row.name || "Unknown"}</td>
                  <td style={S.td}>
                    <span style={S.badge(row.isAdmin ? C.amber : C.muted, row.isAdmin ? C.amberLight : C.parchmentDark)}>
                      {row.isAdmin ? "Admin" : "Resident"}
                    </span>
                  </td>
                  <td style={S.td}>
                    {row.isAdmin
                      ? adminGradeLabel(adminAccessGrades?.[normalizeNameKey(row.name)]?.grade || DEFAULT_ADMIN_GRADE)
                      : "—"}
                  </td>
                  <td style={S.td}>{row.isAdmin ? "Admin control" : accessRoleLabel(row.accessRole)}</td>
                  <td style={S.td}>{Array.isArray(row.lots) && row.lots.length ? row.lots.join(", ") : "—"}</td>
                  <td style={S.td}>{row.lastSeen || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Import master spreadsheet (CSV)</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
          Accepted columns (case-insensitive): Lot, Vote Choice, Vote Eligible, Ineligible Reason, Primary Voter, Owner Name (if known), Commented, Last Active, Contacted, Outreach Notes, Last Contact Date.
        </div>
        {importErr && <div style={S.alert("danger")}>{importErr}</div>}
        {importMsg && <div style={S.alert("success")}>{importMsg}</div>}
        <input style={{ ...S.input, padding: "7px 10px" }} type="file" accept=".csv,text/csv" onChange={handleImport} disabled={importing} />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Backup / Restore full portal data (JSON)</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
          Export options: JSON for full-fidelity restore, plus a single-file full CSV export that includes reporting tables and raw stored portal records.
        </div>
        {backupErr && <div style={S.alert("danger")}>{backupErr}</div>}
        {backupMsg && <div style={S.alert("success")}>{backupMsg}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            style={{ ...S.btn("primary"), padding: "7px 12px" }}
            onClick={handleBackupExport}
            disabled={backupBusy || bundleBusy}
          >
            Export full backup JSON
          </button>
          <button
            style={{ ...S.btn("stone"), padding: "7px 12px" }}
            onClick={exportCsvBundle}
            disabled={backupBusy || bundleBusy}
          >
            Export full CSV (all data)
          </button>
          <input
            style={{ ...S.input, padding: "7px 10px", maxWidth: 320 }}
            type="file"
            accept=".json,application/json"
            onChange={handleBackupRestore}
            disabled={backupBusy || bundleBusy}
          />
        </div>
        <div style={{ marginTop: 12, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 12, color: C.forest, fontWeight: 700, marginBottom: 8 }}>Selective restore options</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <label style={{ fontSize: 12, color: C.muted }}>Mode</label>
            <select
              style={{ ...S.select, minWidth: 180, padding: "6px 8px" }}
              value={restoreMode}
              onChange={(event) => {
                const nextMode = event.target.value;
                setRestoreMode(nextMode === "merge" || nextMode === "missing" ? nextMode : "replace");
              }}
              disabled={backupBusy || dbBusy}
            >
              <option value="replace">Replace selected sections</option>
              <option value="merge">Merge selected sections</option>
              <option value="missing">Restore missing values only</option>
            </select>
            <button
              style={{ ...S.btn("outline"), padding: "6px 10px", fontSize: 11 }}
              onClick={() => setAllRestoreScopes(true)}
              disabled={backupBusy || dbBusy}
            >
              Select all
            </button>
            <button
              style={{ ...S.btn("outline"), padding: "6px 10px", fontSize: 11 }}
              onClick={() => setAllRestoreScopes(false)}
              disabled={backupBusy || dbBusy}
            >
              Clear all
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
            {BACKUP_RESTORE_SCOPE_OPTIONS.map((scope) => (
              <label
                key={scope.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  background: C.white,
                  fontSize: 12,
                  color: C.ink,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={normalizeRestoreScopes(restoreScopes)[scope.key] !== false}
                  onChange={() => toggleRestoreScope(scope.key)}
                  disabled={backupBusy || dbBusy}
                />
                <span>{scope.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>
          Restore applies only selected sections. Replace mode overwrites those sections; merge mode overlays backup values; missing-only mode fills blanks without replacing existing records.
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>PostgreSQL sync, restore, and record viewer</div>
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6, marginBottom: 10 }}>
          Connect to your PostgreSQL API server, push current portal state, restore from database using selected scopes/mode, and inspect records.
        </div>
        {dbErr && <div style={S.alert("danger")}>{dbErr}</div>}
        {dbMsg && <div style={S.alert("success")}>{dbMsg}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, alignItems: "end", marginBottom: 10 }}>
          <div>
            <label style={S.label}>Database API base URL</label>
            <input
              style={S.input}
              value={dbApiInput}
              onChange={(event) => setDbApiInput(event.target.value)}
              placeholder="http://localhost:8787"
            />
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              Enter only the API host URL (not DATABASE_URL or terminal commands). Leave blank only when the API is same-origin.
            </div>
          </div>
          <button style={{ ...S.btn("stone"), padding: "7px 12px" }} onClick={saveDbApiUrl} disabled={dbBusy}>
            Save URL
          </button>
          <button style={{ ...S.btn("outline"), padding: "7px 12px" }} onClick={testDbConnection} disabled={dbBusy}>
            Test connection
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <button style={{ ...S.btn("primary"), padding: "7px 12px" }} onClick={syncPortalToDb} disabled={dbBusy}>
            Sync current portal to PostgreSQL
          </button>
          <button style={{ ...S.btn("stone"), padding: "7px 12px" }} onClick={restoreFromDb} disabled={dbBusy}>
            Restore from PostgreSQL ({restoreMode})
          </button>
          <button style={{ ...S.btn("outline"), padding: "7px 12px" }} onClick={loadDbSummary} disabled={dbBusy}>
            Load DB summary
          </button>
          <button style={{ ...S.btn("outline"), padding: "7px 12px" }} onClick={runDbChecklist} disabled={dbBusy}>
            Run checklist
          </button>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.white, padding: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.forest }}>Connection checklist</div>
            <div style={{ fontSize: 11, color: C.muted }}>
              {checklistCheckedAt ? `Last checked: ${checklistCheckedAt}` : "Not checked yet"}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Check</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {checklistRows.map((row) => {
                  const palette =
                    row.status === "pass"
                      ? { text: C.success, bg: C.successLight, label: "PASS" }
                      : row.status === "fail"
                        ? { text: C.danger, bg: C.dangerLight, label: "FAIL" }
                        : row.status === "warn"
                          ? { text: C.amber, bg: C.amberLight, label: "WARN" }
                          : { text: C.muted, bg: C.parchmentDark, label: "PENDING" };
                  return (
                    <tr key={row.key}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{row.label}</td>
                      <td style={S.td}>
                        <span style={S.badge(palette.text, palette.bg)}>{palette.label}</span>
                      </td>
                      <td style={{ ...S.td, fontSize: 12, color: C.muted }}>{row.detail || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {dbSummary && (
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
            state_values: <strong>{dbSummary.state_values || 0}</strong> · covenant_assets: <strong>{dbSummary.covenant_assets || 0}</strong> · snapshots: <strong>{dbSummary.backup_snapshots || 0}</strong>
          </div>
        )}
        {dbSummary?.scope_records?.length > 0 && (
          <div style={{ overflowX: "auto", marginBottom: 12 }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Scope</th>
                  <th style={S.th}>Record count</th>
                </tr>
              </thead>
              <tbody>
                {dbSummary.scope_records.map((row) => (
                  <tr key={row.scope}>
                    <td style={S.td}>{row.scope}</td>
                    <td style={S.td}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <select style={{ ...S.select, maxWidth: 260 }} value={dbRecordsTable} onChange={(event) => setDbRecordsTable(event.target.value)} disabled={dbBusy}>
            {[
              "state_values",
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
              "covenant_assets",
              "backup_snapshots",
            ].map((tableName) => (
              <option key={tableName} value={tableName}>{tableName}</option>
            ))}
          </select>
          <button style={{ ...S.btn("outline"), padding: "7px 12px" }} onClick={loadDbRecords} disabled={dbBusy}>
            Load records
          </button>
        </div>
        <div style={{ maxHeight: 260, overflow: "auto", background: C.parchment, border: `1px solid ${C.border}`, borderRadius: 8, padding: 10 }}>
          <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.45, color: C.ink }}>{JSON.stringify(dbRecords, null, 2)}</pre>
        </div>
      </div>

      <div style={S.statGrid}>
        {[
          { num: totalLots, label: "Total lots", accent: C.forest },
          { num: eligibleVotedRows.length, label: "Eligible votes counted", accent: C.success },
          { num: ineligibleVotedRows.length, label: "Non-eligible votes flagged", accent: C.danger },
          { num: ineligibleRows.length, label: "Lots marked non-eligible", accent: C.amber },
        ].map((s, i) => (
          <div key={i} style={S.statCard(s.accent)}>
            <div style={S.statNum}>{s.num}</div>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={S.alert("warn")}>
        Official tally (eligible lots only): <strong>{eligibleEliminateVotes}</strong> eliminate, <strong>{eligiblePermitVotes}</strong> permit, <strong>{eligibleUndecidedVotes}</strong> not voted.
      </div>

      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={S.cardTitle}>Lot-level voting roster</div>
            <div style={{ fontSize: 12, color: C.muted }}>{filteredRows.length} lot records shown</div>
          </div>
          <input
            style={{ ...S.input, width: isMobile ? "100%" : 180, padding: "8px 10px", maxWidth: isMobile ? "100%" : 240 }}
            placeholder="Find lot # (e.g. 37)"
            value={lotQuery}
            onChange={(event) => setLotQuery(event.target.value)}
            inputMode="numeric"
            enterKeyHint="search"
          />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
            <button style={{ ...S.btn(filter === "all" ? "stone" : "outline"), padding: "8px 12px", flex: isMobile ? "1 1 46%" : "0 0 auto" }} onClick={() => setFilter("all")}>All lots</button>
            <button style={{ ...S.btn(filter === "voted" ? "stone" : "outline"), padding: "8px 12px", flex: isMobile ? "1 1 46%" : "0 0 auto" }} onClick={() => setFilter("voted")}>Voted only</button>
            <button style={{ ...S.btn(filter === "not-voted" ? "stone" : "outline"), padding: "8px 12px", flex: isMobile ? "1 1 46%" : "0 0 auto" }} onClick={() => setFilter("not-voted")}>Not voted only</button>
            <button style={{ ...S.btn(filter === "ineligible" ? "stone" : "outline"), padding: "8px 12px", flex: isMobile ? "1 1 46%" : "0 0 auto" }} onClick={() => setFilter("ineligible")}>Non-eligible only</button>
            <button style={{ ...S.btn("primary"), padding: "8px 12px", flex: isMobile ? "1 1 100%" : "0 0 auto" }} onClick={exportCsv}>Export CSV</button>
          </div>
        </div>

        {isMobile ? (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {sortedFilteredRows.map((row) => (
              <div
                key={row.lot}
                style={{
                  border: `1px solid ${C.border}`,
                  borderLeft: `4px solid ${!row.voteEligible ? C.amber : row.hasVoted ? C.success : C.danger}`,
                  borderRadius: 8,
                  padding: "12px 12px",
                  background: !row.voteEligible ? "#FEF2F2" : row.hasVoted ? C.white : "#FFF7ED",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.forest }}>{row.lot}</div>
                  <span style={S.badge(!row.voteEligible ? C.amber : row.hasVoted ? C.success : C.danger, !row.voteEligible ? C.amberLight : row.hasVoted ? C.successLight : C.dangerLight)}>
                    {row.status}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: C.ink }}>
                  <div><strong>Vote:</strong> {choiceLabel(row.choice)}</div>
                  <div><strong>Primary voter:</strong> {row.primaryVoter || "—"}</div>
                  <div><strong>Owner:</strong> {row.ownerName || "—"}</div>
                  <div><strong>Commented:</strong> {row.commented ? "Yes" : "No"} · <strong>Contacted:</strong> {row.contacted ? "Yes" : "No"}</div>
                  <div><strong>Last contact:</strong> {row.lastContact || "—"} · <strong>Last active:</strong> {row.lastActive || "—"}</div>
                  <div style={{ marginTop: 4, color: C.muted }}><strong>Outreach notes:</strong> {row.outreachNotes || "—"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  <span style={S.badge(row.voteEligible ? C.success : C.danger, row.voteEligible ? C.successLight : C.dangerLight)}>
                    {row.voteEligible ? "Eligible" : "Non-eligible"}
                  </span>
                  <button
                    style={{ ...S.btn(row.voteEligible ? "outline" : "stone"), padding: "8px 12px" }}
                    onClick={() => toggleLotEligibility(row)}
                  >
                    {row.voteEligible ? "Mark non-eligible" : "Restore eligibility"}
                  </button>
                  {!row.voteEligible && (
                    <>
                      <input
                        style={{ ...S.input, padding: "8px 10px" }}
                        value={row.ineligibleReason}
                        placeholder="Reason (e.g. HOA dues unpaid)"
                        onChange={(event) => onUpdateEligibility(row.lot, { eligible: false, reason: event.target.value })}
                      />
                      <div style={{ fontSize: 11, color: C.muted }}>
                        Updated {row.eligibilityUpdatedAt || "today"}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto", marginTop: 12 }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Lot</th>
                  <th style={S.th}>Status</th>
                  <th style={S.th}>Vote choice</th>
                  <th style={S.th}>Vote eligibility</th>
                  <th style={S.th}>Primary voter</th>
                  <th style={S.th}>Owner name (if known)</th>
                  <th style={S.th}>Commented</th>
                  <th style={S.th}>Contacted</th>
                  <th style={S.th}>Outreach notes</th>
                  <th style={S.th}>Last contact</th>
                  <th style={S.th}>Last active</th>
                </tr>
              </thead>
              <tbody>
                {sortedFilteredRows.map((row) => (
                  <tr key={row.lot} style={{ background: !row.voteEligible ? "#FEF2F2" : row.hasVoted ? C.white : "#FFF7ED" }}>
                    <td style={{ ...S.td, fontWeight: 700, color: C.forest }}>{row.lot}</td>
                    <td style={S.td}>
                      <span style={S.badge(!row.voteEligible ? C.amber : row.hasVoted ? C.success : C.danger, !row.voteEligible ? C.amberLight : row.hasVoted ? C.successLight : C.dangerLight)}>
                        {row.status}
                      </span>
                    </td>
                    <td style={S.td}>{choiceLabel(row.choice)}</td>
                    <td style={{ ...S.td, minWidth: 220 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <span style={S.badge(row.voteEligible ? C.success : C.danger, row.voteEligible ? C.successLight : C.dangerLight)}>
                          {row.voteEligible ? "Eligible" : "Non-eligible"}
                        </span>
                        <button
                          style={{ ...S.btn(row.voteEligible ? "outline" : "stone"), padding: "5px 8px", fontSize: 11 }}
                          onClick={() => toggleLotEligibility(row)}
                        >
                          {row.voteEligible ? "Mark non-eligible" : "Restore eligibility"}
                        </button>
                        {!row.voteEligible && (
                          <>
                            <input
                              style={{ ...S.input, padding: "6px 8px", fontSize: 11 }}
                              value={row.ineligibleReason}
                              placeholder="Reason (e.g. HOA dues unpaid)"
                              onChange={(event) => onUpdateEligibility(row.lot, { eligible: false, reason: event.target.value })}
                            />
                            <div style={{ fontSize: 10, color: C.muted }}>
                              Updated {row.eligibilityUpdatedAt || "today"}
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={S.td}>{row.primaryVoter || "—"}</td>
                    <td style={S.td}>{row.ownerName || "—"}</td>
                    <td style={S.td}>{row.commented ? "Yes" : "No"}</td>
                    <td style={S.td}>{row.contacted ? "Yes" : "No"}</td>
                    <td style={{ ...S.td, fontSize: 12, color: C.muted }}>{row.outreachNotes || "—"}</td>
                    <td style={S.td}>{row.lastContact || "—"}</td>
                    <td style={S.td}>{row.lastActive || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── DASHBOARD PAGE ───────────────────────────────────────────────────────────
function DashboardPage({ votes, comments, stats, totalLots, votesNeeded, operationalStats }) {
  const surveyEngaged = operationalStats.votedLots;
  const notEngaged = Math.max(0, totalLots - surveyEngaged);
  const strComments = comments.filter(c => c.topic === "str");
  const restrictCount = comments.filter(c => c.stance === "restrict").length;
  const permitCount = comments.filter(c => c.stance === "permit").length;
  const outreachRows = [
    {
      group: "Lots contacted",
      lots: operationalStats.contactedLots,
      status: operationalStats.contactedLots > 0 ? "In progress" : "Not started",
      posture: `${Math.round((operationalStats.contactedLots / Math.max(totalLots, 1)) * 100)}% reached`,
      action: "Continue follow-ups to reach remaining lots",
    },
    {
      group: "Lots not yet contacted",
      lots: operationalStats.uncontactedLots,
      status: operationalStats.uncontactedLots > 0 ? "Not started" : "Complete",
      posture: `${Math.round((operationalStats.uncontactedLots / Math.max(totalLots, 1)) * 100)}% pending`,
      action: "Door-to-door / certified mail outreach",
    },
    {
      group: "Lots with recorded vote",
      lots: operationalStats.votedLots,
      status: operationalStats.votedLots > 0 ? "In progress" : "Not started",
      posture: `${Math.round((operationalStats.votedLots / Math.max(totalLots, 1)) * 100)}% voted`,
      action: "Target non-voted lots for preference capture",
    },
    {
      group: "Lots marked non-eligible",
      lots: operationalStats.nonEligibleLots,
      status: operationalStats.nonEligibleLots > 0 ? "Review needed" : "Clear",
      posture: `${operationalStats.nonEligibleVotedLots} non-eligible ballots flagged`,
      action: "Verify dues/legal status and update eligibility",
    },
  ];
  const phases = [
    { num:1, label:"Legal foundation", status:"active", detail:"Attorney engaged, STR analysis complete, written opinion on adoption process in progress" },
    { num:2, label:"Listening tour", status:"pending", detail:"Door-to-door with all 50 homeowners · Certified mail to 150 vacant lot owners" },
    { num:3, label:"Draft & deliberate", status:"pending", detail:"Working group drafts unified CC&R · Two 30-day comment periods · Community meetings" },
    { num:4, label:"Formal vote", status:"pending", detail:"Certified mail ballots to all 200 lots · Attorney-supervised count · Record in Gilmer County" },
  ];
  return (
    <div>
      <div style={S.statGrid}>
        {[
          { num:totalLots, label:"Total lots", accent:C.forest },
          { num:surveyEngaged, label:"Survey engaged", accent:"#2563EB" },
          { num:`${Math.round((surveyEngaged/totalLots)*100)}%`, label:"Engagement rate", accent:C.stone },
          { num:comments.length, label:"Comments posted", accent:"#7C3AED" },
        ].map((s,i) => <div key={i} style={S.statCard(s.accent)}><div style={S.statNum}>{s.num}</div><div style={S.statLabel}>{s.label}</div></div>)}
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Owner engagement funnel (portal tracked)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 10 }}>
          {[
            { label: "Logged in", value: stats.loggedInLots, color: C.forest },
            { label: "Commented", value: stats.commentedLots, color: "#7C3AED" },
            { label: "Voted", value: stats.votedLots, color: C.danger },
            { label: "Need outreach", value: Math.max(totalLots - stats.loggedInLots, 0), color: C.border },
          ].map((m, i) => (
            <div key={i} style={{ border: `1px solid ${C.border}`, borderTop: `3px solid ${m.color}`, borderRadius: 8, padding: "12px 14px", background: C.white }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: C.forest, fontFamily: "Georgia,serif" }}>{m.value}</div>
              <div style={{ fontSize: 12, color: C.muted }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap:16, marginBottom:16 }}>
        <div style={S.card}>
          <div style={S.cardTitle}>Vote progress toward {votesNeeded}</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>Need {votesNeeded} of {totalLots} lots to vote yes on unified covenant</div>
          {[
            { label:"Eliminate STRs", val:votes.eliminate, color:C.danger },
            { label:"Permit with regulation", val:votes.permit, color:C.stone },
            { label:"Undecided — engaged", val:votes.undecided, color:"#3B82F6" },
              { label:"Not yet reached", val:notEngaged, color:C.border },
          ].map((r,i) => (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                <span style={{ color:C.ink }}>{r.label}</span>
                <span style={{ color:C.muted }}>{r.val} lots ({Math.round((r.val/totalLots)*100)}%)</span>
              </div>
              <div style={S.meter}><div style={S.meterFill(Math.round((r.val/totalLots)*100), r.color)}/></div>
            </div>
          ))}
          <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:12, marginTop:4 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
              <span style={{ fontWeight:600, color:C.forest }}>Votes needed to pass</span>
              <span style={{ fontWeight:700, color:C.danger }}>{Math.max(votesNeeded - votes.eliminate, 0)} more needed</span>
            </div>
            <div style={{ height:8, borderRadius:4, overflow:"hidden", background:C.parchmentDark, marginTop:6, position:"relative" }}>
              <div style={{ height:"100%", width:`${Math.min((votes.eliminate/Math.max(votesNeeded,1))*100, 100)}%`, background:C.danger, transition:"width 1s" }}/>
              <div style={{ position:"absolute", right:0, top:0, height:"100%", width:`${(Math.max(votesNeeded-votes.eliminate,0)/totalLots)*100}%`, background:"rgba(139,26,26,0.15)" }}/>
            </div>
            <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>{votes.eliminate} of {votesNeeded} votes needed to eliminate STRs</div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>Comment sentiment analysis</div>
          <div style={{ fontSize:13, color:C.muted, marginBottom:12 }}>{comments.length} total comments · {strComments.length} on STR topic</div>
          {[
            { label:"Supporting STR restriction", val:restrictCount, color:C.danger, total:comments.length },
            { label:"Supporting STR permission", val:permitCount, color:C.stone, total:comments.length },
            { label:"Neutral / questions", val:comments.filter(c=>c.stance==="neutral").length, color:"#3B82F6", total:comments.length },
          ].map((r,i) => (
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                <span style={{ color:C.ink }}>{r.label}</span>
                <span style={{ color:C.muted }}>{r.val} comments</span>
              </div>
              <div style={S.meter}><div style={S.meterFill(Math.round((r.val/Math.max(r.total,1))*100), r.color)}/></div>
            </div>
          ))}
          <div style={{ marginTop:12 }}>
            <div style={S.cardTitle}>Recent activity</div>
            {comments.slice(-3).reverse().map((c,i) => (
              <div key={i} style={{ fontSize:12, color:C.muted, padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                <span style={{ fontWeight:600, color:C.ink }}>{c.name}</span> ({c.lot}) commented on <span style={{ color:C.forest }}>{c.topic === "str" ? "STRs" : c.topic}</span> · {c.ts}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Campaign roadmap — live status</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(160px, 1fr))", gap:12, marginTop:12 }}>
          {phases.map((p,i) => (
            <div key={i} style={{ border:`2px solid ${p.status==="active" ? C.stone : p.status==="done" ? C.success : C.border}`, borderRadius:8, padding:"14px 16px", background: p.status==="active" ? "#FFFBF5" : C.white }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontFamily:"Georgia,serif", fontSize:20, fontWeight:"bold", color:C.forest }}>0{p.num}</span>
                {p.status==="active" && <span style={S.badge(C.amber, C.amberLight)}>Active</span>}
                {p.status==="done" && <span style={S.badge(C.success, C.successLight)}>Done</span>}
                {p.status==="pending" && <span style={S.badge(C.muted, C.parchmentDark)}>Pending</span>}
              </div>
              <div style={{ fontWeight:700, fontSize:13, color:C.forest, marginBottom:4 }}>{p.label}</div>
              <div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>{p.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Outreach targets (live portal data)</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          This table is calculated from current portal records (contacted flags, vote ledger, and eligibility markers).
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={S.table}>
            <thead><tr>
              <th style={S.th}>Owner group</th><th style={S.th}>Est. lots</th><th style={S.th}>Engagement status</th><th style={S.th}>STR posture</th><th style={S.th}>Priority action</th>
            </tr></thead>
            <tbody>
              {outreachRows.map((r,i) => (
                <tr key={i} style={{ background: i%2===0 ? C.white : C.parchment }}>
                  <td style={{ ...S.td, fontWeight:600 }}>{r.group}</td>
                  <td style={S.td}>{r.lots}</td>
                  <td style={S.td}>
                    <span
                      style={S.pill(
                        r.status === "In progress"
                          ? C.amber
                          : r.status === "Review needed"
                            ? C.danger
                            : r.status === "Complete" || r.status === "Clear"
                              ? C.success
                              : C.muted,
                        r.status === "In progress"
                          ? C.amberLight
                          : r.status === "Review needed"
                            ? C.dangerLight
                            : r.status === "Complete" || r.status === "Clear"
                              ? C.successLight
                              : C.parchmentDark
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ ...S.td, fontSize:12, color:C.muted }}>{r.posture}</td>
                  <td style={{ ...S.td, fontSize:12, color:C.forest, fontWeight:500 }}>{r.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const initialAdminAccessEntries = getInitialAdminAccessEntries();
  const [adminAccessEntries, setAdminAccessEntries] = useState(initialAdminAccessEntries);
  const [user, setUser] = useState(() => {
    const saved = store.get("fw_user");
    if (!saved) return null;
    const lots = normalizeUserLots(saved);
    const hasAdminApproval = isAdminUserAllowed(saved.name, initialAdminAccessEntries);
    const requestedAdmin = !!saved.isAdmin || (lots.length === 1 && lots[0] === "ADMIN");
    if (requestedAdmin && !hasAdminApproval) return null;
    if (!hasAdminApproval && lots.length === 0) return null;
    const isAdmin = hasAdminApproval || requestedAdmin;
    const effectiveLots = isAdmin ? ["ADMIN"] : lots;
    return {
      ...saved,
      isAdmin,
      accessRole: isAdmin ? ACCESS_ROLES.primary : normalizeAccessRole(saved.accessRole),
      userId: saved.userId || generateUserId(saved.name),
      lots: effectiveLots,
      lot: isAdmin ? "ADMIN" : effectiveLots.length === 1 ? effectiveLots[0] : effectiveLots.join(", "),
    };
  });
  const [page, setPage] = useState("home");
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1280
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [votes, setVotes] = useState(() => {
    const savedTotalLots = Number(store.get("fw_total_lots"));
    const effectiveTotalLots =
      Number.isInteger(savedTotalLots) && savedTotalLots >= MIN_TOTAL_LOTS && savedTotalLots <= MAX_TOTAL_LOTS
        ? savedTotalLots
        : DEFAULT_TOTAL_LOTS;
    const initialLotLabels = buildLotLabels(effectiveTotalLots);
    const savedLedger = store.get("fw_vote_ledger");
    if (savedLedger && typeof savedLedger === "object") {
      return computeVoteTotalsFromLedger(savedLedger, initialLotLabels);
    }
    const savedVotes = store.get("fw_votes");
    if (savedVotes && typeof savedVotes === "object") {
      const eliminate = Math.max(0, Number(savedVotes.eliminate) || 0);
      const permit = Math.max(0, Number(savedVotes.permit) || 0);
      return {
        eliminate,
        permit,
        undecided: Math.max(0, initialLotLabels.length - eliminate - permit),
      };
    }
    return {
      eliminate: 0,
      permit: 0,
      undecided: initialLotLabels.length,
    };
  });
  const [comments, setComments] = useState(() => {
    const savedComments = store.get("fw_comments");
    const safeSavedComments = Array.isArray(savedComments) ? savedComments : [];
    const savedVersion = store.get("fw_comments_data_version");
    if (savedVersion !== COMMENTS_DATA_VERSION) {
      const cleaned = safeSavedComments.filter((comment) => !isLegacySampleComment(comment));
      store.set("fw_comments", cleaned);
      store.set("fw_comments_data_version", COMMENTS_DATA_VERSION);
      return cleaned;
    }
    return safeSavedComments.length ? safeSavedComments : SEED_COMMENTS;
  });
  const [covenantDocs, setCovenantDocs] = useState(() => {
    const saved = store.get("fw_covenant_docs");
    return Array.isArray(saved) && saved.length ? saved : DEFAULT_COVENANT_DOCS;
  });
  const [ownerActivity, setOwnerActivity] = useState(() => store.get("fw_owner_activity") || {});
  const [voteLedger, setVoteLedger] = useState(() => store.get("fw_vote_ledger") || {});
  const [primaryVoterRegistry, setPrimaryVoterRegistry] = useState(() => {
    const saved = store.get("fw_primary_voter_registry");
    return saved && typeof saved === "object" ? saved : {};
  });
  const [primaryVoterTransferAudit, setPrimaryVoterTransferAudit] = useState(() =>
    normalizePrimaryVoterTransferAuditEntries(store.get(PRIMARY_VOTER_TRANSFER_AUDIT_KEY))
  );
  const [outreachState, setOutreachState] = useState(() => {
    const saved = store.get("fw_outreach_state");
    return saved && typeof saved === "object" ? saved : {};
  });
  const [userDirectory, setUserDirectory] = useState(() => {
    const saved = store.get("fw_user_directory");
    return saved && typeof saved === "object" ? saved : {};
  });
  const [adminAccessGrades, setAdminAccessGrades] = useState(() => {
    const saved = store.get("fw_admin_access_grades");
    return saved && typeof saved === "object" ? saved : {};
  });
  const [totalLots, setTotalLots] = useState(() => {
    const saved = Number(store.get("fw_total_lots"));
    if (Number.isInteger(saved) && saved >= MIN_TOTAL_LOTS && saved <= MAX_TOTAL_LOTS) return saved;
    return DEFAULT_TOTAL_LOTS;
  });
  const [eligibilityState, setEligibilityState] = useState(() => {
    const saved = store.get("fw_vote_eligibility");
    return saved && typeof saved === "object" ? saved : {};
  });
  const [lastBackupExportAt, setLastBackupExportAt] = useState(() => {
    const saved = store.get(LAST_BACKUP_EXPORT_KEY);
    return typeof saved === "string" && saved.trim() ? saved : "";
  });
  const [lastDbSyncAt, setLastDbSyncAt] = useState(() => {
    const saved = store.get(LAST_DB_SYNC_AT_KEY);
    return typeof saved === "string" && saved.trim() ? saved : "";
  });
  const [backupHealthThresholdDays, setBackupHealthThresholdDays] = useState(() => {
    const saved = Number(store.get(BACKUP_HEALTH_THRESHOLD_KEY));
    if (
      Number.isInteger(saved)
      && saved >= MIN_BACKUP_HEALTH_MAX_AGE_DAYS
      && saved <= MAX_BACKUP_HEALTH_MAX_AGE_DAYS
    ) {
      return saved;
    }
    return DEFAULT_BACKUP_HEALTH_MAX_AGE_DAYS;
  });
  const [dbApiBaseUrl, setDbApiBaseUrl] = useState(() => {
    const saved = store.get(DB_API_BASE_URL_KEY);
    const normalizedSaved = sanitizeDbApiBaseUrl(typeof saved === "string" ? saved : "", { allowEmpty: true });
    if (normalizedSaved?.value) return normalizedSaved.value;
    const normalizedDefault = sanitizeDbApiBaseUrl(DEFAULT_DB_API_BASE_URL, { allowEmpty: true });
    return normalizedDefault?.value || "";
  });
  const [sharedDataBusy, setSharedDataBusy] = useState(false);
  const [sharedDataMsg, setSharedDataMsg] = useState("");
  const [sharedDataErr, setSharedDataErr] = useState("");
  const allLotLabels = buildLotLabels(totalLots);
  const votesNeeded = votesNeededForLots(totalLots);

  useEffect(() => { store.set("fw_votes", votes); }, [votes]);
  useEffect(() => { store.set("fw_comments", comments); }, [comments]);
  useEffect(() => { store.set("fw_covenant_docs", covenantDocs); }, [covenantDocs]);
  useEffect(() => { store.set("fw_owner_activity", ownerActivity); }, [ownerActivity]);
  useEffect(() => { store.set("fw_vote_ledger", voteLedger); }, [voteLedger]);
  useEffect(() => { store.set("fw_primary_voter_registry", primaryVoterRegistry); }, [primaryVoterRegistry]);
  useEffect(() => { store.set(PRIMARY_VOTER_TRANSFER_AUDIT_KEY, primaryVoterTransferAudit); }, [primaryVoterTransferAudit]);
  useEffect(() => { store.set("fw_outreach_state", outreachState); }, [outreachState]);
  useEffect(() => { store.set("fw_user_directory", userDirectory); }, [userDirectory]);
  useEffect(() => { store.set("fw_admin_access_entries", adminAccessEntries); }, [adminAccessEntries]);
  useEffect(() => { store.set("fw_admin_access_grades", adminAccessGrades); }, [adminAccessGrades]);
  useEffect(() => { store.set("fw_total_lots", totalLots); }, [totalLots]);
  useEffect(() => { store.set("fw_vote_eligibility", eligibilityState); }, [eligibilityState]);
  useEffect(() => { store.set(LAST_BACKUP_EXPORT_KEY, lastBackupExportAt || ""); }, [lastBackupExportAt]);
  useEffect(() => { store.set(LAST_DB_SYNC_AT_KEY, lastDbSyncAt || ""); }, [lastDbSyncAt]);
  useEffect(() => { store.set(BACKUP_HEALTH_THRESHOLD_KEY, backupHealthThresholdDays); }, [backupHealthThresholdDays]);
  useEffect(() => { store.set(DB_API_BASE_URL_KEY, dbApiBaseUrl || ""); }, [dbApiBaseUrl]);
  useEffect(() => {
    if (typeof window === "undefined") return () => {};
    const updateViewport = () => setViewportWidth(window.innerWidth);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);
  useEffect(() => {
    if (viewportWidth > MOBILE_BREAKPOINT_PX && mobileNavOpen) {
      setMobileNavOpen(false);
    }
  }, [viewportWidth, mobileNavOpen]);
  useEffect(() => {
    setMobileNavOpen(false);
  }, [page]);
  useEffect(() => {
    const result = consolidateCovenantDocs(covenantDocs);
    if (result.removedCount > 0) {
      cleanupRemovedCovenantAssets(result.removedDocs, result.docs);
      setCovenantDocs(result.docs);
    }
  }, []);
  useEffect(() => {
    if (user?.isAdmin && !isAdminUserAllowed(user.name, adminAccessEntries)) {
      store.set("fw_user", null);
      setUser(null);
      setPage("home");
    }
  }, [adminAccessEntries, user]);

  const trackOwner = (lot, patch = {}) => {
    if (!lot) return;
    setOwnerActivity((prev) => ({
      ...prev,
      [lot]: {
        hasLoggedIn: true,
        lastActive: todayLabel(),
        ...prev[lot],
        ...patch,
      },
    }));
  };

  const handleUpdateEligibility = (lot, patch = {}) => {
    if (!lot || !allLotLabels.includes(lot)) return;
    setEligibilityState((prev) => {
      const next = { ...prev };
      const existing = next[lot] || {};
      const currentEligible = existing.eligible === false ? false : true;
      const targetEligible =
        patch.eligible === undefined
          ? currentEligible
          : patch.eligible !== false;
      if (targetEligible) {
        delete next[lot];
        return next;
      }
      const reason =
        patch.reason !== undefined
          ? String(patch.reason || "").trim()
          : String(existing.reason || "").trim();
      next[lot] = {
        eligible: false,
        reason,
        updatedAt: todayLabel(),
      };
      return next;
    });
  };

  const handleUpdateTotalLots = (nextTotalLots) => {
    const parsed = Number(nextTotalLots);
    if (!Number.isInteger(parsed) || parsed < MIN_TOTAL_LOTS || parsed > MAX_TOTAL_LOTS) return;
    setTotalLots(parsed);
  };

  const handleSetAdminAccessGrade = (name, grade) => {
    const safeName = String(name || "").trim();
    if (!safeName) return { error: "Admin name is required." };
    if (!isAdminUserAllowed(safeName, adminAccessEntries)) {
      return { error: `${safeName} is not currently in the approved admin list.` };
    }
    const key = normalizeNameKey(safeName);
    const normalizedGrade = normalizeAdminGrade(grade);
    setAdminAccessGrades((prev) => ({
      ...prev,
      [key]: {
        name: safeName,
        grade: normalizedGrade,
        updatedAt: todayLabel(),
      },
    }));
    return { message: `${safeName} grade set to ${adminGradeLabel(normalizedGrade)}.` };
  };

  const handleGrantAdminAccess = (name, grade = DEFAULT_ADMIN_GRADE) => {
    const safeName = String(name || "").trim();
    if (!safeName) return { error: "Enter a name to grant admin rights." };
    const key = normalizeNameKey(safeName);
    const exists = adminAccessEntries.some((entry) => normalizeNameKey(entry) === key);
    const normalizedGrade = normalizeAdminGrade(grade);
    if (!exists) {
      setAdminAccessEntries((prev) => normalizeAdminAccessEntries([...prev, safeName]));
    }
    setAdminAccessGrades((prev) => ({
      ...prev,
      [key]: {
        name: safeName,
        grade: normalizedGrade,
        updatedAt: todayLabel(),
      },
    }));
    return { message: exists ? `${safeName} already had admin rights; grade updated.` : `${safeName} now has admin rights.` };
  };

  const handleRevokeAdminAccess = (name) => {
    const safeName = String(name || "").trim();
    if (!safeName) return { error: "Admin name is required." };
    const key = normalizeNameKey(safeName);
    const remaining = adminAccessEntries.filter((entry) => normalizeNameKey(entry) !== key);
    if (remaining.length === 0) {
      return { error: "At least one admin must remain configured." };
    }
    setAdminAccessEntries(remaining);
    setAdminAccessGrades((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    return { message: `${safeName} admin rights revoked.` };
  };

  const handleTransferPrimaryVoter = ({ lot, toName, note }) => {
    if (!user?.isAdmin) {
      return { error: "Only admins can transfer primary voter authority." };
    }
    const normalizedLot = normalizeLotLabel(lot);
    const safeName = String(toName || "").trim();
    const safeNote = String(note || "").trim();
    if (!normalizedLot || !allLotLabels.includes(normalizedLot)) {
      return { error: "Select a valid lot number before transferring primary voter authority." };
    }
    if (!safeName) {
      return { error: "New primary voter name is required." };
    }
    if (safeNote.length < 10) {
      return { error: "Audit note must be at least 10 characters." };
    }

    const previousRecord = primaryVoterRegistry?.[normalizedLot] || null;
    const previousName = String(previousRecord?.name || "").trim();
    const nextUserId = `usr_transfer_${normalizeNameKey(safeName).replace(/[^a-z0-9]+/g, "-") || "resident"}_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const nowLabel = todayLabel();

    setPrimaryVoterRegistry((prev) => ({
      ...prev,
      [normalizedLot]: {
        name: safeName,
        nameKey: normalizeNameKey(safeName),
        userId: nextUserId,
        assignedAt: nowLabel,
        credentialHash: null,
      },
    }));
    setOwnerActivity((prev) => ({
      ...prev,
      [normalizedLot]: {
        ...(prev[normalizedLot] || {}),
        hasLoggedIn: prev?.[normalizedLot]?.hasLoggedIn || false,
        name: safeName,
        lastActive: prev?.[normalizedLot]?.lastActive || nowLabel,
      },
    }));
    setUserDirectory((prev) => ({
      ...prev,
      [nextUserId]: {
        userId: nextUserId,
        name: safeName,
        nameKey: normalizeNameKey(safeName),
        isAdmin: false,
        accessRole: ACCESS_ROLES.primary,
        lots: [normalizedLot],
        lastSeen: nowLabel,
      },
    }));

    const auditEntry = {
      id: `pvt_${normalizedLot.replace(/\s+/g, "_")}_${Date.now()}`,
      lot: normalizedLot,
      fromName: previousName,
      toName: safeName,
      note: safeNote,
      byName: user.name,
      tsIso: nowIso,
      tsLabel: formatIsoDateTime(nowIso),
    };
    setPrimaryVoterTransferAudit((prev) => mergePrimaryVoterTransferAuditEntries([auditEntry], prev));

    return {
      message: `${normalizedLot} primary voter transferred to ${safeName}. New voter must sign in using this name and create their password for future lot votes.`,
    };
  };

  const trackUserAccess = (profile) => {
    if (!profile?.name) return;
    const profileLots = profile.isAdmin ? ["ADMIN"] : normalizeUserLots(profile).filter((lot) => lot !== "ADMIN");
    const userId = profile.userId || `usr_${normalizeNameKey(profile.name)}`;
    setUserDirectory((prev) => ({
      ...prev,
      [userId]: {
        userId,
        name: profile.name,
        nameKey: normalizeNameKey(profile.name),
        isAdmin: !!profile.isAdmin,
        accessRole: profile.isAdmin ? ACCESS_ROLES.primary : normalizeAccessRole(profile.accessRole),
        lots: profileLots,
        lastSeen: todayLabel(),
      },
    }));
  };

  const reconcilePrimaryVoterRegistry = (candidateUser, previousUser = null, options = {}) => {
    const nextRegistry = { ...primaryVoterRegistry };
    const candidateRole = normalizeAccessRole(candidateUser.accessRole);
    const candidateLots = normalizeUserLots(candidateUser).filter((lot) => lot !== "ADMIN");
    const candidateNameKey = normalizeNameKey(candidateUser.name);
    const enforceExistingIdentity = !!options.enforceExistingIdentity;
    const loginSecret = normalizeLoginSecret(candidateUser.loginSecret);
    const credentialHashesByLot = {};
    if (enforceExistingIdentity && candidateRole === ACCESS_ROLES.primary) {
      if (loginSecret.length < MIN_LOGIN_SECRET_LENGTH) {
        return {
          error: `Primary voter sign-in requires a password of at least ${MIN_LOGIN_SECRET_LENGTH} characters.`,
        };
      }
      candidateLots.forEach((lot) => {
        credentialHashesByLot[lot] = buildPrimaryCredentialHash(lot, loginSecret);
      });
    }

    if (previousUser && normalizeAccessRole(previousUser.accessRole) === ACCESS_ROLES.primary) {
      const previousLots = normalizeUserLots(previousUser).filter((lot) => lot !== "ADMIN");
      const previousNameKey = normalizeNameKey(previousUser.name);
      previousLots.forEach((lot) => {
        const existing = nextRegistry[lot];
        const stillPrimaryForLot = candidateRole === ACCESS_ROLES.primary && candidateLots.includes(lot);
        const sameProfile =
          existing &&
          ((previousUser.userId && existing.userId === previousUser.userId) ||
            (existing.nameKey && existing.nameKey === previousNameKey));
        if (sameProfile && !stillPrimaryForLot) {
          delete nextRegistry[lot];
        }
      });
    }

    if (candidateRole === ACCESS_ROLES.primary) {
      for (const lot of candidateLots) {
        const existing = nextRegistry[lot];
        const existingNameKey = normalizeNameKey(existing?.nameKey || existing?.name);
        if (enforceExistingIdentity && existing) {
          const credentialHash = credentialHashesByLot[lot];
          const sameName = existingNameKey && existingNameKey === candidateNameKey;
          const sameUser = candidateUser.userId && existing.userId && existing.userId === candidateUser.userId;
          if (!sameName && !sameUser) {
            return {
              error: `${lot} voting rights are already assigned to "${existing.name}". Use comment-only access for other household users or ask an admin to update the primary voter record.`,
            };
          }
          if (existing.credentialHash && credentialHash !== existing.credentialHash) {
            return {
              error: `Incorrect voting password for ${lot}.`,
            };
          }
        }
        if (
          existing &&
          !(
            (candidateUser.userId && existing.userId === candidateUser.userId) ||
            (existingNameKey && existingNameKey === candidateNameKey)
          )
        ) {
          return {
            error: `${lot} already has primary voter "${existing.name}". Use comment-only access for this account or contact admin.`,
          };
        }
      }

      candidateLots.forEach((lot) => {
        const existing = nextRegistry[lot] || {};
        nextRegistry[lot] = {
          name: candidateUser.name,
          nameKey: candidateNameKey,
          userId: candidateUser.userId,
          assignedAt: existing.assignedAt || todayLabel(),
          credentialHash: existing.credentialHash || credentialHashesByLot[lot] || null,
        };
      });
    }

    return { registry: nextRegistry };
  };

  const handleLogin = (u) => {
    const lots = normalizeUserLots(u);
    const hasAdminApproval = isAdminUserAllowed(u.name, adminAccessEntries);
    const requestedAdmin = lots.length === 1 && lots[0] === "ADMIN";
    const loginSecret = normalizeLoginSecret(u.loginSecret);
    if (requestedAdmin && !hasAdminApproval) {
      return "This account is not authorized for admin access. Contact the HOA administrator.";
    }
    const isAdmin = hasAdminApproval || requestedAdmin;
    if (!isAdmin && loginSecret.length < MIN_LOGIN_SECRET_LENGTH) {
      return `Password must be at least ${MIN_LOGIN_SECRET_LENGTH} characters.`;
    }
    const effectiveLots = isAdmin ? ["ADMIN"] : lots;
    const normalizedUser = {
      ...u,
      isAdmin,
      accessRole: isAdmin ? ACCESS_ROLES.primary : normalizeAccessRole(u.accessRole),
      userId: u.userId || generateUserId(u.name),
      lots: effectiveLots,
      lot: isAdmin ? "ADMIN" : effectiveLots.length === 1 ? effectiveLots[0] : effectiveLots.join(", "),
    };
    if (!isAdmin) {
      const check = reconcilePrimaryVoterRegistry(normalizedUser, null, {
        enforceExistingIdentity: true,
      });
      if (check.error) return check.error;
      setPrimaryVoterRegistry(check.registry);
    }
    const persistedUser = { ...normalizedUser };
    delete persistedUser.loginSecret;
    store.set("fw_user", persistedUser);
    setUser(persistedUser);
    setPage(isAdmin ? "admin-votes" : "home");
    trackUserAccess(persistedUser);
    if (!isAdmin) {
      lots.forEach((lot) => trackOwner(lot, { name: persistedUser.name }));
    }
    return null;
  };
  const handleLogout = () => { store.set("fw_user", null); setUser(null); setPage("home"); };

  const handleVote = (choice, lotOverride = null) => {
    if (!isPrimaryVoter(user)) return;
    const votingLots = normalizeUserLots(user).filter((lot) => lot !== "ADMIN" && allLotLabels.includes(lot));
    const userNameKey = normalizeNameKey(user?.name);
    const authorizedVotingLots = votingLots.filter((lot) => {
      const registryEntry = primaryVoterRegistry?.[lot];
      if (!registryEntry) return true;
      const registryNameKey = normalizeNameKey(registryEntry.nameKey || registryEntry.name);
      const sameUserId = !!(user?.userId && registryEntry.userId && user.userId === registryEntry.userId);
      return sameUserId || (registryNameKey && registryNameKey === userNameKey);
    });
    const targetLots = lotOverride ? authorizedVotingLots.filter((lot) => lot === lotOverride) : authorizedVotingLots;
    if (targetLots.length === 0) return;
    const previousChoices = targetLots.map((lot) => voteLedger[lot] || store.get(`vote_${lot}`) || null);
    if (previousChoices.every((prevChoice) => prevChoice === choice)) return;

    setVoteLedger((prevLedger) => {
      const nextLedger = { ...prevLedger };
      targetLots.forEach((lot) => { nextLedger[lot] = choice; });
      setVotes((prevVotes) => {
        const recomputed = recomputeVotesFromLedger(nextLedger);
        if (
          prevVotes.eliminate === recomputed.eliminate &&
          prevVotes.permit === recomputed.permit &&
          prevVotes.undecided === recomputed.undecided
        ) {
          return prevVotes;
        }
        return recomputed;
      });
      return nextLedger;
    });
    targetLots.forEach((lot) => {
      store.set(`vote_${lot}`, choice);
      trackOwner(lot, { voteChoice: choice, votedAt: todayLabel(), name: user.name });
    });
  };

  const handleAddComment = (c) => {
    setComments(prev => [c, ...prev]);
    const commentLots = (Array.isArray(c.lots) ? c.lots : [c.lot])
      .map((lot) => normalizeLotLabel(lot))
      .filter((lot) => !!lot && lot !== "ADMIN");
    commentLots.forEach((lot) => trackOwner(lot, { commented: true, name: c.name }));
  };
  const handleUpdateComment = (commentId, updates = {}) => {
    const targetId = String(commentId);
    const nextText = String(updates.text || "").trim();
    if (nextText.length < 20) {
      return { error: "Comment must be at least 20 characters." };
    }
    const nextTopic = COMMENT_TOPIC_OPTIONS.some((topic) => topic.value === updates.topic)
      ? updates.topic
      : "general";
    const nextStanceOptions = commentStanceOptionsForTopic(nextTopic);
    const nextStance = nextStanceOptions.some((option) => option.value === updates.stance)
      ? updates.stance
      : "neutral";
    const nextConcernOptions = commentConcernOptionsForTopic(nextTopic);
    const nextConcern = nextConcernOptions.includes(updates.concern)
      ? updates.concern
      : nextConcernOptions[0];

    let updated = false;
    let editedComment = null;
    setComments((prev) =>
      prev.map((comment) => {
        if (String(comment.id) !== targetId) return comment;
        updated = true;
        const nextComment = {
          ...comment,
          topic: nextTopic,
          stance: nextStance,
          concern: nextConcern,
          text: nextText,
          editedAt: todayLabel(),
          editedBy: user?.name || comment.name,
        };
        editedComment = nextComment;
        return nextComment;
      })
    );
    if (!updated) {
      return { error: "Comment could not be updated because it was not found." };
    }
    const commentLots = (Array.isArray(editedComment?.lots) ? editedComment.lots : [editedComment?.lot])
      .map((lot) => normalizeLotLabel(lot))
      .filter((lot) => !!lot && lot !== "ADMIN");
    commentLots.forEach((lot) => trackOwner(lot, { commented: true, name: editedComment?.name || user?.name || "" }));
    return { message: "Comment updated." };
  };
  const handleAddDocument = (doc) =>
    setCovenantDocs((prev) => {
      const result = consolidateCovenantDocs([doc, ...prev]);
      cleanupRemovedCovenantAssets(result.removedDocs, result.docs);
      return result.docs;
    });
  const handleDeleteDocument = (docId) =>
    setCovenantDocs((prev) => {
      const target = prev.find((doc) => doc.id === docId);
      if (target?.fileAssetKey) {
        deleteCovenantAssetBlob(target.fileAssetKey).catch(() => {});
      }
      return prev.filter((doc) => doc.id !== docId);
    });
  const handleConsolidateDocuments = () => {
    const result = consolidateCovenantDocs(covenantDocs);
    if (result.removedCount === 0) {
      return { message: "No duplicate covenant entries were found." };
    }
    cleanupRemovedCovenantAssets(result.removedDocs, result.docs);
    setCovenantDocs(result.docs);
    return {
      message: `Consolidated ${result.removedCount} duplicate entr${result.removedCount === 1 ? "y" : "ies"} across ${result.consolidatedGroups} covenant group${result.consolidatedGroups === 1 ? "" : "s"}.`,
    };
  };
  const handleUpdateProfile = ({ name, lots, accessRole }) => {
    const isAdmin = user.isAdmin;
    const normalizedLots = isAdmin ? ["ADMIN"] : [...new Set((lots || []).map((lot) => normalizeLotLabel(lot)).filter(Boolean))];
    if (!isAdmin) {
      normalizedLots.forEach((lot) => trackOwner(lot, { name }));
    }
    const updatedUser = {
      ...user,
      name: name || user.name,
      accessRole: isAdmin ? ACCESS_ROLES.primary : normalizeAccessRole(accessRole || user.accessRole),
      lots: normalizedLots,
      lot: isAdmin ? "ADMIN" : normalizedLots.join(", "),
    };
    if (!isAdmin) {
      const check = reconcilePrimaryVoterRegistry(updatedUser, user);
      if (check.error) return check.error;
      setPrimaryVoterRegistry(check.registry);
    }
    store.set("fw_user", updatedUser);
    setUser(updatedUser);
    trackUserAccess(updatedUser);
    return null;
  };

  const recomputeVotesFromLedger = (ledger, lotLabels = allLotLabels) => {
    return computeVoteTotalsFromLedger(ledger, lotLabels);
  };

  useEffect(() => {
    setVotes((prev) => {
      const recomputed = recomputeVotesFromLedger(voteLedger, allLotLabels);
      if (
        prev.eliminate === recomputed.eliminate &&
        prev.permit === recomputed.permit &&
        prev.undecided === recomputed.undecided
      ) {
        return prev;
      }
      return recomputed;
    });
  }, [totalLots, voteLedger]);

  const handleImportCsv = (rows) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return { error: "No CSV rows found to import." };
    }

    const nextVoteLedger = { ...voteLedger };
    const nextOwnerActivity = { ...ownerActivity };
    const nextPrimaryRegistry = { ...primaryVoterRegistry };
    const nextOutreach = { ...outreachState };
    const nextEligibility = { ...eligibilityState };
    const touchedVoteLots = new Set();
    const touchedEligibilityLots = new Set();
    let recognizedLots = 0;

    rows.forEach((row) => {
      const lower = Object.entries(row || {}).reduce((acc, [key, value]) => {
        acc[String(key || "").trim().toLowerCase()] = value;
        return acc;
      }, {});

      const pick = (aliases) => {
        for (const alias of aliases) {
          if (Object.prototype.hasOwnProperty.call(lower, alias)) return lower[alias];
        }
        return undefined;
      };
      const hasColumn = (aliases) => aliases.some((alias) => Object.prototype.hasOwnProperty.call(lower, alias));

      const lotRaw = pick(["lot", "lot number", "lot #"]);
      const lot = normalizeLotLabel(lotRaw);
      if (!lot || !allLotLabels.includes(lot)) return;
      recognizedLots += 1;

      const voteAliases = ["vote choice", "vote", "vote_choice", "choice"];
      if (hasColumn(voteAliases)) {
        const normalizedChoice = normalizeImportedVoteChoice(pick(voteAliases));
        if (normalizedChoice) nextVoteLedger[lot] = normalizedChoice;
        else delete nextVoteLedger[lot];
        touchedVoteLots.add(lot);
      }

      const ownerNameRaw = pick(["owner name (if known)", "owner name", "owner", "voter name"]);
      const commentedAliases = ["commented", "has commented"];
      const lastActiveRaw = pick(["last active", "last active date"]);
      if (ownerNameRaw !== undefined || hasColumn(commentedAliases) || lastActiveRaw !== undefined) {
        const existing = nextOwnerActivity[lot] || { hasLoggedIn: true };
        if (ownerNameRaw !== undefined && String(ownerNameRaw || "").trim()) {
          existing.name = String(ownerNameRaw || "").trim();
        }
        if (hasColumn(commentedAliases)) {
          existing.commented = normalizeBoolean(pick(commentedAliases));
        }
        if (lastActiveRaw !== undefined && String(lastActiveRaw || "").trim()) {
          existing.lastActive = String(lastActiveRaw || "").trim();
        }
        nextOwnerActivity[lot] = existing;
      }

      const primaryAliases = ["primary voter", "primary voter name"];
      if (hasColumn(primaryAliases)) {
        const primaryName = String(pick(primaryAliases) || "").trim();
        if (primaryName) {
          const existingPrimary = nextPrimaryRegistry[lot] || {};
          const existingNameKey = normalizeNameKey(existingPrimary.nameKey || existingPrimary.name);
          const nextNameKey = normalizeNameKey(primaryName);
          nextPrimaryRegistry[lot] = {
            name: primaryName,
            nameKey: nextNameKey,
            userId: existingPrimary.userId || generateUserId(primaryName),
            assignedAt: todayLabel(),
            credentialHash: existingNameKey === nextNameKey ? existingPrimary.credentialHash || null : null,
          };
        } else {
          delete nextPrimaryRegistry[lot];
        }
      }

      const contactedAliases = ["contacted", "outreach contacted"];
      const notesAliases = ["outreach notes", "notes"];
      const lastContactAliases = ["last contact date", "last contact"];
      if (hasColumn(contactedAliases) || hasColumn(notesAliases) || hasColumn(lastContactAliases)) {
        const existingOutreach = { ...(nextOutreach[lot] || {}) };
        if (hasColumn(contactedAliases)) {
          existingOutreach.contacted = normalizeBoolean(pick(contactedAliases));
        }
        if (hasColumn(notesAliases)) {
          existingOutreach.notes = String(pick(notesAliases) || "").trim();
        }
        if (hasColumn(lastContactAliases)) {
          existingOutreach.lastContact = String(pick(lastContactAliases) || "").trim();
        }
        const shouldKeep =
          existingOutreach.contacted ||
          String(existingOutreach.notes || "").trim().length > 0 ||
          String(existingOutreach.lastContact || "").trim().length > 0;
        if (shouldKeep) nextOutreach[lot] = existingOutreach;
        else delete nextOutreach[lot];
      }

      const eligibleAliases = ["vote eligible", "eligible", "eligibility", "eligibility status", "eligible to vote", "dues paid", "dues current"];
      const ineligibleReasonAliases = ["ineligible reason", "reason ineligible", "disqualification reason", "eligibility notes", "eligibility reason"];
      if (hasColumn(eligibleAliases) || hasColumn(ineligibleReasonAliases)) {
        const existingEligibility = { ...(nextEligibility[lot] || {}) };
        const importedEligible = normalizeImportedEligibility(pick(eligibleAliases));
        const importedReason = hasColumn(ineligibleReasonAliases) ? String(pick(ineligibleReasonAliases) || "").trim() : undefined;
        let voteEligible = existingEligibility.eligible === false ? false : true;
        if (importedEligible !== null) voteEligible = importedEligible;
        const reason = importedReason !== undefined ? importedReason : String(existingEligibility.reason || "").trim();

        if (voteEligible) {
          delete nextEligibility[lot];
        } else {
          nextEligibility[lot] = {
            eligible: false,
            reason,
            updatedAt: todayLabel(),
          };
        }
        touchedEligibilityLots.add(lot);
      }
    });

    touchedVoteLots.forEach((lot) => {
      if (nextVoteLedger[lot]) store.set(`vote_${lot}`, nextVoteLedger[lot]);
      else store.del(`vote_${lot}`);
    });

    setVoteLedger(nextVoteLedger);
    setVotes(recomputeVotesFromLedger(nextVoteLedger));
    setOwnerActivity(nextOwnerActivity);
    setPrimaryVoterRegistry(nextPrimaryRegistry);
    setOutreachState(nextOutreach);
    setEligibilityState(nextEligibility);

    return {
      message: `Imported ${rows.length} rows (${recognizedLots} recognized lots). Updated ${touchedVoteLots.size} lot vote records, ${touchedEligibilityLots.size} eligibility records, and outreach/owner fields where provided.`,
    };
  };

  const buildPortalBackupPayload = async () => {
    const covenantAssetRecords = await listCovenantAssetRecords().catch(() => []);
    return {
      backupType: PORTAL_BACKUP_TYPE,
      version: PORTAL_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      payload: {
        fw_user: user,
        fw_votes: votes,
        fw_comments: comments,
        fw_comments_data_version: COMMENTS_DATA_VERSION,
        fw_covenant_docs: covenantDocs,
        fw_owner_activity: ownerActivity,
        fw_vote_ledger: voteLedger,
        fw_primary_voter_registry: primaryVoterRegistry,
        fw_primary_voter_transfer_audit: primaryVoterTransferAudit,
        fw_outreach_state: outreachState,
        fw_user_directory: userDirectory,
        fw_admin_access_entries: adminAccessEntries,
        fw_admin_access_grades: adminAccessGrades,
        fw_total_lots: totalLots,
        fw_vote_eligibility: eligibilityState,
        fw_last_backup_export_at: lastBackupExportAt || null,
        fw_backup_health_threshold_days: backupHealthThresholdDays,
        legacy_vote_entries: collectLegacyVoteEntries(),
        covenant_asset_records: covenantAssetRecords,
      },
    };
  };

  const handleExportBackup = async () => {
    const backup = await buildPortalBackupPayload();

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fw-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return {
      message: `Full backup exported (${Object.keys(voteLedger || {}).length} vote records, ${comments.length} comments, ${covenantAssetRecords.length} stored covenant attachments).`,
    };
  };

  const handleRestoreBackup = async (rawBackup, restoreOptions = {}) => {
    const candidate = rawBackup?.payload && typeof rawBackup.payload === "object" ? rawBackup.payload : rawBackup;
    if (!candidate || typeof candidate !== "object") {
      return { error: "Backup JSON format is invalid." };
    }
    if (rawBackup?.backupType && rawBackup.backupType !== PORTAL_BACKUP_TYPE) {
      return { error: `Unsupported backup type "${rawBackup.backupType}".` };
    }
    if (rawBackup?.version && Number(rawBackup.version) > PORTAL_BACKUP_VERSION) {
      return { error: `Backup version ${rawBackup.version} is newer than this portal supports.` };
    }
    const restoreMode =
      restoreOptions?.mode === "merge" || restoreOptions?.mode === "missing"
        ? restoreOptions.mode
        : "replace";
    const scopeFlags = normalizeRestoreScopes(restoreOptions?.scopes);
    if (!hasSelectedRestoreScope(scopeFlags)) {
      return { error: "Select at least one section to restore." };
    }

    const sanitizeObj = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
    const mergeObjectState = (currentState, incomingState) => {
      if (restoreMode === "replace") return sanitizeObj(incomingState);
      if (restoreMode === "merge") return { ...sanitizeObj(currentState), ...sanitizeObj(incomingState) };
      const current = { ...sanitizeObj(currentState) };
      const incoming = sanitizeObj(incomingState);
      Object.entries(incoming).forEach(([key, value]) => {
        const existing = current[key];
        const isMissing = existing === undefined || existing === null || existing === "";
        if (isMissing) current[key] = value;
      });
      return current;
    };

    const parsedTotalLots = Number(candidate.fw_total_lots);
    const restoredTotalLots =
      Number.isInteger(parsedTotalLots) && parsedTotalLots >= MIN_TOTAL_LOTS && parsedTotalLots <= MAX_TOTAL_LOTS
        ? parsedTotalLots
        : totalLots;
    const parsedThreshold = Number(candidate.fw_backup_health_threshold_days);
    const restoredThreshold =
      Number.isInteger(parsedThreshold)
      && parsedThreshold >= MIN_BACKUP_HEALTH_MAX_AGE_DAYS
      && parsedThreshold <= MAX_BACKUP_HEALTH_MAX_AGE_DAYS
        ? parsedThreshold
        : backupHealthThresholdDays;
    const nextTotalLots = scopeFlags.lotSettings ? restoredTotalLots : totalLots;
    const nextLotLabels = buildLotLabels(nextTotalLots);
    const nextLotSet = new Set(nextLotLabels);

    const importedLedgerRaw = sanitizeObj(candidate.fw_vote_ledger);
    const importedVoteLedger = {};
    Object.entries(importedLedgerRaw).forEach(([lotLabel, choice]) => {
      const normalizedLot = normalizeLotLabel(lotLabel);
      if (!normalizedLot || !nextLotSet.has(normalizedLot)) return;
      if (!VALID_VOTE_CHOICES.has(choice)) return;
      importedVoteLedger[normalizedLot] = choice;
    });
    const currentVoteLedgerForScope = {};
    Object.entries(sanitizeObj(voteLedger)).forEach(([lotLabel, choice]) => {
      const normalizedLot = normalizeLotLabel(lotLabel);
      if (!normalizedLot || !nextLotSet.has(normalizedLot)) return;
      if (!VALID_VOTE_CHOICES.has(choice)) return;
      currentVoteLedgerForScope[normalizedLot] = choice;
    });
    const nextVoteLedger =
      scopeFlags.votes
        ? (() => {
            if (restoreMode === "replace") return importedVoteLedger;
            if (restoreMode === "merge") return { ...currentVoteLedgerForScope, ...importedVoteLedger };
            const merged = { ...currentVoteLedgerForScope };
            Object.entries(importedVoteLedger).forEach(([lotLabel, choice]) => {
              if (!merged[lotLabel]) merged[lotLabel] = choice;
            });
            return merged;
          })()
        : currentVoteLedgerForScope;

    if (scopeFlags.votes) {
      const importedLegacyVotes = sanitizeObj(candidate.legacy_vote_entries);
      if (restoreMode === "replace") {
        clearLegacyVoteEntries();
      }
      Object.entries(importedLegacyVotes).forEach(([key, choice]) => {
        if (!String(key).startsWith("vote_")) return;
        if (!VALID_VOTE_CHOICES.has(choice)) return;
        if (restoreMode === "missing" && store.get(key)) return;
        store.set(key, choice);
      });
      Object.entries(nextVoteLedger).forEach(([lotLabel, choice]) => {
        store.set(`vote_${lotLabel}`, choice);
      });
    }

    const importedComments = Array.isArray(candidate.fw_comments) ? candidate.fw_comments : [];
    const nextComments =
      scopeFlags.comments
        ? (restoreMode === "replace" ? importedComments : mergeCommentsBySignature(comments, importedComments))
        : comments;

    const importedCovenantDocs = Array.isArray(candidate.fw_covenant_docs) ? candidate.fw_covenant_docs : [];
    const nextCovenantDocsRaw =
      scopeFlags.covenantDocs
        ? (restoreMode === "replace" ? importedCovenantDocs : mergeCovenantDocsById(covenantDocs, importedCovenantDocs))
        : covenantDocs;
    const nextCovenantDocs = consolidateCovenantDocs(nextCovenantDocsRaw).docs;

    const nextOwnerActivity = scopeFlags.ownerActivity
      ? mergeObjectState(ownerActivity, candidate.fw_owner_activity)
      : ownerActivity;
    const nextPrimaryRegistry = scopeFlags.primaryVoters
      ? mergeObjectState(primaryVoterRegistry, candidate.fw_primary_voter_registry)
      : primaryVoterRegistry;
    const importedTransferAudit = normalizePrimaryVoterTransferAuditEntries(candidate.fw_primary_voter_transfer_audit);
    const nextPrimaryTransferAudit = scopeFlags.primaryVoters
      ? (
        restoreMode === "replace"
          ? importedTransferAudit
          : mergePrimaryVoterTransferAuditEntries(primaryVoterTransferAudit, importedTransferAudit)
      )
      : primaryVoterTransferAudit;
    const nextOutreach = scopeFlags.outreach
      ? mergeObjectState(outreachState, candidate.fw_outreach_state)
      : outreachState;
    const nextUserDirectory = scopeFlags.userDirectory
      ? mergeObjectState(userDirectory, candidate.fw_user_directory)
      : userDirectory;
    const nextEligibility = scopeFlags.eligibility
      ? mergeObjectState(eligibilityState, candidate.fw_vote_eligibility)
      : eligibilityState;
    const nextAdminEntries = normalizeAdminAccessEntries(candidate.fw_admin_access_entries);
    const effectiveAdminEntries = scopeFlags.adminAccess
      ? (() => {
          if (restoreMode === "merge" || restoreMode === "missing") {
            const mergedEntries = normalizeAdminAccessEntries([...adminAccessEntries, ...nextAdminEntries]);
            return mergedEntries.length > 0 ? mergedEntries : adminAccessEntries;
          }
          return nextAdminEntries.length > 0 ? nextAdminEntries : adminAccessEntries;
        })()
      : adminAccessEntries;
    const nextAdminGrades = scopeFlags.adminAccess
      ? mergeObjectState(adminAccessGrades, candidate.fw_admin_access_grades)
      : adminAccessGrades;
    const restoredAssets = Array.isArray(candidate.covenant_asset_records) ? candidate.covenant_asset_records : [];
    if (scopeFlags.covenantFiles) {
      if (restoreMode === "merge" || restoreMode === "missing") {
        const existingAssets = await listCovenantAssetRecords().catch(() => []);
        const assetMap = new Map();
        existingAssets.forEach((record) => assetMap.set(record.id, record));
        restoredAssets.forEach((record) => {
          const id = String(record?.id || "").trim();
          if (!id) return;
          if (restoreMode === "missing" && assetMap.has(id)) return;
          assetMap.set(id, record);
        });
        await replaceCovenantAssetRecords(Array.from(assetMap.values()));
      } else {
        await replaceCovenantAssetRecords(restoredAssets);
      }
    }

    if (scopeFlags.lotSettings) {
      setTotalLots(nextTotalLots);
      setBackupHealthThresholdDays(restoredThreshold);
    }
    if (scopeFlags.votes) setVoteLedger(nextVoteLedger);
    setVotes(computeVoteTotalsFromLedger(nextVoteLedger, nextLotLabels));
    if (scopeFlags.comments) {
      setComments(nextComments);
      store.set("fw_comments_data_version", COMMENTS_DATA_VERSION);
    }
    if (scopeFlags.covenantDocs) setCovenantDocs(nextCovenantDocs);
    if (scopeFlags.ownerActivity) setOwnerActivity(nextOwnerActivity);
    if (scopeFlags.primaryVoters) {
      setPrimaryVoterRegistry(nextPrimaryRegistry);
      setPrimaryVoterTransferAudit(nextPrimaryTransferAudit);
    }
    if (scopeFlags.outreach) setOutreachState(nextOutreach);
    if (scopeFlags.userDirectory) setUserDirectory(nextUserDirectory);
    if (scopeFlags.eligibility) setEligibilityState(nextEligibility);
    if (scopeFlags.adminAccess) {
      setAdminAccessEntries(effectiveAdminEntries);
      setAdminAccessGrades(nextAdminGrades);
    }

    const restoredUserRaw = candidate.fw_user;
    const restoredUser =
      scopeFlags.sessionUser && restoredUserRaw && typeof restoredUserRaw === "object"
        ? (() => {
            const lots = normalizeUserLots(restoredUserRaw);
            const hasAdminApproval = isAdminUserAllowed(restoredUserRaw.name, effectiveAdminEntries);
            const requestedAdmin = !!restoredUserRaw.isAdmin || (lots.length === 1 && lots[0] === "ADMIN");
            if (requestedAdmin && !hasAdminApproval) return null;
            if (!hasAdminApproval && lots.length === 0) return null;
            const isAdmin = hasAdminApproval || requestedAdmin;
            const effectiveLots = isAdmin ? ["ADMIN"] : lots;
            return {
              ...restoredUserRaw,
              isAdmin,
              accessRole: isAdmin ? ACCESS_ROLES.primary : normalizeAccessRole(restoredUserRaw.accessRole),
              userId: restoredUserRaw.userId || generateUserId(restoredUserRaw.name),
              lots: effectiveLots,
              lot: isAdmin ? "ADMIN" : effectiveLots.length === 1 ? effectiveLots[0] : effectiveLots.join(", "),
            };
          })()
        : user;
    if (scopeFlags.sessionUser) {
      store.set("fw_user", restoredUser);
      setUser(restoredUser);
      setPage(restoredUser?.isAdmin ? "admin-votes" : "home");
      if (candidate.fw_last_backup_export_at && !Number.isNaN(Date.parse(String(candidate.fw_last_backup_export_at)))) {
        setLastBackupExportAt(new Date(String(candidate.fw_last_backup_export_at)).toISOString());
      }
    }
    const appliedScopeLabels = BACKUP_RESTORE_SCOPE_OPTIONS
      .filter((scope) => scopeFlags[scope.key] !== false)
      .map((scope) => scope.label);

    return {
      message: `Backup restored (${restoreMode}): ${appliedScopeLabels.join(", ")}. Vote records now ${Object.keys(nextVoteLedger).length}; comments ${nextComments.length}.`,
    };
  };

  const handleRecordBackupExport = (isoTimestamp = new Date().toISOString()) => {
    const safeIso = String(isoTimestamp || "").trim();
    const parsed = Date.parse(safeIso);
    if (Number.isNaN(parsed)) return;
    setLastBackupExportAt(new Date(parsed).toISOString());
  };

  const handleUpdateBackupHealthThresholdDays = (nextDays) => {
    const parsed = Number.parseInt(String(nextDays || "").trim(), 10);
    if (
      Number.isNaN(parsed)
      || parsed < MIN_BACKUP_HEALTH_MAX_AGE_DAYS
      || parsed > MAX_BACKUP_HEALTH_MAX_AGE_DAYS
    ) {
      return {
        error: `Backup threshold must be between ${MIN_BACKUP_HEALTH_MAX_AGE_DAYS} and ${MAX_BACKUP_HEALTH_MAX_AGE_DAYS} days.`,
      };
    }
    setBackupHealthThresholdDays(parsed);
    return { message: `Backup health threshold set to ${parsed} days.` };
  };

  const handleUpdateDbApiBaseUrl = (nextUrl = "") => {
    const normalized = sanitizeDbApiBaseUrl(nextUrl, { allowEmpty: true });
    if (normalized.error) {
      return { error: normalized.error };
    }
    setDbApiBaseUrl(normalized.value);
    return {
      value: normalized.value,
      message: normalized.value
        ? "Database API URL updated."
        : "Database API URL cleared (same-origin /api will be used).",
    };
  };

  const resolveDbApiUrl = (path) => {
    const safePath = String(path || "");
    const base = String(dbApiBaseUrl || "").trim();
    if (!base) return safePath;
    return `${base.replace(/\/+$/, "")}${safePath}`;
  };

  const callDbApi = async (path, options = {}) => {
    const requestUrl = resolveDbApiUrl(path);
    let response;
    try {
      response = await fetch(requestUrl, {
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
        ...options,
      });
    } catch (error) {
      const message = error?.message || "Failed to fetch";
      throw new Error(
        `Could not reach Database API (${message}). confirm the API server is running; verify the saved API URL is reachable from this browser; the page is HTTPS and cannot call an HTTP API URL (mixed content); use an HTTPS API URL or open the portal over HTTP; localhost points to this browser machine; if your API runs elsewhere, replace localhost with that host. Request URL: ${requestUrl}`
      );
    }
    const text = await response.text();
    let parsed = {};
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = {};
    }
    if (!response.ok || parsed?.ok === false) {
      if (parsed?.error) {
        throw new Error(parsed.error);
      }
      if (response.status === 404) {
        throw new Error(
          `Database API request failed (404). Check that the saved API URL is only the API host (example: http://localhost:8787), not a command, and that the server is running. Request URL: ${requestUrl}`
        );
      }
      throw new Error(`Database API request failed (${response.status}). Request URL: ${requestUrl}`);
    }
    return parsed;
  };

  const handleTestDbConnection = async () => {
    const result = await callDbApi("/api/db/health", { method: "GET" });
    return {
      message: `Connected to PostgreSQL API. Server time: ${result?.now || "unknown"}`,
    };
  };

  const handleSyncToDb = async ({ mode = "replace", scopes = defaultBackupRestoreScopes() } = {}) => {
    const backup = await buildPortalBackupPayload();
    const result = await callDbApi("/api/db/sync", {
      method: "POST",
      body: JSON.stringify({
        backup,
        mode,
        scopes,
      }),
    });
    const syncedAt = new Date().toISOString();
    setLastDbSyncAt(syncedAt);
    return {
      syncedAt,
      message: result?.message || `PostgreSQL sync completed at ${formatIsoDateTime(syncedAt)}.`,
    };
  };

  const handleRestoreFromDb = async ({ mode = "replace", scopes = defaultBackupRestoreScopes() } = {}) => {
    const result = await callDbApi("/api/db/export", {
      method: "POST",
      body: JSON.stringify({}),
    });
    return handleRestoreBackup(result?.backup || {}, { mode, scopes });
  };

  const handleFetchDbSummary = async () => {
    const result = await callDbApi("/api/db/summary", { method: "GET" });
    return { summary: result?.summary || null };
  };

  const handleFetchDbRecords = async (table, limit = 200, offset = 0) => {
    const safeTable = encodeURIComponent(String(table || "state_values"));
    const result = await callDbApi(`/api/db/records/${safeTable}?limit=${Number(limit) || 200}&offset=${Number(offset) || 0}`, {
      method: "GET",
    });
    return { records: Array.isArray(result?.records) ? result.records : [] };
  };

  const handleRefreshSharedData = async ({ silent = false, mode = "merge" } = {}) => {
    if (!dbApiBaseUrl) {
      return { error: "Database API URL is not configured for this device." };
    }
    const scopes = {
      ...defaultBackupRestoreScopes(),
      sessionUser: false,
    };
    if (!silent) {
      setSharedDataErr("");
      setSharedDataMsg("");
      setSharedDataBusy(true);
    }
    try {
      const result = await handleRestoreFromDb({ mode, scopes });
      if (result?.error) {
        if (!silent) setSharedDataErr(result.error);
        return result;
      }
      if (!silent) {
        setSharedDataMsg(result?.message || "Shared portal data refreshed from PostgreSQL.");
        setTimeout(() => setSharedDataMsg(""), 5000);
      }
      return {
        message: result?.message || "Shared portal data refreshed from PostgreSQL.",
      };
    } catch (error) {
      if (!silent) setSharedDataErr(error?.message || "Could not refresh shared data from PostgreSQL.");
      return { error: error?.message || "Could not refresh shared data from PostgreSQL." };
    } finally {
      if (!silent) setSharedDataBusy(false);
    }
  };

  useEffect(() => {
    if (!user || !dbApiBaseUrl) return;
    let cancelled = false;
    (async () => {
      const result = await handleRefreshSharedData({ silent: true, mode: "merge" });
      if (cancelled) return;
      if (result?.error) {
        setSharedDataErr(result.error);
      }
    })();
    return () => { cancelled = true; };
  }, [dbApiBaseUrl, user?.userId]);

  const handleRunDbChecklist = async () => {
    const checkedAt = new Date().toISOString();
    const buildLastSyncRow = () => ({
      key: "lastSync",
      label: "Last DB sync",
      status: lastDbSyncAt ? "pass" : "warn",
      detail: lastDbSyncAt
        ? `Last successful sync: ${formatIsoDateTime(lastDbSyncAt)}`
        : "No successful sync recorded yet. Use \"Sync current portal to PostgreSQL\" after connection passes.",
    });

    const rows = [
      { key: "api", label: "API reachable", status: "unknown", detail: "Checking API health endpoint..." },
      { key: "browser", label: "Browser/CORS access", status: "unknown", detail: "Checking browser access from this page origin..." },
      { key: "schema", label: "DB schema ready", status: "unknown", detail: "Checking schema summary endpoint..." },
      buildLastSyncRow(),
    ];

    try {
      const health = await callDbApi("/api/db/health", { method: "GET" });
      rows[0] = {
        key: "api",
        label: "API reachable",
        status: "pass",
        detail: `Health endpoint responded. Server time: ${health?.now || "unknown"}.`,
      };
      rows[1] = {
        key: "browser",
        label: "Browser/CORS access",
        status: "pass",
        detail: "Browser request succeeded from this portal origin.",
      };
    } catch (error) {
      const message = error?.message || "Could not reach API.";
      rows[0] = { key: "api", label: "API reachable", status: "fail", detail: message };
      rows[1] = { key: "browser", label: "Browser/CORS access", status: "fail", detail: message };
      rows[2] = {
        key: "schema",
        label: "DB schema ready",
        status: "warn",
        detail: "Skipped because API/CORS check failed.",
      };
      return {
        checklist: { checkedAt, rows },
        message: "Checklist completed with blockers.",
      };
    }

    try {
      const summaryResult = await callDbApi("/api/db/summary", { method: "GET" });
      const summary = summaryResult?.summary || {};
      rows[2] = {
        key: "schema",
        label: "DB schema ready",
        status: "pass",
        detail: `Summary loaded: ${summary.state_values || 0} state keys, ${summary.covenant_assets || 0} covenant assets, ${summary.backup_snapshots || 0} snapshots.`,
      };
    } catch (error) {
      rows[2] = {
        key: "schema",
        label: "DB schema ready",
        status: "fail",
        detail: error?.message || "Schema summary request failed.",
      };
    }

    rows[3] = buildLastSyncRow();
    return {
      checklist: { checkedAt, rows },
      message: "Checklist completed.",
    };
  };

  const activityRows = Object.values(ownerActivity);
  const votedLotsFromLedger = allLotLabels.filter((lot) => !!(voteLedger[lot] || store.get(`vote_${lot}`))).length;
  const commentedLotsFromActivity = allLotLabels.filter((lot) => !!ownerActivity?.[lot]?.commented).length;
  const contactedLotsFromOutreach = allLotLabels.filter((lot) => !!outreachState?.[lot]?.contacted).length;
  const nonEligibleLotsCount = allLotLabels.filter((lot) => eligibilityState?.[lot]?.eligible === false).length;
  const nonEligibleVotedLotsCount = allLotLabels.filter(
    (lot) => eligibilityState?.[lot]?.eligible === false && !!(voteLedger[lot] || store.get(`vote_${lot}`))
  ).length;
  const stats = {
    loggedInLots: activityRows.length,
    commentedLots: commentedLotsFromActivity,
    votedLots: votedLotsFromLedger,
  };
  const operationalStats = {
    contactedLots: contactedLotsFromOutreach,
    uncontactedLots: Math.max(totalLots - contactedLotsFromOutreach, 0),
    votedLots: votedLotsFromLedger,
    nonEligibleLots: nonEligibleLotsCount,
    nonEligibleVotedLots: nonEligibleVotedLotsCount,
  };

  if (!user) return <LoginScreen onLogin={handleLogin} adminAccessEntries={adminAccessEntries}/>;

  const navItems = [
    { id:"home", label:"Overview", icon:<Icon.home/> },
    { id:"documents", label:"CC&R Documents", icon:<Icon.doc/> },
    { id:"comparison", label:"Side-by-side compare", icon:<Icon.compare/> },
    { id:"proposed", label:"Proposed One CC&R", icon:<Icon.star/> },
    { id:"risks", label:"Risks of inaction", icon:<Icon.home2/> },
    { id:"str", label:"STR & Unified CC&R vote", icon:<Icon.vote/> },
    ...(!user.isAdmin ? [{ id:"profile", label:"My profile", icon:<Icon.user/> }] : []),
    { id:"comments", label:"Community comments", icon:<Icon.chat/> },
    { id:"dashboard", label:"Dashboard", icon:<Icon.dash/> },
    ...(user.isAdmin ? [{ id:"admin-votes", label:"Admin voting roster", icon:<Icon.vote/> }] : []),
    ...(user.isAdmin ? [{ id:"admin-docs", label:"Admin document tools", icon:<Icon.doc/> }] : []),
  ];

  const pageTitles = {
    home:"Overview",
    documents:"CC&R Documents",
    comparison:"Side-by-side comparison",
    proposed:"Proposed One Community CC&R",
    risks:"Risks of inaction",
    str:"STR & Unified CC&R vote",
    profile:"Resident profile",
    comments:"Community comments",
    dashboard:"Campaign dashboard",
    "admin-votes":"Admin voting roster",
    "admin-docs":"Admin document upload",
  };
  const isMobile = viewportWidth <= MOBILE_BREAKPOINT_PX;
  const appStyle = {
    ...S.app,
    flexDirection: isMobile ? "column" : "row",
  };
  const sidebarStyle = isMobile
    ? {
        ...S.sidebar,
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        width: 260,
        zIndex: 40,
        transform: mobileNavOpen ? "translateX(0)" : "translateX(-110%)",
        transition: "transform 180ms ease",
        boxShadow: mobileNavOpen ? "0 14px 30px rgba(0,0,0,0.28)" : "none",
      }
    : S.sidebar;
  const topbarStyle = {
    ...S.topbar,
    padding: isMobile ? "12px 14px" : S.topbar.padding,
    flexWrap: isMobile ? "wrap" : "nowrap",
    rowGap: isMobile ? 8 : 0,
  };
  const topbarMetaStyle = {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    width: isMobile ? "100%" : "auto",
  };
  const contentStyle = {
    ...S.content,
    padding: isMobile ? "16px 12px 24px" : S.content.padding,
    maxWidth: isMobile ? "100%" : S.content.maxWidth,
  };
  const closeMobileNav = () => setMobileNavOpen(false);
  const navigateToPage = (nextPage) => {
    setPage(nextPage);
    closeMobileNav();
  };

  return (
    <div style={appStyle}>
      {isMobile && mobileNavOpen && (
        <button
          type="button"
          onClick={closeMobileNav}
          aria-label="Close menu overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            border: "none",
            zIndex: 30,
            cursor: "pointer",
          }}
        />
      )}
      <div style={sidebarStyle}>
        <div style={S.sidebarTop}>
          <div style={S.sidebarLogo}>Falling Waters</div>
          <div style={S.sidebarSub}>Covenant Unification</div>
        </div>
        <div style={S.sidebarUser}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}><Icon.user/><span>{user.name}</span></div>
          <div style={{ marginTop:2, opacity:.7 }}>{getUserLotDisplay(user)}{user.isAdmin ? " · Admin" : ""}</div>
          {!user.isAdmin && <div style={{ marginTop:2, opacity:.7 }}>{accessRoleLabel(user.accessRole)}</div>}
          <div style={{ marginTop: 8 }}>
            <span
              style={S.badge(
                user.isAdmin ? C.amber : C.forest,
                user.isAdmin ? C.amberLight : C.parchmentDark
              )}
            >
              {user.isAdmin ? "Admin control mode" : "Resident portal mode"}
            </span>
          </div>
        </div>
        <nav style={S.sidebarNav}>
          {navItems.map(item => (
            <div key={item.id} style={S.navItem(page===item.id)} onClick={() => navigateToPage(item.id)}>
              {item.icon}{item.label}
            </div>
          ))}
        </nav>
        <div style={S.sidebarBottom}>
          <div
            style={{ cursor:"pointer", display:"flex", alignItems:"center", gap:8, fontSize:13, color:"rgba(255,255,255,0.5)" }}
            onClick={() => {
              closeMobileNav();
              handleLogout();
            }}
          >
            <Icon.logout/> Sign out
          </div>
        </div>
      </div>

      <div style={S.main}>
        <div style={topbarStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {isMobile && (
              <button
                type="button"
                style={{ ...S.btn("outline"), padding: "6px 9px" }}
                onClick={() => setMobileNavOpen((prev) => !prev)}
                aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
              >
                {mobileNavOpen ? <Icon.close/> : <Icon.menu/>}
              </button>
            )}
            <div style={{ ...S.topbarTitle, fontSize: isMobile ? 18 : S.topbarTitle.fontSize }}>{pageTitles[page]}</div>
          </div>
          <div style={topbarMetaStyle}>
            <span style={{ fontSize:12, color:C.muted }}>Need {votesNeeded} votes ·</span>
            <span style={{ fontSize:12, fontWeight:700, color:C.danger }}>{votes.eliminate} votes to eliminate STRs so far</span>
            <button
              style={{ ...S.btn("outline"), padding: "7px 10px" }}
              onClick={() => handleRefreshSharedData({ silent: false, mode: "merge" })}
              disabled={sharedDataBusy}
            >
              {sharedDataBusy ? "Refreshing…" : "Refresh shared data"}
            </button>
            {page !== "str" && <button style={S.btn("stone")} onClick={() => setPage("str")}>STR & Unified CC&R vote →</button>}
          </div>
        </div>
        <div style={contentStyle}>
          {sharedDataErr && (
            <div style={S.alert("danger")}>
              <strong>Shared data sync issue:</strong> {sharedDataErr}
            </div>
          )}
          {sharedDataMsg && (
            <div style={S.alert("success")}>
              {sharedDataMsg}
            </div>
          )}
          {user.isAdmin && (
            <div style={S.alert("warn")}>
              <strong>Admin Control Mode active:</strong> You have access to admin roster tools, lot-count settings, eligibility controls, CSV import/export, and full JSON backup/restore.
            </div>
          )}
          {page === "home" && <HomePage votes={votes} stats={stats} totalLots={totalLots} votesNeeded={votesNeeded}/>}
          {page === "documents" && <DocumentsPage docs={covenantDocs}/>}
          {page === "comparison" && <ComparisonPage/>}
          {page === "proposed" && <ProposedCovenantPage/>}
          {page === "risks" && <RisksPage/>}
          {page === "str" && <STRPage user={user} votes={votes} voteLedger={voteLedger} onVote={handleVote} totalLots={totalLots} votesNeeded={votesNeeded}/>}
          {page === "profile" && !user.isAdmin && <ProfilePage user={user} voteLedger={voteLedger} onUpdateProfile={handleUpdateProfile}/>}
          {page === "comments" && <CommentsPage user={user} comments={comments} onAdd={handleAddComment} onUpdate={handleUpdateComment}/>}
          {page === "dashboard" && (
            <DashboardPage
              votes={votes}
              comments={comments}
              stats={stats}
              totalLots={totalLots}
              votesNeeded={votesNeeded}
              operationalStats={operationalStats}
            />
          )}
          {page === "admin-votes" && user.isAdmin && (
            <AdminVotingPage
              comments={comments}
              ownerActivity={ownerActivity}
              voteLedger={voteLedger}
              primaryVoterRegistry={primaryVoterRegistry}
              primaryVoterTransferAudit={primaryVoterTransferAudit}
              outreachState={outreachState}
              eligibilityState={eligibilityState}
              userDirectory={userDirectory}
              adminAccessEntries={adminAccessEntries}
              adminAccessGrades={adminAccessGrades}
              totalLots={totalLots}
              votesNeeded={votesNeeded}
              isMobile={isMobile}
              lastBackupExportAt={lastBackupExportAt}
              backupHealthThresholdDays={backupHealthThresholdDays}
              dbApiBaseUrl={dbApiBaseUrl}
              lastDbSyncAt={lastDbSyncAt}
              onImportCsv={handleImportCsv}
              onExportBackup={handleExportBackup}
              onRestoreBackup={handleRestoreBackup}
              onRecordBackupExport={handleRecordBackupExport}
              onUpdateBackupHealthThresholdDays={handleUpdateBackupHealthThresholdDays}
              onUpdateDbApiBaseUrl={handleUpdateDbApiBaseUrl}
              onTestDbConnection={handleTestDbConnection}
              onSyncToDb={handleSyncToDb}
              onRestoreFromDb={handleRestoreFromDb}
              onFetchDbSummary={handleFetchDbSummary}
              onFetchDbRecords={handleFetchDbRecords}
              onRunDbChecklist={handleRunDbChecklist}
              onUpdateEligibility={handleUpdateEligibility}
              onUpdateTotalLots={handleUpdateTotalLots}
              onSetAdminAccessGrade={handleSetAdminAccessGrade}
              onGrantAdminAccess={handleGrantAdminAccess}
              onRevokeAdminAccess={handleRevokeAdminAccess}
              onTransferPrimaryVoter={handleTransferPrimaryVoter}
            />
          )}
          {page === "admin-docs" && user.isAdmin && (
            <AdminDocumentsPage
              user={user}
              docs={covenantDocs}
              onAddDocument={handleAddDocument}
              onDeleteDocument={handleDeleteDocument}
              onConsolidateDocuments={handleConsolidateDocuments}
            />
          )}
        </div>
      </div>
    </div>
  );
}
