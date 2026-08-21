# Visual DB

Point it at **any Postgres table** and get a clean, self-contained HTML dashboard - no config, no per-table code. Visual DB introspects the column types, picks the right chart for each one, and bakes everything (data + Chart.js) into a single `.html` file you can open offline, forever.

```bash
dbchart thryv.users
dbchart public.visits --url "postgres://user:pass@host:5432/mydb"
```

## Demo

The screenshots below show Visual DB profiling a **synthetic demo database** (generated fake data - no real records). Click any table in the sidebar and the full dashboard renders instantly - a completeness gauge, a calendar activity heatmap, category doughnuts, distribution histograms, a trend line, and a per-column quality table.

![Visual DB - full table dashboard with completeness gauge, activity heatmap, and charts](docs/screenshots/dashboard.png)

|  |  |
| --- | --- |
| ![Product profile - category and price distribution](docs/screenshots/products.png) | ![Subscription profile - domains, plan mix, and activity](docs/screenshots/subscriptions.png) |

## Why

## Architecture

```mermaid
flowchart TD
    U["User"] --> CLI["dbchart CLI - bin/dbchart"]
    U --> APP["Web UI - Next.js app in web/"]
    APP -->|"GET /api/tables"| TABLES["Tables API route - pg_stat_user_tables"]
    APP -->|"GET /api/profile"| PROFILE["Profile API route - 60s cache"]
    PROFILE --> PROFILER["lib/profiler + lib/classify - pick a chart per column"]
    TABLES --> PG[("Postgres")]
    PROFILER -->|"aggregation SQL"| PG
    CLI -->|"psql aggregation"| PG
    PROFILE --> CHART["Chart.js render in the browser"]
    CLI --> HTML["Self-contained HTML dashboard - Chart.js inlined"]
```

*2 entry points, 1 engine: the CLI bakes an offline HTML file while the web app profiles tables live via 2 API routes - both aggregate in Postgres and render with Chart.js.*


Every time you want to *see* a table you end up writing the same `GROUP BY` queries and wiring up charts by hand. Visual DB does it once, generically:

- **Reusable** - works on any table in any Postgres database. Nothing is hardcoded.
- **Self-contained** - the output HTML embeds its data and the charting library. No server, no internet, no DB needed to view it. Mail it, archive it, open it in 3 years.
- **Auto-profiling** - it reads `information_schema`, measures each column, and chooses a chart based on the type and cardinality.

## Install

```bash
git clone <this-repo> ~/Sites/visual-db
~/Sites/visual-db/install.sh      # symlinks bin/dbchart into ~/.local/bin
```

Requires `python3` and the `psql` client on your PATH.

## Usage

```bash
dbchart <schema.table> [options]

  --url URL     Postgres connection string (see resolution order below)
  --out FILE    output path (default: ~/Desktop/<schema.table>-dashboard.html)
  --top N       max categories per chart (default: 15)
  --no-open     don't auto-open the file in a browser
```

**Connection resolution** (first that works): `--url` → `$DBCHART_URL` → `$DATABASE_URL` → `DBCHART_URL`/`DATABASE_URL` in a `./.env` file.

## Web app

There is also a Next.js web app in `web/` - a live version with a sidebar of every table; click one to profile it instantly.

```bash
cd web
cp .env.example .env.local      # set DATABASE_URL=postgres://...
npm install
npm run dev                     # http://localhost:3000
```

Quality gates: `npm test` (vitest), `npm run lint`, `npm run typecheck`. CI runs all of them plus the build on every push.

## Security & deploying

**By default the web app has no authentication and serves every table read-only** - which is exactly what you want on your own machine. It is meant to run on `localhost`.

If you want to run it on a shared host, set a token so only you can reach it:

```bash
# in web/.env.local
VISUAL_DB_TOKEN=some-long-random-string
```

With a token set, every request is rejected unless it carries the token. Unlock a browser once by visiting `http://your-host/?token=some-long-random-string` (it is stored in an httpOnly cookie and stripped from the URL); API clients pass it as `Authorization: Bearer <token>`, an `x-visual-db-token` header, or `?token=`. Responses also carry a strict CSP and the standard hardening headers.

> Never expose the web app publicly without a token - it would let anyone browse the connected database.

Other configurable settings (see `web/.env.example`): `DATABASE_URL` / `DBCHART_URL` (connection), `PROFILE_CACHE_TTL_MS` (profile cache, default 60s).

## How it chooses charts

| Column type | Chart |
|-------------|-------|
| `timestamp` / `date` | line - records per month over time |
| `boolean` / low-cardinality text | doughnut (≤6 values) or bar |
| text with `@` (emails) | bar of top email domains |
| numeric, ≤25 distinct values | bar by value |
| numeric, many values | 10-bucket histogram |
| very skewed distributions | automatic log axis |

It also renders KPI tiles (rows, columns, overall fill rate, most-unique column, date span) and a **column-quality table** (type, distinct count, null % for every column).

Primary-key-like id columns and near-unique text columns are skipped as charts (they're noise) but still appear in the quality table.

## Output

One HTML file, ~220 KB, fully offline. All the data lives in a single `DATA` object at the top of an inline `<script>`; the charting library is inlined too. To retarget it at another table, just regenerate.

## Notes

- Postgres only for now (uses `information_schema` + `width_bucket`).
- Generated dashboards can contain real row data / PII - they are git-ignored by default. Don't commit them.

---

<p align="center">
  <sub>Built by <a href="https://bunlongheng.com">Bunlong Heng</a> &middot; <a href="https://bunlongheng.com/projects/visual-db">See it in my portfolio &rarr;</a></sub>
</p>
