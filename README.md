# FALLING-WATERS-ONE-COMMUNITY-COVENANTS

Falling Waters One Community Covenants portal.

## Run the portal (frontend)

```bash
npm install
npm run build
```

Open `index.html` in your browser (or serve the folder with any static host).

## Mobile + iPhone readiness (Phase 1)

The portal now includes:
- responsive app shell for small screens (mobile nav menu + adaptive layout grids)
- Progressive Web App (PWA) support via:
  - `manifest.webmanifest`
  - `service-worker.js`
  - app icons (`pwa-icon.svg`, `maskable-icon.svg`)

On iPhone, open the portal in Safari and use **Share → Add to Home Screen**.

## Mobile + iPhone readiness (Phase 2)

Additional mobile polish now includes:
- iPhone-friendly form control sizing (16px inputs/selects to prevent Safari zoom-on-focus)
- touch-optimized button sizing
- admin lot roster mobile cards (replaces wide table on small screens)
- mobile-friendly filter controls and search behavior in admin roster

## PostgreSQL activation (all three steps)

This repo now includes a PostgreSQL API so the portal can:
- persist records in Postgres,
- restore missing/selective/full data from Postgres,
- and let admins inspect database records from the admin UI.

### 1) Start PostgreSQL backend host

Set environment values (see `.env.example`), then run:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/falling_waters_portal"
# optional: export PGSSLMODE=require
npm run server
```

The API starts on `http://localhost:8787` by default.

### 2) Connect credentials / API URL in admin

In **Admin voting roster** → **PostgreSQL sync, restore, and record viewer**:
- set **Database API base URL** (`http://localhost:8787`),
- click **Save URL**,
- click **Test connection**.

If your frontend and API are same-origin, leave URL blank and use `/api` routes directly.

> If your portal is hosted on GitHub Pages (HTTPS), do **not** use `http://localhost:8787`.
> Use a hosted **HTTPS** API URL instead (for example Render).

### 3) One-time migration import from latest full backup JSON

Use either migration path:

- **Direct**: click **Sync current portal to PostgreSQL** (pushes current browser state to DB).
- **From backup file**:
  1. Restore the latest JSON backup into the portal.
  2. Click **Sync current portal to PostgreSQL**.

The server writes a snapshot entry every sync.

## Restore options now available

From the admin UI:
- **Replace selected sections**: overwrite selected scopes.
- **Merge selected sections**: keep existing + overlay incoming records.
- **Restore missing values only**: only fill blanks / absent records.

Scopes are selectable (votes, comments, admin access, docs, covenant files, etc.).

## Database record viewer

In the same admin card:
- **Load DB summary** shows record counts by scope.
- choose a table/scope and click **Load records** to inspect rows.

Server endpoints:
- `GET /api/db/health`
- `GET /api/db/alert-status`
- `GET /api/db/scopes`
- `GET /api/db/summary`
- `GET /api/db/records/:table`
- `POST /api/db/sync`
- `POST /api/db/export`

## Database alerting endpoint

Use `GET /api/db/alert-status` for monitoring and alerts.

Response includes:
- overall `status` (`pass`, `warn`, or `fail`)
- per-check results (connection, sync freshness, minimum row checks)
- metrics and threshold values

Query options:
- `strict=true` (or `strict=1`) returns HTTP `503` when status is `warn`/`fail`
  - Useful for uptime monitors that alert on non-200 responses.

Example:

```bash
curl "https://falling-waters-postgres-api.onrender.com/api/db/alert-status?strict=true"
```

Alert thresholds are configurable by env vars:
- `ALERT_MAX_SYNC_AGE_MINUTES` (default `1440`)
- `ALERT_MIN_STATE_KEYS` (default `1`)
- `ALERT_MIN_SCOPE_RECORDS` (default `1`)

## Deploy backend to Render (recommended for GitHub Pages)

This repo includes `render.yaml` to deploy:
- a Node web service for the API
- a managed PostgreSQL database

### Deploy steps

1. Push latest repo changes to GitHub.
2. In Render, create a new **Blueprint** and select this repo.
3. Render will detect `render.yaml` and create:
   - `falling-waters-postgres-api` (web service)
   - `falling-waters-postgres` (PostgreSQL)
4. In the Render web service settings, set:
   - `ALLOWED_ORIGINS` = your portal origin(s), comma separated.
     - Example: `https://tbaggett1222.github.io`
   - (optional) tune alert thresholds:
     - `ALERT_MAX_SYNC_AGE_MINUTES=1440`
     - `ALERT_MIN_STATE_KEYS=1`
     - `ALERT_MIN_SCOPE_RECORDS=1`
5. Wait for deploy to finish.
6. Copy the Render service URL (example: `https://falling-waters-postgres-api.onrender.com`).
7. In portal admin, set **Database API base URL** to that HTTPS URL and test connection.

### First migration to hosted DB

After connecting the new HTTPS API URL:
1. Optionally restore your latest JSON backup into the portal UI.
2. Click **Sync current portal to PostgreSQL** once.
3. Click **Load DB summary** to confirm row counts.

### CORS note

If you change domains later (custom domain, staging URL, etc.), update `ALLOWED_ORIGINS` in Render so browsers can call the API.

### Monitoring recommendation

Create an external uptime monitor (UptimeRobot/Better Stack/etc.) for:

- `https://falling-waters-postgres-api.onrender.com/api/db/alert-status?strict=true`

This alerts on outages **and** stale/low-data conditions, not just basic uptime.

## Automated GitHub repository backups

This repo now includes `.github/workflows/repo-backup.yml`:
- runs nightly at **03:15 UTC**
- can also run on demand via **Actions → Repository backup → Run workflow**
- uploads backup artifacts (retained for 30 days)
- nightly schedule runs from the repository default branch (`main`), so merge this workflow to `main` to activate scheduled backups

Backup artifact contents:
- `*.bundle` (portable git bundle)
- `*-mirror-*.tar.gz` (full mirror archive)
- `SHA256SUMS.txt`
- `metadata.txt`

### Restore from a backup bundle

```bash
git clone /path/to/your-backup.bundle restored-repo
cd restored-repo
git log --oneline -n 5
```

### Restore from a mirror archive

```bash
tar -xzf FALLING-WATERS-ONE-COMMUNITY-COVENANTS-mirror-<timestamp>.tar.gz
git clone FALLING-WATERS-ONE-COMMUNITY-COVENANTS.git restored-repo
cd restored-repo
git log --oneline -n 5
```
