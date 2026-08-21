import { query } from "./db";
import {
  NUMERIC,
  TEMPORAL,
  STRINGY,
  TOP,
  MAX_CHARTS,
  qi,
  ql,
  fmtBucketEdge,
  planColumn,
} from "./classify";

// ---- types (this is the shape the client renderer depends on) ----
export type ChartKind = "time" | "category" | "ordinal" | "histogram" | "domain";

export interface ChartPoint {
  k: string;
  v: number;
}

export interface ChartSpec {
  title: string;
  subtitle?: string;
  kind: ChartKind;
  data: ChartPoint[];
  log?: boolean;
}

export interface Kpi {
  lab: string;
  val: string;
  note?: string;
  hot?: boolean;
}

export interface ColumnQuality {
  name: string;
  type: string;
  distinct: number;
  nulls: number;
  null_pct: number;
}

export interface HeatmapData {
  column: string;
  days: { d: string; v: number }[]; // YYYY-MM-DD -> row count
  max: number;
}

export interface ProfileData {
  meta: {
    db: string;
    table: string;
    generated: string;
    total: number;
    fillPct: number; // overall non-null percentage, 0-100
    columns: ColumnQuality[];
  };
  kpis: Kpi[];
  charts: ChartSpec[];
  heatmap?: HeatmapData; // calendar heatmap for the primary date column, when present
}

// column type classification + the shared "what chart for this column" rule now
// live in ./classify (unit-tested, mirrored by bin/dbchart in Python).

interface ColumnDef {
  name: string;
  type: string;
}

interface ColumnMeta {
  name: string;
  type: string;
  distinct: number;
  nulls: number;
  null_pct: number;
  _m: Record<string, unknown>;
}

async function jsonAgg<T>(sql: string): Promise<T[]> {
  const rows = await query<{ data: T[] }>(
    `SELECT coalesce(json_agg(r),'[]'::json) as data FROM (${sql}) r`
  );
  return rows[0]?.data ?? [];
}

async function catQuery(
  rel: string,
  colName: string,
  top: number,
  orderVal = false
): Promise<ChartPoint[]> {
  const order = orderVal ? "1" : "2 DESC";
  return jsonAgg<ChartPoint>(
    `SELECT COALESCE(${qi(colName)}::text,'(null)') k, count(*) v FROM ${rel}
     GROUP BY 1 ORDER BY ${order} LIMIT ${top}`
  );
}

function formatNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export async function profileTable(
  schema: string,
  table: string
): Promise<ProfileData> {
  const rel = `${qi(schema)}.${qi(table)}`;

  const dbRows = await query<{ db: string }>(
    "SELECT current_database() as db"
  );
  const dbname = dbRows[0]?.db ?? "";

  const cols = await query<ColumnDef>(
    `SELECT column_name as name, data_type as type FROM information_schema.columns
     WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position LIMIT 40`,
    [schema, table]
  );
  if (!cols.length) {
    throw new Error(`table ${schema}.${table} not found (or no columns)`);
  }

  // ---- one-scan meta: nulls, distinct, min/max, email-ish ----
  const parts = ["'total', count(*)"];
  for (const c of cols) {
    const n = c.name;
    const t = c.type;
    const k = qi(n);
    const obj = [
      `'name',${ql(n)}`,
      `'type',${ql(t)}`,
      `'nulls',count(*) FILTER (WHERE ${k} IS NULL)`,
      `'distinct',count(DISTINCT ${k})`,
    ];
    if (NUMERIC.has(t)) obj.push(`'min',min(${k})`, `'max',max(${k})`);
    if (TEMPORAL.has(t)) obj.push(`'tmin',min(${k})::text`, `'tmax',max(${k})::text`);
    // fraction of non-null values that are actually email-shaped (not just "contains @")
    if (STRINGY.has(t))
      obj.push(
        `'email_ratio',(count(*) FILTER (WHERE ${k} ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'))::float / nullif(count(*) FILTER (WHERE ${k} IS NOT NULL),0)`
      );
    // "c:" prefix so a column literally named "total" can't clobber the row-count key
    parts.push(`${ql("c:" + n)}, json_build_object(${obj.join(",")})`);
  }
  const metaRows = await query<{ data: Record<string, any> }>(
    `SELECT json_build_object(${parts.join(",")}) as data FROM ${rel}`
  );
  const meta = metaRows[0]?.data ?? {};
  const total: number = meta.total || 0;
  if (total === 0) {
    throw new Error("table is empty (0 rows)");
  }

  const colmeta: ColumnMeta[] = cols.map((c) => {
    const m = (meta["c:" + c.name] as Record<string, unknown>) || {};
    const nulls = Number(m.nulls) || 0;
    return {
      name: c.name,
      type: c.type,
      distinct: Number(m.distinct) || 0,
      nulls,
      null_pct: Math.round((nulls / total) * 1000) / 10,
      _m: m,
    };
  });

  // ---- classify + build charts ----
  const charts: ChartSpec[] = [];
  let temporalSpan: [string, string, string] | null = null;

  for (const cm of colmeta) {
    if (charts.length >= MAX_CHARTS) break;
    const n = cm.name;
    const t = cm.type;
    const m = cm._m;
    const dist = cm.distinct;

    // the single source of truth for "what chart does this column earn"
    const plan = planColumn({
      type: t,
      distinct: dist,
      total,
      name: n,
      emailRatio: Number(m.email_ratio) || 0,
      min: m.min as number | string | null | undefined,
      max: m.max as number | string | null | undefined,
    });

    if (plan === "time") {
      const data = await jsonAgg<ChartPoint>(
        `SELECT to_char(date_trunc('month',${qi(n)}),'YYYY-MM') k, count(*) v
         FROM ${rel} WHERE ${qi(n)} IS NOT NULL GROUP BY 1 ORDER BY 1`
      );
      if (data.length) charts.push({ title: n, subtitle: "by month", kind: "time", data });
      const tmin = m.tmin as string | undefined;
      const tmax = m.tmax as string | undefined;
      if (!temporalSpan && tmin) {
        temporalSpan = [n, tmin.slice(0, 10), (tmax ?? "").slice(0, 10)];
      }
    } else if (plan === "category" && t === "boolean") {
      const d = await catQuery(rel, n, TOP);
      if (d.length) charts.push({ title: n, subtitle: "records", kind: "category", data: d });
    } else if (plan === "domain") {
      const d = await jsonAgg<ChartPoint>(
        `SELECT lower(split_part(${qi(n)},'@',2)) k, count(*) v FROM ${rel}
         WHERE ${qi(n)} LIKE '%@%' GROUP BY 1 ORDER BY 2 DESC LIMIT ${TOP}`
      );
      if (d.length)
        charts.push({ title: `${n} - domains`, subtitle: `top ${TOP}`, kind: "domain", data: d });
    } else if (plan === "category") {
      const d = await catQuery(rel, n, TOP);
      if (d.length)
        charts.push({ title: n, subtitle: `top ${Math.min(TOP, dist)}`, kind: "category", data: d });
    } else if (plan === "ordinal") {
      const d = await catQuery(rel, n, TOP, true);
      if (d.length) charts.push({ title: n, subtitle: "by value", kind: "ordinal", data: d });
    } else if (plan === "histogram") {
      // Robust bounds: clamp the range to the 1st..99th percentile so a single
      // extreme outlier can't collapse every other row into one bucket. Values
      // outside the clamp fall into the edge buckets (width_bucket + least/greatest).
      const boundRows = await query<{ lo: number; hi: number; amin: number; amax: number }>(
        `SELECT percentile_cont(0.01) WITHIN GROUP (ORDER BY ${qi(n)}::double precision) lo,
                percentile_cont(0.99) WITHIN GROUP (ORDER BY ${qi(n)}::double precision) hi,
                min(${qi(n)}::double precision) amin, max(${qi(n)}::double precision) amax
         FROM ${rel} WHERE ${qi(n)} IS NOT NULL`
      );
      const b = boundRows[0];
      let loN = Number(b?.lo ?? m.min);
      let hiN = Number(b?.hi ?? m.max);
      const clamped = hiN < Number(b?.amax ?? hiN) || loN > Number(b?.amin ?? loN);
      if (!(hiN > loN)) {
        // degenerate percentile spread - fall back to true min/max
        loN = Number(m.min);
        hiN = Number(m.max);
      }
      if (hiN > loN) {
        const raw = await jsonAgg<{ b: number; v: number }>(
          `SELECT least(greatest(width_bucket(${qi(n)}::double precision,${loN},${hiN},10),1),10) b, count(*) v
           FROM ${rel} WHERE ${qi(n)} IS NOT NULL GROUP BY 1 ORDER BY 1`
        );
        const w = (hiN - loN) / 10.0;
        const buckets = new Map<number, number>();
        raw.forEach((x) => buckets.set(Number(x.b), Number(x.v)));
        const lab = (i: number) => {
          const a0 = loN + w * (i - 1);
          const b0 = loN + w * i;
          return `${fmtBucketEdge(a0)}-${fmtBucketEdge(b0)}`;
        };
        const data: ChartPoint[] = [];
        for (let i = 1; i <= 10; i++) data.push({ k: lab(i), v: buckets.get(i) || 0 });
        charts.push({
          title: n,
          subtitle: clamped ? "distribution (1-99 pct)" : "distribution",
          kind: "histogram",
          data,
        });
      }
    }
  }

  // log axis for very skewed horizontal bars
  for (const c of charts) {
    const vs = c.data.map((d) => d.v).filter((v) => v > 0);
    if (
      (c.kind === "category" || c.kind === "domain") &&
      vs.length > 2 &&
      Math.max(...vs) > 0 &&
      Math.min(...vs) > 0 &&
      Math.max(...vs) / Math.min(...vs) > 500
    ) {
      c.log = true;
    }
  }

  // ---- KPIs ----
  const ncols = colmeta.length;
  const totalNulls = colmeta.reduce((s, c) => s + c.nulls, 0);
  const filled = 1 - totalNulls / (total * ncols);
  const topUniq = colmeta.reduce((best, c) => (c.distinct > best.distinct ? c : best), colmeta[0]);
  const kpis: Kpi[] = [
    { lab: "Total rows", val: total.toLocaleString("en-US"), note: `in ${table}` },
    { lab: "Columns", val: String(ncols), note: "profiled" },
    { lab: "Cells filled", val: `${(filled * 100).toFixed(0)}%`, note: "non-null overall" },
    { lab: "Most unique", val: topUniq.distinct.toLocaleString("en-US"), note: topUniq.name, hot: true },
  ];
  if (temporalSpan) {
    kpis.push({
      lab: "Date span",
      val: temporalSpan[1],
      note: `to ${temporalSpan[2]} (${temporalSpan[0]})`,
    });
  }

  // calendar heatmap: daily row counts over the last 182 days of the primary date column
  let heatmap: HeatmapData | undefined;
  if (temporalSpan) {
    const hc = qi(temporalSpan[0]);
    const days = await query<{ d: string; v: number }>(
      `WITH b AS (SELECT max(${hc}) mx FROM ${rel} WHERE ${hc} IS NOT NULL)
       SELECT to_char(date_trunc('day', ${hc}),'YYYY-MM-DD') d, count(*)::int v
       FROM ${rel}, b
       WHERE ${hc} IS NOT NULL AND ${hc} > b.mx - interval '182 days'
       GROUP BY 1 ORDER BY 1`
    );
    if (days.length) {
      const norm = days.map((x) => ({ d: x.d, v: Number(x.v) }));
      const max = norm.reduce((mx, x) => Math.max(mx, x.v), 0);
      heatmap = { column: temporalSpan[0], days: norm, max };
    }
  }

  return {
    meta: {
      db: dbname,
      table: `${schema}.${table}`,
      generated: formatNow(),
      total,
      fillPct: Math.round(filled * 1000) / 10,
      columns: colmeta.map((c) => ({
        name: c.name,
        type: c.type,
        distinct: c.distinct,
        nulls: c.nulls,
        null_pct: c.null_pct,
      })),
    },
    kpis,
    charts,
    heatmap,
  };
}
