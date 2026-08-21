import { NextRequest, NextResponse } from "next/server";
import { profileTable, type ProfileData } from "@/lib/profiler";

// A profile is a full table scan, so cache the result briefly - re-viewing the same
// table (the common case) then returns instantly instead of re-scanning.
// Configurable via PROFILE_CACHE_TTL_MS (default 60s; 0 disables caching).
const TTL_MS = Number(process.env.PROFILE_CACHE_TTL_MS ?? 60_000);
const cache = new Map<string, { at: number; data: ProfileData }>();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schema = searchParams.get("schema");
  const table = searchParams.get("table");

  if (!schema || !table) {
    return NextResponse.json({ error: "schema and table are required" }, { status: 400 });
  }

  const key = `${schema}.${table}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.data);
  }

  try {
    const data = await profileTable(schema, table);
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    // Log the real driver error server-side; never leak SQL/schema internals to the client.
    console.error("profile error:", err);
    return NextResponse.json(
      { error: "could not profile that table" },
      { status: 400 }
    );
  }
}
