<div align="center">
  <img src="docs/icon.png" alt="Visual DB" width="96" height="96" />
  <h1>Visual DB</h1>
  <p><em>Point it at any Postgres table and get a self-contained HTML dashboard, no per-table code</em></p>
  <p><a href="https://github.com/bunlongheng/visual-db">Repo</a> &middot; <a href="https://bunlongheng.com/projects?name=visual-db">Portfolio</a></p>
  <img src="docs/social-preview.png" alt="Visual DB - preview" width="820" />
</div>

---

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

### Sessions

However you signed in (Google or token), the sidebar shows who you are and a **Sign out** button. Sessions end by themselves too:

- **Idle** - after `IDLE_TIMEOUT_MINUTES` (default 15) with no interaction, the tab signs itself out and lands on the sign-in page. A countdown appears for the last 60 seconds.
- **Closed tab or browser** - the session cookie is a browser-session cookie, so quitting the browser ends it; a tab closed and left closed expires with the same idle window, because nothing refreshes it.

Other configurable settings (see `web/.env.example`): `DATABASE_URL` / `DBCHART_URL` (connection), `PROFILE_CACHE_TTL_MS` (profile cache, default 60s), `IDLE_TIMEOUT_MINUTES` (session idle window, default 15).

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

---

<div align="center">

<a href="https://bunlongheng.com"><img src="https://img.shields.io/badge/-bunlongheng.com-3A3A3C?style=for-the-badge&amp;labelColor=2A2A2C&amp;logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABwAAAAcCAMAAABF0y%2BmAAADAFBMVEXx8vLq6v%2F19fX09PT8%2Ff309PT5%2BfnAwMBMaXHx8vL19fX5%2Bfny8vL09PT39%2Ff6%2Bfn6%2Bvr09PTx8fH4%2BPn%2F8vLy8%2FP09PTz8%2FPy8vL%2F%2F%2F%2Fz9PTz9PP19fby8vP19PXz8%2FT19%2Fb08%2FTx8vLy8vL09vby8%2FL29vf19fTv8PDz9vb7%2Bvn%2F%2Ff%2F9%2Ff3w8vH29fb%2F%2FP339%2Ff5%2Bfn59%2Ff19PT09PR7rao3VF3%2F%2Fv8AKDR6sqsBV1vv8fL4%2BPiux8b8%2Bvq90NDy8%2FR%2BlpppnZyZqrACLTxclZJSkI9en5ssZ2luqaUAeWgqbW4BX1gCfG0%2Fa3QaVG0MN0UKNUKUpKsGpYMAKjoRQ1UDf3AQRloJqIgEm32d0cUBg3ElbnQIln8eVWgrmIdP0KzF5d5s2acdfHwppJCP5MMXl4Tz8%2FLv8%2FP39%2FiewL5%2BqahYf4IrTFZkk5KlxsREiIYAHiqDnKFmnJowc3IdVllvpKK7zc3D2tnk5%2BmuycdwpKKuub2yv8Ly%2B%2FkAMT7z%2Bvjq7e09gH93q6kGdWpGgoJZmJSlw8M7c3WwyceTw76w1M8mYmpFfX8lW2AFOEpGiYhxqqRrqaRb2rdIsZ8AVE91jpU7d3t3saqBoKhako4AWVEcUlg3aWwDupAHb2YwmIkPP1ERSVA7WmZ8tq8HT14oZW%2BYuLsMl3wQT10ROksENUc8Z3MJSGVLh4dqpJ%2BXr7U51awUgHM4v6ad1MkPuJZAiowVd3IEhnZH0aoYrI05p5sDtYwkzZ8EPViYxsRel5USbHAIgmwIM0gQamzU4uF2malQi4oWQFQ1zaYrp4UXlYwfiHoyxqFE1q4qeX4yn5JIxKkdrX1b1rAbWGvd5Oh91sRijpomsJEVc3Ukc34dqIcwuJVKwZIXkoQZcXlNv5g%2BqZUZvpNl2rPG9N0WkIoNqouW4sVPwp%2BM0b6h0ssfq4d%2F1r8hpo%2Fh9e4AamUjnI9avaBixqgklYWSwL4xtItUxplYl5qZ58mq78wMgnYXfnlOmJaR1L%2Bj78ny9fS%2FrXQPAAAAFXRSTlP7Brvx%2FsJhAgD87r4U72C4uGH8vhRDodYHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAC6UlEQVQokS2Sd3BUVRSHb0KS3QRCiZw5t%2By9j33zXjZkyUs2uekhEAi9dwRCL4JUEQRFAQUs9A4WOopKU0GpFoqCBZUivaqoFKkWLIS5GX7%2FfnPO78yZj%2Fj8UTViK6HggvNgSGuluEZRKbZqlN9H%2FFWiWUzIFQK5fhjOIRTDoqv4ia86S4q3KSByHdSqIhxofBKr5iNxLMm2bQqWVkorJ%2BAkO46nkQJhceSRmCTDvKJIJBLJzMxMLU6POJ4eBPF1KpNEbdt2Cms4LCcnZ%2FX6D3d%2BsKJJ7VSlNLoqgbjUtmkKKxlVmpf3bsFXW3d1b77gueJAQIPQBCilkMKemNi23Ts9T35%2FaMe2rsvmTypylGUFCSIYWJLXrm2nUwOPfNO5w%2B73Okxnjqe0JigQEL3JizoeONr%2F2u99vju4fd1rdZnyspQmnGvAUBprWNqz348%2FhXN%2F6P1%2By4Uvs%2FJkpRQRwpJBRVn7vf16Dfitz5XevQqWt3yalXtKaRIUQmglWfsu5y7%2BMrDs0TMftWo1ZVy64xioOVpcIdt8%2Fvqvf9%2F859KJsrLmrzA%2BOKC0IkFEtJza7JOfr%2FYd0P9G98tdOxe0Hp9qJrOIBgDuOeEtp%2F%2B4d%2FvWX%2F%2F9u%2B%2FtlaUTmOWZg7SQEEyuFe52%2BML9O3cZO%2F5xl06zn2VcadOJUqJTzt7a82XfP7sx9vmGNm1m1MstV4IHCVAAoTLqL1372ddn%2Fz%2B2v%2FWq12c1fSpsaeQWAZAANntxzuI3e3zbo8XGpm%2FMnNqiXrh%2BljaPd6UUabkjps19tdGnX2zKb9b4pTFDCzOMLmYtpW5h%2BpCRTeYtyV%2BT36zx808OL4xYGoFrkqDTbJpSXLdRgwbPZL%2BQnT129OOPFVEEsAMJpHKdeKMJgJSAiALdjJANQKnRJI4R6boAKEwLCiGoBBegQjBftQo1KQWOlplFKSV9qGaF1NpAE7QQESTlMSy6pp%2F4%2FFFVYxMNRBTaiM0tkImxNaL8vgfDR8gvoYRaxgAAAABJRU5ErkJggg%3D%3D" alt="bunlongheng.com"></a>
<a href="https://www.linkedin.com/in/bunlongheng/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
<a href="https://www.instagram.com/ibunlong/"><img src="https://img.shields.io/badge/Instagram-C13584?style=for-the-badge&logo=instagram&logoColor=white" alt="Instagram"></a>
<a href="mailto:bheng.code@gmail.com"><img src="https://img.shields.io/badge/Email-2E7D32?style=for-the-badge&logo=gmail&logoColor=white" alt="Email"></a>

<br>

Built by **[Bunlong](https://bunlongheng.com)** &nbsp;&middot;&nbsp; [more apps](https://bunlongheng.com/projects)

</div>
