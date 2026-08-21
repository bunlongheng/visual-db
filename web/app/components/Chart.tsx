"use client";

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  ChartConfiguration,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import type { ChartSpec } from "@/lib/profiler";

ChartJS.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  BarController,
  BarElement,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.font.family = "'IBM Plex Mono', ui-monospace, monospace";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = "#75726a";
ChartJS.defaults.plugins.legend.display = false;
ChartJS.defaults.animation = { duration: 550 };

const PALETTE = {
  ink: "#1b1a17",
  muted: "#75726a",
  line: "#e4e1d7",
  accent: "#b4531f",
  card: "#ffffff",
  c1: "#1f3b57",
  c2: "#b4531f",
  c3: "#2e7d6b",
  c4: "#c99a2e",
  c5: "#7c4a86",
  c6: "#55702c",
  c7: "#9c3b3b",
  c8: "#64748b",
};
const PAL = [
  PALETTE.c1,
  PALETTE.c3,
  PALETTE.c4,
  PALETTE.c5,
  PALETTE.c6,
  PALETTE.c7,
  PALETTE.c8,
  PALETTE.c2,
];

const nf = (n: number) => (typeof n === "number" ? n.toLocaleString("en-US") : n);
const sn = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + "b";
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "m";
  if (a >= 1e3) return (v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + "k";
  return v;
};

const grid = { color: PALETTE.line, drawTicks: false };
const noGrid = { display: false, drawBorder: false };
const tip = {
  backgroundColor: PALETTE.ink,
  padding: 10,
  cornerRadius: 0,
  displayColors: false,
  titleFont: { family: "'IBM Plex Mono'" },
  bodyFont: { family: "'IBM Plex Mono'" },
};

export default function Chart({ spec, big }: { spec: ChartSpec; big: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    chartRef.current?.destroy();

    const labels = spec.data.map((d) => d.k);
    const vals = spec.data.map((d) => d.v);
    let config: ChartConfiguration<"line" | "bar" | "doughnut">;

    if (spec.kind === "time") {
      config = {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              data: vals,
              borderColor: PALETTE.accent,
              backgroundColor: "#efe1d7",
              borderWidth: 2,
              fill: true,
              pointRadius: vals.length > 40 ? 1 : 2,
              pointBackgroundColor: PALETTE.accent,
              pointHoverRadius: 5,
              tension: 0.25,
            },
          ],
        },
        options: {
          plugins: {
            tooltip: {
              ...tip,
              callbacks: {
                title: (x) => x[0].label,
                label: (x) => " " + nf(x.parsed.y as number),
              },
            },
          },
          maintainAspectRatio: false,
          scales: {
            x: { grid: noGrid, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
            y: { grid, ticks: { callback: (v) => sn(v as number) } },
          },
        },
      };
    } else if (spec.kind === "category" && labels.length <= 6) {
      config = {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: vals,
              backgroundColor: labels.map((_, i) => PAL[i % PAL.length]),
              borderColor: PALETTE.card,
              borderWidth: 2,
              hoverOffset: 0,
            },
          ],
        },
        options: {
          cutout: "58%",
          maintainAspectRatio: false,
          plugins: {
            tooltip: { ...tip, callbacks: { label: (c) => " " + nf(c.parsed as number) } },
            legend: {
              display: true,
              position: "bottom",
              labels: {
                boxWidth: 11,
                boxHeight: 11,
                padding: 12,
                color: PALETTE.ink,
                generateLabels: (chart) => {
                  const data = chart.data.datasets[0].data as number[];
                  const bg = chart.data.datasets[0].backgroundColor as string[];
                  return (chart.data.labels as string[]).map((l, i) => ({
                    text: String(l).slice(0, 22) + "  " + sn(data[i]),
                    fillStyle: bg[i],
                    strokeStyle: PALETTE.card,
                    lineWidth: 2,
                    index: i,
                  }));
                },
              },
            },
          },
        },
      };
    } else {
      const horiz = spec.kind === "domain" || (spec.kind === "category" && labels.length > 7);
      const single = spec.kind === "histogram" || spec.kind === "ordinal" || spec.kind === "domain";
      const colors = single ? PALETTE.c1 : labels.map((_, i) => PAL[i % PAL.length]);
      const logx = !!spec.log;
      config = {
        type: "bar",
        data: { labels, datasets: [{ data: vals, backgroundColor: colors, borderWidth: 0 }] },
        options: {
          indexAxis: horiz ? "y" : "x",
          maintainAspectRatio: false,
          plugins: {
            tooltip: { ...tip, callbacks: { label: (c) => " " + nf((c.parsed.y ?? c.parsed.x ?? c.parsed) as number) } },
          },
          scales: horiz
            ? {
                x: { grid, ticks: { callback: (v) => sn(v as number) }, type: logx ? "logarithmic" : "linear" },
                y: { grid: noGrid, ticks: { color: PALETTE.ink, font: { size: 10 } } },
              }
            : {
                x: { grid: noGrid, ticks: { color: PALETTE.ink, font: { size: 10 }, maxRotation: 0, autoSkip: true } },
                y: { grid, ticks: { callback: (v) => sn(v as number) } },
              },
        },
      };
    }

    chartRef.current = new ChartJS(canvas, config);
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [spec, big]);

  // text alternative so the canvas chart is not opaque to screen readers
  const top = [...spec.data].sort((a, b) => b.v - a.v).slice(0, 3);
  const aria =
    `${spec.kind} chart of ${spec.title}` +
    (spec.subtitle ? ` (${spec.subtitle})` : "") +
    (top.length ? `. Top: ${top.map((d) => `${d.k} ${nf(d.v)}`).join(", ")}` : "");

  return (
    <div className={`cbox${big ? " tall" : ""}`}>
      <canvas ref={canvasRef} role="img" aria-label={aria} />
    </div>
  );
}
