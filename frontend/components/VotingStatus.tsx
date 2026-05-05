"use client";

import { useLang } from "@/components/Providers";

type Status = "NOT_STARTED" | "ACTIVE" | "ENDED";

interface VotingStatusProps {
  status: Status;
}

export default function VotingStatus({ status }: VotingStatusProps) {
  const { t } = useLang();

  const getStatusConfig = () => {
    switch (status) {
      case "NOT_STARTED":
        return {
          bg: "bg-amber-500/10",
          border: "border-amber-500/20",
          dot: "bg-amber-500",
          text: "text-amber-700 dark:text-amber-400",
          label: t("status.notStarted"),
        };
      case "ACTIVE":
        return {
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/20",
          dot: "bg-emerald-500",
          text: "text-emerald-700 dark:text-emerald-400",
          label: t("status.active"),
        };
      case "ENDED":
        return {
          bg: "bg-red-500/10",
          border: "border-red-500/20",
          dot: "bg-red-500",
          text: "text-red-700 dark:text-red-400",
          label: t("status.ended"),
        };
    }
  };

  const cfg = getStatusConfig();

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2 rounded-full border ${cfg.bg} ${cfg.border} w-fit`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        {status === "ACTIVE" && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`}
        />
      </span>

      <span className={`text-sm font-medium ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
}