"use client";

import type { HeatmapData, ColumnQuality } from "@/lib/profiler";

const ROWPAL = ["#8b74ff", "#22d3ee", "#f472b6", "#a3e635", "#fbbf24", "#38bdf8"];

// ---- Cardinality panel - distinct values per column as colored meters ----
// Fills the overview row when a table has no date column (no heatmap available).
export function CardinalityBars({ columns }: { columns: ColumnQuality[] }) {
  const top = [...columns].sort((a, b) => b.distinct - a.distinct).slice(0, 6);
  const max = Math.max(1, top[0]?.distinct ?? 1);
  return (
    <div className="cardin">
      {top.map((c, i) => (
        <div className="cardin-row" key={c.name}>
          <span className="cardin-name">{c.name}</span>
          <span className="cardin-track">
            <span
              className="cardin-fill"
              style={{
                width: `${Math.max(3, (c.distinct / max) * 100)}%`,
                background: ROWPAL[i % ROWPAL.length],
              }}
            />
          </span>
          <span className="cardin-val">{c.distinct.toLocaleString("en-US")}</span>
        </div>
      ))}
    </div>
  );
}

// ---- Fill-rate gauge (SVG semicircle) - overall non-null completeness ----
export function FillGauge({ pct }: { pct: number }) {
  const p = Math.max(0, Math.min(100, pct));
  const r = 80;
  const circ = Math.PI * r; // semicircle arc length
  const dash = (p / 100) * circ;
  const color = p >= 90 ? "#34d399" : p >= 70 ? "#fbbf24" : "#fb7185";
  const band = p >= 90 ? "Healthy" : p >= 70 ? "Watch" : "Sparse";
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 116" width="100%" role="img" aria-label={`Cells filled ${p}%`}>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#232842"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="15"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
        />
        <text x="100" y="86" textAnchor="middle" className="gauge-val" fill="#eef0fb">
          {p % 1 === 0 ? p : p.toFixed(1)}%
        </text>
      </svg>
      <div className="gauge-cap">
        <span className="gauge-band" style={{ color }}>
          {band}
        </span>
        <span>cells filled</span>
      </div>
    </div>
  );
}

// ---- Calendar heatmap (GitHub-style) - daily row counts for a date column ----
const CELL = 13;
const GAP = 3;
const STEP = CELL + GAP;
const LEVELS = ["#171b30", "#3a2f74", "#5a44b0", "#7a5cff", "#a68bff"];

function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function CalendarHeatmap({ heatmap }: { heatmap: HeatmapData }) {
  const counts = new Map(heatmap.days.map((x) => [x.d, x.v]));
  const last = parseDay(heatmap.days[heatmap.days.length - 1].d);
  const first = parseDay(heatmap.days[0].d);
  // start on the Sunday on/before the first day
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());

  const cells: { x: number; y: number; v: number; d: string }[] = [];
  let col = 0;
  const cur = new Date(start);
  while (cur <= last) {
    const row = cur.getDay();
    if (row === 0 && cells.length) col++;
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(
      cur.getDate()
    ).padStart(2, "0")}`;
    const v = counts.get(key) ?? 0;
    cells.push({ x: col * STEP, y: row * STEP, v, d: key });
    cur.setDate(cur.getDate() + 1);
  }
  const level = (v: number) =>
    v === 0 ? LEVELS[0] : LEVELS[Math.min(4, 1 + Math.floor((v / heatmap.max) * 3.999))];

  const width = (col + 1) * STEP;
  const height = 7 * STEP;

  return (
    <div className="heat">
      <div className="heat-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: "100%", height: "auto", maxHeight: 190, display: "block" }}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`Daily row counts for ${heatmap.column}`}
        >
          {cells.map((c, i) => (
            <rect
              key={i}
              x={c.x}
              y={c.y}
              width={CELL}
              height={CELL}
              rx={3}
              fill={level(c.v)}
            >
              <title>{`${c.d}: ${c.v.toLocaleString("en-US")} rows`}</title>
            </rect>
          ))}
        </svg>
      </div>
      <div className="heat-legend">
        <span>Less</span>
        {LEVELS.map((c) => (
          <span key={c} className="heat-key" style={{ background: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
