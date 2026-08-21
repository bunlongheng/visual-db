// Pure column-classification logic, extracted from profiler.ts so it can be unit
// tested without a database. profiler.ts is the only caller; bin/dbchart mirrors
// these same rules in Python (documented trade-off - two runtimes, one rule set).

export const NUMERIC = new Set([
  "integer",
  "bigint",
  "smallint",
  "numeric",
  "double precision",
  "real",
  "decimal",
  "money",
]);
export const TEMPORAL = new Set([
  "date",
  "timestamp without time zone",
  "timestamp with time zone",
  "timestamptz",
  "timestamp",
]);
export const TEXTY = new Set([
  "character varying",
  "varchar",
  "text",
  "character",
  "char",
  "citext",
  "uuid",
  "name",
  "inet",
  "cidr",
]);
// safe for LIKE '%@%'
export const STRINGY = new Set([
  "character varying",
  "varchar",
  "text",
  "character",
  "char",
  "citext",
]);

export const TOP = 15;
export const MAX_CHARTS = 12;

// quote a SQL identifier - doubles any embedded double-quote (Postgres rule)
export function qi(ident: string): string {
  return '"' + ident.replace(/"/g, '""') + '"';
}
// quote a SQL string literal - doubles any embedded single-quote
export function ql(s: string): string {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// number formatter matching python's f"{z:.0f}" / f"{z:.2g}" pair used for histogram labels
export function fmtBucketEdge(z: number): string {
  if (Math.abs(z) >= 100) return z.toFixed(0);
  if (z === 0) return "0";
  return String(Number(z.toPrecision(2)));
}

export type ChartPlanKind =
  | "time"
  | "category"
  | "ordinal"
  | "histogram"
  | "domain"
  | "none";

export interface PlanInput {
  type: string;
  distinct: number;
  total: number;
  name: string;
  emailRatio?: number;
  min?: number | string | null;
  max?: number | string | null;
}

// Decide which chart (if any) a column earns, given its type + cardinality.
// This is the single source of truth for the "what chart for this column" rule.
export function planColumn(c: PlanInput): ChartPlanKind {
  const t = c.type;
  const dist = c.distinct;
  const total = c.total;
  const kl = c.name.toLowerCase();

  if (TEMPORAL.has(t)) return "time";
  if (t === "boolean") return "category";

  if (TEXTY.has(t)) {
    if ((Number(c.emailRatio) || 0) >= 0.8) return "domain";
    if ((dist >= 2 && dist <= 60) || (dist > 0 && dist / total <= 0.2 && dist <= 2000))
      return "category";
    return "none";
  }

  if (NUMERIC.has(t)) {
    if (dist <= 1 || c.min === null || c.min === undefined) return "none";
    if (kl.endsWith("id") && dist >= total * 0.98) return "none"; // skip pk-like
    if (dist <= 25) return "ordinal";
    if (c.max !== null && c.max !== undefined && Number(c.max) > Number(c.min))
      return "histogram";
    return "none";
  }

  return "none";
}
