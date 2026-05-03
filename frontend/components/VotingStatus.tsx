"use client";

import { useEffect, useState } from "react";
import { getContract } from "@/lib/contract";

type Status = "NOT_STARTED" | "ACTIVE" | "ENDED" | "LOADING";

const bannerConfig: Record<
  Exclude<Status, "LOADING">,
  { bg: string; border: string; dot: string; text: string; label: string }
> = {
  NOT_STARTED: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    dot: "bg-amber-400",
    text: "text-amber-800",
    label: "Election has not started yet",
  },
  ACTIVE: {
    bg: "bg-emerald-50",
    border: "border-emerald-300",
    dot: "bg-emerald-500",
    text: "text-emerald-800",
    label: "Election is ongoing",
  },
  ENDED: {
    bg: "bg-red-50",
    border: "border-red-300",
    dot: "bg-red-500",
    text: "text-red-800",
    label: "Election has ended",
  },
};

export default function VotingStatus() {
  const [status, setStatus] = useState<Status>("LOADING");

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const contract = await getContract();
        const raw: string = await contract.getVotingStatus();
        if (!cancelled) {
          setStatus(raw as Exclude<Status, "LOADING">);
        }
      } catch (err) {
        console.error("Failed to fetch voting status:", err);
      }
    }

    fetchStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "LOADING") {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 w-fit text-sm text-gray-500 animate-pulse">
        <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
        Checking election status…
      </div>
    );
  }

  const cfg = bannerConfig[status];

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border ${cfg.bg} ${cfg.border} w-fit`}
      role="status"
      aria-live="polite"
    >
      {/* Animated dot for ACTIVE */}
      <span className="relative flex h-2.5 w-2.5">
        {status === "ACTIVE" && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${cfg.dot}`}
        />
      </span>
      <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
}
