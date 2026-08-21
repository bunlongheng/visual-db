import { describe, it, expect } from "vitest";
import { qi, ql, fmtBucketEdge, planColumn } from "./classify";

describe("qi - identifier quoting (SQL injection guard)", () => {
  it("wraps a plain identifier in double quotes", () => {
    expect(qi("users")).toBe('"users"');
  });
  it("doubles embedded double-quotes so injection is neutralised", () => {
    expect(qi('a" from secrets --')).toBe('"a"" from secrets --"');
  });
  it("keeps a lone double-quote balanced", () => {
    expect(qi('"')).toBe('""""');
  });
});

describe("ql - literal quoting", () => {
  it("wraps a string in single quotes", () => {
    expect(ql("hi")).toBe("'hi'");
  });
  it("doubles embedded single-quotes", () => {
    expect(ql("O'Brien")).toBe("'O''Brien'");
  });
});

describe("fmtBucketEdge - histogram label formatting", () => {
  it("rounds large magnitudes to whole numbers", () => {
    expect(fmtBucketEdge(1234.5)).toBe("1235");
    expect(fmtBucketEdge(-250)).toBe("-250");
  });
  it("keeps 2 significant figures for small magnitudes", () => {
    expect(fmtBucketEdge(1.234)).toBe("1.2");
    expect(fmtBucketEdge(0.0456)).toBe("0.046");
  });
  it("renders zero as 0", () => {
    expect(fmtBucketEdge(0)).toBe("0");
  });
});

describe("planColumn - which chart a column earns", () => {
  const base = { distinct: 10, total: 1000, name: "col" };

  it("maps temporal types to a time chart", () => {
    expect(planColumn({ ...base, type: "timestamp without time zone" })).toBe("time");
    expect(planColumn({ ...base, type: "date" })).toBe("time");
  });

  it("maps boolean to a category chart", () => {
    expect(planColumn({ ...base, type: "boolean", distinct: 2 })).toBe("category");
  });

  it("treats a mostly-email text column as a domain chart", () => {
    expect(planColumn({ type: "text", distinct: 900, total: 1000, name: "email", emailRatio: 0.95 })).toBe("domain");
  });

  it("does NOT treat a low-email-ratio text column as email (the shipped bug)", () => {
    // 900 distinct out of 1000 rows, only 10% email-shaped -> not a domain chart,
    // and too high cardinality for a category -> none
    expect(planColumn({ type: "text", distinct: 900, total: 1000, name: "note", emailRatio: 0.1 })).toBe("none");
  });

  it("treats a low-cardinality text column as a category", () => {
    expect(planColumn({ type: "varchar", distinct: 8, total: 1000, name: "status", emailRatio: 0 })).toBe("category");
  });

  it("skips a high-cardinality free-text column", () => {
    expect(planColumn({ type: "text", distinct: 990, total: 1000, name: "bio", emailRatio: 0 })).toBe("none");
  });

  it("uses an ordinal chart for a small-range numeric", () => {
    expect(planColumn({ type: "integer", distinct: 12, total: 1000, name: "rating", min: 1, max: 5 })).toBe("ordinal");
  });

  it("uses a histogram for a wide-range numeric", () => {
    expect(planColumn({ type: "bigint", distinct: 500, total: 1000, name: "amount", min: 0, max: 9999 })).toBe("histogram");
  });

  it("skips a primary-key-like id column", () => {
    expect(planColumn({ type: "bigint", distinct: 1000, total: 1000, name: "user_id", min: 1, max: 1000 })).toBe("none");
  });

  it("skips a constant numeric column", () => {
    expect(planColumn({ type: "integer", distinct: 1, total: 1000, name: "flag", min: 0, max: 0 })).toBe("none");
  });

  it("skips a numeric column with a null minimum", () => {
    expect(planColumn({ type: "numeric", distinct: 50, total: 1000, name: "price", min: null, max: null })).toBe("none");
  });

  it("returns none for an unknown type", () => {
    expect(planColumn({ ...base, type: "jsonb" })).toBe("none");
  });
});
