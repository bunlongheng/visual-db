import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.DBCHART_URL;

if (!connectionString) {
  throw new Error(
    "No connection URL - set DATABASE_URL or DBCHART_URL in web/.env.local"
  );
}

declare global {
  var _visualDbPool: Pool | undefined;
}

const pool =
  globalThis._visualDbPool ??
  new Pool({
    connectionString,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis._visualDbPool = pool;
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

export default pool;
