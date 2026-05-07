"use client";

import { useEffect, useRef } from "react";
import { useLang } from "@/components/Providers";
import Chart from "chart.js/auto";

export interface Candidate {
  id: number;
  name: string;
  bio?: string;
  voteCount: number;
}

interface VoteChartProps {
  candidates: Candidate[];
}

export default function VoteChart({ candidates }: VoteChartProps) {
  const { t } = useLang();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !candidates.length) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const sortedCandidates = [...candidates].sort((a, b) => b.voteCount - a.voteCount);
    const labels = sortedCandidates.map(c => c.name);
    const data = sortedCandidates.map(c => c.voteCount);

    const style = getComputedStyle(document.body);
    const textColor = style.getPropertyValue("--text-primary").trim() || "#2d2a26";
    const gridColor = style.getPropertyValue("--border-color").trim() || "#e6e2dd";

    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: t("table.votes"),
            data,
            backgroundColor: textColor,
            borderRadius: 4,
            barThickness: 24,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            backgroundColor: textColor,
            titleColor: style.getPropertyValue("--bg-main").trim() || "#fcfaf8",
            bodyColor: style.getPropertyValue("--bg-main").trim() || "#fcfaf8",
            padding: 12,
            cornerRadius: 8,
            displayColors: false,
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              stepSize: 1,
              font: {
                family: "Inter, sans-serif",
              },
            },
            border: {
              display: false,
            },
          },
          y: {
            grid: {
              display: false,
            },
            ticks: {
              color: textColor,
              font: {
                family: "Inter, sans-serif",
                weight: 500,
              },
            },
            border: {
              display: false,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [candidates, t]);

  if (!candidates.length) {
    return (
      <p className="text-sm text-[var(--color-text-secondary)] text-center py-10">
        {t("msg.noCandidates")}
      </p>
    );
  }

  return (
    <div className="w-full h-[300px] relative">
      <canvas ref={canvasRef} />
    </div>
  );
}