import { NextResponse } from "next/server";
import { query } from "@/lib/db";

interface TableRow {
  schema: string;
  table: string;
  rows_estimate: number;
}

export async function GET() {
  try {
    const rows = await query<TableRow>(`
      SELECT schemaname as schema, relname as table,
             GREATEST(n_live_tup, 0)::int as rows_estimate
      FROM pg_stat_user_tables
      WHERE schemaname NOT IN ('pg_catalog','information_schema')
      ORDER BY schemaname, relname
    `);
    return NextResponse.json(rows);
  } catch (err) {
    // Log the real driver error server-side; never leak SQL/schema internals to the client.
    console.error("tables error:", err);
    return NextResponse.json(
      { error: "could not list tables" },
      { status: 400 }
    );
  }
}
