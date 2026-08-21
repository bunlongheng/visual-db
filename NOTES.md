# Visual DB - project notes / handoff

Quick context so any session (or a new tab) can pick up without re-discovering everything.

## What it is
Point it at any Postgres table, get a clean self-contained HTML dashboard. It introspects
`information_schema`, auto-picks a chart per column, and renders KPIs + charts + a column-quality table.

## Where it lives
- Local: `~/Sites/visual-db`  (tab alias: `_visual_db`)
- Repo: github.com/bunlongheng/visual-db  (PUBLIC, MIT, released 2026-08-21)

## Two parts
1. **CLI** - `bin/dbchart <schema.table>` -> writes a one-shot offline HTML file. Python, no deps beyond `psql`.
2. **Web app** - `web/` - Next.js (App Router, TypeScript). Sidebar of every table, click one -> live dashboard.
   - `web/lib/classify.ts` - pure, unit-tested classification rules (type sets, `qi`/`ql`, `planColumn`). Single source of truth for "what chart does this column earn". `bin/dbchart` mirrors these same rules in Python (accepted trade: 2 runtimes, 1 rule set).
   - `web/lib/profiler.ts` - the profiler; imports `classify.ts`, runs the SQL, builds chart specs
   - `web/lib/db.ts` - single `pg` Pool from `process.env.DATABASE_URL`
   - `web/app/api/tables` and `web/app/api/profile` - the only 2 endpoints (no GraphQL - not needed)

## Quality gates (web/)
- `npm test` - vitest unit suite over `classify.ts` (20 tests: quoting/injection guard, histogram labels, chart-plan rules incl. the email-detection regression).
- `npm run lint` - eslint (flat config, `eslint-config-next/core-web-vitals`), 0 errors.
- `npm run typecheck` - `tsc --noEmit`.
- CI: `.github/workflows/ci.yml` runs lint + typecheck + test + build on push/PR.
- Security headers (CSP, X-Frame-Options DENY, nosniff, no-referrer) set in `next.config.ts` as defence-in-depth. API errors are logged server-side and return a generic message (no SQL/schema leak).

## How to run (LOCAL ONLY)
```bash
_visual_db                 # opens the tab, cd ~/Sites/visual-db
cd web
cp .env.example .env.local # then set DATABASE_URL=postgres://...
npm install
npm run dev                # http://localhost:3000
```
CLI: `DBCHART_URL=postgres://... dbchart public.mytable`

## Security - do NOT change without thought
- The CODE is public (open source, MIT). That is safe: no secrets in the repo or its history
  (gitleaks clean), `web/.env.local` is gitignored, `.env.example` is a placeholder only.
- HARD RULE (2026-08-21, owner): production NEVER connects to the real database. The real Linode
  DB (2026) is LOCAL-ONLY - only web/.env.local may hold its URL. Never put it in any Vercel env.
- DEPLOYED (2026-08-21): https://visual-db-bheng.vercel.app is a DEMO SANDBOX - it connects only
  to `visualdb_demo`, a synthetic 10-table database seeded by web/scripts/seed-demo.mjs
  (~93k rows: customers, orders, products, payments, subscriptions, page_views, reviews,
  support_tickets, employees, campaigns). Reseed: DEMO_DATABASE_URL=...visualdb_demo node scripts/seed-demo.mjs
- The `visualdb_demo` PG role is isolated at 2 layers: pg_hba only allows it into the
  visualdb_demo database (SSL required), and CONNECT on 2026/bheng_e2e/postgres is revoked from
  PUBLIC (granted explicitly to bheng, bheng_readonly, mindmaps_api). The role is also
  default_transaction_read_only with a 15s statement_timeout.
- Deploy gate: owner-only Google sign-in (Auth.js v5, ALLOWED_EMAILS=bheng.code@gmail.com) +
  VISUAL_DB_TOKEN for agents. Everything except /api/auth/* fails closed. Since the deployed DB
  is synthetic, the gate could be opened for public demo later - owner's call only.
- Local dev with no auth env stays open on localhost only, pointed at the real DB via .env.local.

## Status (2026-08-21)
- Builds clean; APIs verified; renders correctly. Manually tested on 4 tables (thryv.users 528,371 rows,
  public.visits, public.leads, public.portfolios).
- Fixed a profiler bug: email-domain over-detection (any `@` flipped a column to "email"). Now requires
  >=80% of values to be email-shaped. Fix applied to BOTH the CLI and the web profiler.
- Histograms now clamp to the 1-99 percentile so a single extreme outlier no longer flattens the chart
  (the old `logins_count` skew). Labelled "distribution (1-99 pct)" when clamped. Applied to CLI + web.
- Extracted the classifier into `web/lib/classify.ts` + added a 20-test vitest suite, eslint, typecheck,
  security headers, generic API errors, and CI. All gates green.

## Open items
- `logins_count`-style skew is handled via percentile clamping (log bucketing still an option if needed).
- Possible future rename: `visual-db` -> maybe `chat-db`. Use the `/rename-app` flow if so.
