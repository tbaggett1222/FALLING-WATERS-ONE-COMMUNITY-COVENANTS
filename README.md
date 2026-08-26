# FALLING-WATERS-ONE-COMMUNITY-COVENANTS

Falling Waters One Community Covenants portal.

## Run the portal (frontend)

```bash
npm install
npm run build
```

Open `index.html` in your browser (or serve the folder with any static host).

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
- `GET /api/db/scopes`
- `GET /api/db/summary`
- `GET /api/db/records/:table`
- `POST /api/db/sync`
- `POST /api/db/export`
