import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock the db layer so profileTable runs end-to-end with no real Postgres. The mock
// routes each SQL string to canned rows, exercising the full orchestration: column
// fetch -> one-scan meta -> per-column chart queries -> ProfileData assembly.
const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("./db", () => ({ query: queryMock }));

import { profileTable } from "./profiler";

const COLS = [
  { name: "created_at", type: "timestamp without time zone" },
  { name: "status", type: "character varying" },
  { name: "email", type: "text" },
  { name: "amount", type: "integer" },
  { name: "rating", type: "integer" },
  { name: "is_active", type: "boolean" },
  { name: "user_id", type: "bigint" },
];

const META = {
  total: 100,
  created_at: { nulls: 0, distinct: 40, tmin: "2024-01-01 00:00:00", tmax: "2024-06-01 00:00:00" },
  status: { nulls: 5, distinct: 4, email_ratio: 0 },
  email: { nulls: 0, distinct: 95, email_ratio: 0.95 },
  amount: { nulls: 0, distinct: 80, min: 0, max: 1000 },
  rating: { nulls: 2, distinct: 5, min: 1, max: 5 },
  is_active: { nulls: 0, distinct: 2 },
  user_id: { nulls: 0, distinct: 100, min: 1, max: 100 },
};

function router(sql: string) {
  if (sql.includes("current_database")) return [{ db: "testdb" }];
  if (sql.includes("information_schema.columns")) return COLS;
  if (sql.includes("percentile_cont")) return [{ lo: 50, hi: 950, amin: 0, amax: 1000 }];
  if (sql.includes("json_agg")) {
    if (sql.includes("date_trunc")) return [{ data: [{ k: "2024-01", v: 60 }, { k: "2024-02", v: 40 }] }];
    if (sql.includes("split_part")) return [{ data: [{ k: "gmail.com", v: 70 }, { k: "yahoo.com", v: 25 }] }];
    if (sql.includes("width_bucket"))
      return [{ data: [{ b: 1, v: 30 }, { b: 5, v: 50 }, { b: 10, v: 20 }] }];
    return [{ data: [{ k: "a", v: 55 }, { k: "b", v: 45 }] }]; // catQuery
  }
  if (sql.includes("json_build_object")) return [{ data: META }]; // one-scan meta
  return [];
}

beforeEach(() => {
  queryMock.mockReset();
  queryMock.mockImplementation((sql: string) => Promise.resolve(router(sql)));
});

describe("profileTable - full orchestration (mocked db)", () => {
  it("assembles a well-formed ProfileData", async () => {
    const data = await profileTable("public", "events");
    expect(data.meta.db).toBe("testdb");
    expect(data.meta.table).toBe("public.events");
    expect(data.meta.total).toBe(100);
    expect(data.meta.columns).toHaveLength(7);
    expect(data.meta.generated).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("produces the expected chart kind for each column type", async () => {
    const data = await profileTable("public", "events");
    const kinds = data.charts.map((c) => c.kind);
    expect(kinds).toContain("time"); // created_at
    expect(kinds).toContain("category"); // status / is_active
    expect(kinds).toContain("domain"); // email
    expect(kinds).toContain("histogram"); // amount
    expect(kinds).toContain("ordinal"); // rating
    // user_id is pk-like (100/100) -> no chart
    expect(data.charts.some((c) => c.title === "user_id")).toBe(false);
  });

  it("labels a percentile-clamped histogram", async () => {
    const data = await profileTable("public", "events");
    const hist = data.charts.find((c) => c.kind === "histogram");
    expect(hist).toBeDefined();
    expect(hist!.subtitle).toBe("distribution (1-99 pct)");
    expect(hist!.data).toHaveLength(10);
  });

  it("computes KPIs including a date span", async () => {
    const data = await profileTable("public", "events");
    const labs = data.kpis.map((k) => k.lab);
    expect(labs).toContain("Total rows");
    expect(labs).toContain("Columns");
    expect(labs).toContain("Cells filled");
    expect(labs).toContain("Most unique");
    expect(labs).toContain("Date span");
  });

  it("null_pct is computed per column", async () => {
    const data = await profileTable("public", "events");
    const status = data.meta.columns.find((c) => c.name === "status");
    expect(status!.null_pct).toBe(5); // 5 nulls / 100 rows
  });

  it("throws on an empty table", async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes("current_database")) return Promise.resolve([{ db: "testdb" }]);
      if (sql.includes("information_schema.columns")) return Promise.resolve(COLS);
      if (sql.includes("json_build_object")) return Promise.resolve([{ data: { total: 0 } }]);
      return Promise.resolve([]);
    });
    await expect(profileTable("public", "empty")).rejects.toThrow("empty");
  });

  it("throws when the table has no columns", async () => {
    queryMock.mockImplementation((sql: string) => {
      if (sql.includes("current_database")) return Promise.resolve([{ db: "testdb" }]);
      if (sql.includes("information_schema.columns")) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    await expect(profileTable("public", "ghost")).rejects.toThrow("not found");
  });
});
