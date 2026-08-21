import { NextRequest, NextResponse } from "next/server";
import { profileTable } from "@/lib/profiler";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const schema = searchParams.get("schema");
  const table = searchParams.get("table");

  if (!schema || !table) {
    return NextResponse.json({ error: "schema and table are required" }, { status: 400 });
  }

  try {
    const data = await profileTable(schema, table);
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
