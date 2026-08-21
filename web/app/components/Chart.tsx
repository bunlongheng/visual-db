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

ChartJS.defaults.font.family =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = "#9aa0c8";
ChartJS.defaults.plugins.legend.display = false;
ChartJS.defaults.animation = { duration: 900, easing: "easeOutQuart" };

// staggered entrance - elements sweep in one after another on first paint,
// instead of the whole chart popping in at once
const stagger = (count: number) => ({
  duration: 900,
  easing: "easeOutQuart" as const,
  delay: (ctx: { type?: string; mode?: string; dataIndex?: number }) =>
    ctx.type === "data" && ctx.mode === "default"
      ? ((ctx.dataIndex ?? 0) / Math.max(1, count)) * 550
      : 0,
});

// dark analytics-studio palette - vibrant, high-saturation, distinct on near-black
const PALETTE = {
  ink: "#eef0fb",
  muted: "#9aa0c8",
  line: "#232842",
  accent: "#8b74ff",
  card: "#12152a",
  c1: "#8b74ff",
  c2: "#22d3ee",
  c3: "#f472b6",
  c4: "#a3e635",
  c5: "#fbbf24",
  c6: "#fb7185",
  c7: "#38bdf8",
  c8: "#34d399",
};
// 12-color vibrant spectrum so every chart reads as a full rainbow on the dark canvas
const PAL = [
  "#8b74ff", // violet
  "#22d3ee", // cyan
  "#f472b6", // pink
  "#a3e635", // lime
  "#fbbf24", // amber
  "#fb7185", // rose
  "#38bdf8", // sky
  "#34d399", // emerald
  "#c084fc", // purple
  "#fb923c", // orange
  "#2dd4bf", // teal
  "#facc15", // yellow
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
  backgroundColor: "#0d0f1c",
  borderColor: "#2c3253",
  borderWidth: 1,
  titleColor: "#eef0fb",
  bodyColor: "#c7cbec",
  padding: 11,
  cornerRadius: 8,
  displayColors: false,
  titleFont: { family: "'JetBrains Mono'" },
  bodyFont: { family: "'JetBrains Mono'" },
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
              backgroundColor: "rgba(139,116,255,0.16)",
              borderWidth: 2.5,
              fill: true,
              pointRadius: vals.length > 40 ? 0 : 2,
              pointBackgroundColor: PALETTE.accent,
              pointHoverRadius: 5,
              tension: 0.4,
            },
          ],
        },
        options: {
          animation: stagger(vals.length),
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
          animation: { ...stagger(vals.length), animateRotate: true, animateScale: true },
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
      // every bar gets its own hue from the 12-color spectrum - a full rainbow per chart
      const colors = labels.map((_, i) => PAL[i % PAL.length]);
      const logx = !!spec.log;
      config = {
        type: "bar",
        data: {
          labels,
          datasets: [
            {
              data: vals,
              backgroundColor: colors,
              borderWidth: 0,
              borderRadius: 6,
              borderSkipped: false,
              maxBarThickness: 46,
            },
          ],
        },
        options: {
          indexAxis: horiz ? "y" : "x",
          animation: stagger(vals.length),
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
