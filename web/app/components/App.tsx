"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Chart from "./Chart";
import { FillGauge, CalendarHeatmap, CardinalityBars } from "./Widgets";
import type { ProfileData } from "@/lib/profiler";

interface TableRow {
  schema: string;
  table: string;
  rows_estimate: number;
}

const nf = (n: number) => n.toLocaleString("en-US");

export default function App() {
  const searchParams = useSearchParams();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [tablesError, setTablesError] = useState<string | null>(null);
  // seed the selection from ?schema=&table= once, on first render
  const [selected, setSelected] = useState<{ schema: string; table: string } | null>(() => {
    const schema = searchParams.get("schema");
    const table = searchParams.get("table");
    return schema && table ? { schema, table } : null;
  });
  // one result slot keyed by the table it belongs to; loading/data/error are DERIVED
  // from it (no synchronous setState inside the fetch effect)
  const [result, setResult] = useState<{
    key: string;
    data?: ProfileData;
    error?: string;
  } | null>(null);

  const selKey = selected ? `${selected.schema}.${selected.table}` : "";
  const loading = !!selected && result?.key !== selKey;
  const data = result?.key === selKey ? result?.data ?? null : null;
  const error = result?.key === selKey ? result?.error ?? null : null;

  useEffect(() => {
    fetch("/api/tables")
      .then((r) => r.json())
      .then((rows: TableRow[] & { error?: string }) => {
        if (rows.error) throw new Error(rows.error);
        setTables(rows);
        // never show an empty page: auto-open the largest table when nothing is selected
        if (rows.length) {
          const biggest = rows.reduce((b, r) => (r.rows_estimate > b.rows_estimate ? r : b), rows[0]);
          setSelected((prev) => prev ?? { schema: biggest.schema, table: biggest.table });
        }
      })
      .catch((e) => setTablesError(e.message));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const key = `${selected.schema}.${selected.table}`;
    const controller = new AbortController();
    fetch(
      `/api/profile?schema=${encodeURIComponent(selected.schema)}&table=${encodeURIComponent(selected.table)}`,
      { signal: controller.signal }
    )
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setResult({ key, data: json });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setResult({ key, error: e.message });
      });
    return () => controller.abort();
  }, [selected]);

  const grouped = useMemo(() => {
    const g = new Map<string, TableRow[]>();
    for (const t of tables) {
      if (!g.has(t.schema)) g.set(t.schema, []);
      g.get(t.schema)!.push(t);
    }
    return g;
  }, [tables]);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <p className="sidebar-eyebrow">Visual DB</p>
          <h2 className="sidebar-title">Tables</h2>
        </div>
        {tablesError && <p className="sidebar-empty">error: {tablesError}</p>}
        {!tablesError && tables.length === 0 && <p className="sidebar-empty">loading tables...</p>}
        {[...grouped.entries()].map(([schema, rows]) => (
          <div className="schema-group" key={schema}>
            <p className="schema-name">{schema}</p>
            {rows.map((r) => (
              <button
                key={`${r.schema}.${r.table}`}
                className={`table-item${selected?.schema === r.schema && selected?.table === r.table ? " active" : ""}`}
                onClick={() => setSelected({ schema: r.schema, table: r.table })}
              >
                <span>{r.table}</span>
                <span className="est">{nf(r.rows_estimate)}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>
      <main className="main">
        <div className="wrap">
          {(!selected || loading) && !error && <Skeleton />}
          {selected && error && <div className="state err">error: {error}</div>}
          {selected && !loading && !error && data && <Dashboard data={data} />}
        </div>
      </main>
    </div>
  );
}

// shimmer placeholder while a profile loads - never a blank page or bare text
function Skeleton() {
  return (
    <div className="skel" aria-hidden="true">
      <div className="skel-line w40" />
      <div className="skel-line w70 tall" />
      <div className="skel-row">
        <div className="skel-card h150" />
        <div className="skel-card h150 grow" />
      </div>
      <div className="skel-row">
        {[0, 1, 2, 3].map((i) => (
          <div className="skel-card h90 grow" key={i} />
        ))}
      </div>
      <div className="skel-row">
        <div className="skel-card h260 grow" />
        <div className="skel-card h260 grow" />
      </div>
      <div className="skel-card h260" />
    </div>
  );
}

function Dashboard({ data }: { data: ProfileData }) {
  const maxDistinct = Math.max(1, ...data.meta.columns.map((c) => c.distinct));
  // pair half-width panels; an unpaired s6 stretches to full width so no row has a gap
  const isBig = (c: ProfileData["charts"][number]) =>
    c.kind === "time" || c.kind === "domain" || c.data.length > 7;
  const spans: number[] = data.charts.map((c) => (isBig(c) ? 12 : 6));
  for (let i = 0; i < spans.length; i++) {
    if (spans[i] === 6 && spans[i + 1] !== 6) spans[i] = 12; // lone half panel -> full row
    else if (spans[i] === 6) i++; // consumed a pair
  }
  return (
    <>
      <header className="dash-header">
        <p className="eyebrow">Visual DB &nbsp;/&nbsp; table profile</p>
        <h1>{data.meta.table}</h1>
        <div className="sub">
          <span>database&nbsp; <b>{data.meta.db}</b></span>
          <span>rows&nbsp; <b>{nf(data.meta.total)}</b></span>
          <span>columns&nbsp; <b>{data.meta.columns.length}</b></span>
          <span>generated&nbsp; <b>{data.meta.generated}</b></span>
          <span>engine&nbsp; <b>PostgreSQL</b></span>
        </div>
      </header>

      <div className="overview">
        <div className="ov-card">
          <p className="ov-title">Completeness</p>
          <FillGauge pct={data.meta.fillPct ?? 0} />
        </div>
        {data.heatmap ? (
          <div className="ov-card ov-wide">
            <p className="ov-title">
              Activity <span>{data.heatmap.column} - rows per day, last 26 weeks</span>
            </p>
            <CalendarHeatmap heatmap={data.heatmap} />
          </div>
        ) : (
          <div className="ov-card ov-wide">
            <p className="ov-title">
              Cardinality <span>distinct values per column</span>
            </p>
            <CardinalityBars columns={data.meta.columns} />
          </div>
        )}
      </div>

      <div className="kpis" style={{ ["--kn" as string]: Math.min(data.kpis.length, 5) }}>
        {data.kpis.map((k, i) => (
          <div className="kpi" key={i}>
            <div className="lab">{k.lab}</div>
            <div className="val">{k.val}</div>
            <div className={`note${k.hot ? " hot" : ""}`}>{k.note || ""}</div>
          </div>
        ))}
      </div>

      <div className="grid">
        {data.charts.map((c, i) => {
          const big = spans[i] === 12;
          return (
            <section className={`panel ${big ? "s12" : "s6"}`} key={i}>
              <p className="ptitle">
                <span className="h">{c.title}</span>
                <span>{c.subtitle || ""}</span>
              </p>
              <Chart spec={c} big={big} />
            </section>
          );
        })}
      </div>

      <section className="panel s12" style={{ marginTop: 18 }}>
        <p className="ptitle">
          <span className="h">Column quality</span>
          <span>type / distinct / null%</span>
        </p>
        <div className="qwrap">
          <table className="q">
            <thead>
              <tr>
                <th>column</th>
                <th>type</th>
                <th>distinct</th>
                <th>null %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.meta.columns.map((c) => {
                const w = Math.max(2, Math.round((c.distinct / maxDistinct) * 120));
                return (
                  <tr key={c.name}>
                    <td style={{ color: "var(--ink)" }}>{c.name}</td>
                    <td>{c.type}</td>
                    <td>{nf(c.distinct)}</td>
                    <td>{c.null_pct}%</td>
                    <td>
                      <span className="bar" style={{ width: w }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
