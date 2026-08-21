# Visual DB - Web

Interactive Next.js version of the `dbchart` CLI. Point it at any Postgres
database and browse a self-updating, auto-charted profile of every table -
no server config, no separate API service.

## Setup

```bash
npm install
cp .env.example .env.local
```

Edit `.env.local` and set `DATABASE_URL` to your Postgres connection string:

```
DATABASE_URL=postgres://user:password@localhost:5432/dbname
```

## Run

```bash
npm run dev
```

Open http://localhost:3000, pick a table from the sidebar, and the
dashboard renders KPIs, auto-classified charts, and a column-quality table
for it.

## How it works

- `lib/db.ts` - a singleton `pg` Pool built from `DATABASE_URL`.
- `lib/profiler.ts` - a TypeScript port of the CLI's profiling logic:
  introspects columns, runs one meta-scan per table, classifies each column
  (time, category, ordinal, histogram, domain), and returns chart-ready data.
- `app/api/tables` and `app/api/profile` - the two API routes the UI calls.
- `app/components/Chart.tsx` - renders each chart with Chart.js.
