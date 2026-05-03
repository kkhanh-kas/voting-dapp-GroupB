"use client";

import { useEffect, useRef } from "react";
import {
  Chart,
  BarElement,
  BarController,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from "chart.js";

Chart.register(BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend);

export interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}

interface VoteChartProps {
  candidates: Candidate[];
}

/* Palette – one colour per bar, cycling if needed */
const BAR_COLORS = [
  "rgba(99, 153, 34, 0.8)",   // green
  "rgba(55, 138, 221, 0.8)",  // blue
  "rgba(186, 117, 23, 0.8)",  // amber
  "rgba(163, 45, 45, 0.8)",   // red
  "rgba(127, 119, 221, 0.8)", // purple
  "rgba(29, 158, 117, 0.8)",  // teal
];

const BAR_BORDERS = [
  "rgb(99, 153, 34)",
  "rgb(55, 138, 221)",
  "rgb(186, 117, 23)",
  "rgb(163, 45, 45)",
  "rgb(127, 119, 221)",
  "rgb(29, 158, 117)",
];

export default function VoteChart({ candidates }: VoteChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  /* Build or update the chart whenever candidates change */
  useEffect(() => {
    if (!canvasRef.current) return;

    const labels = candidates.map((c) => c.name);
    const data = candidates.map((c) => Number(c.voteCount));
    const colors = candidates.map((_, i) => BAR_COLORS[i % BAR_COLORS.length]);
    const borders = candidates.map((_, i) => BAR_BORDERS[i % BAR_BORDERS.length]);

    if (chartRef.current) {
      /* Update in-place so Chart.js animates the transition */
      const chart = chartRef.current;
      chart.data.labels = labels;
      (chart.data.datasets[0] as any).data = data;
      (chart.data.datasets[0] as any).backgroundColor = colors;
      (chart.data.datasets[0] as any).borderColor = borders;
      chart.update("active");
      return;
    }

    /* First mount: create the chart */
    const config: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Votes",
            data,
            backgroundColor: colors,
            borderColor: borders,
            borderWidth: 1.5,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 400, easing: "easeOutCubic" },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                ` ${ctx.parsed.y} vote${ctx.parsed.y !== 1 ? "s" : ""}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 13 } },
          },
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
              font: { size: 12 },
            },
            grid: { color: "rgba(0,0,0,0.06)" },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);
  }, [candidates]);

  /* Destroy chart on unmount to avoid canvas re-use errors */
  useEffect(() => {
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  if (!candidates.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-10">
        No candidates yet.
      </p>
    );
  }

  return (
    <div className="w-full">
      <canvas ref={canvasRef} aria-label="Vote count bar chart" role="img" />
    </div>
  );
}
