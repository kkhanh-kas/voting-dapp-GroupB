"use client";

import { useLang } from "@/components/Providers";

interface Candidate {
  id: number;
  name: string;
  bio?: string;
  voteCount: number;
}

interface CandidateTableProps {
  candidates: Candidate[];
}

export default function CandidateTable({ candidates }: CandidateTableProps) {
  const { t } = useLang();

  if (!candidates.length) {
    return (
      <div className="p-8 text-center text-[var(--color-text-secondary)]">
        {t("msg.noCandidates")}
      </div>
    );
  }

  const highestVote = Math.max(...candidates.map((c) => c.voteCount));

  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--color-border)]">
          <tr>
            <th className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium">
              {t("table.number")}
            </th>
            <th className="px-4 py-3 text-left text-[var(--color-text-secondary)] font-medium">
              {t("table.name")}
            </th>
            <th className="px-4 py-3 text-right text-[var(--color-text-secondary)] font-medium">
              {t("table.votes")}
            </th>
          </tr>
        </thead>

        <tbody>
          {candidates.map((candidate) => {
            const isLeader =
              candidate.voteCount === highestVote && highestVote > 0;

            return (
              <tr
                key={candidate.id}
                className={`border-b border-[var(--color-border)]/50 transition-colors duration-200 hover:bg-[var(--color-border)]/20 ${
                  isLeader ? "bg-[var(--color-border)]/10" : ""
                }`}
              >
                <td className="px-4 py-4 text-[var(--color-text-secondary)]">
                  {candidate.id}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          isLeader ? "bg-[var(--color-text-primary)]" : "bg-[var(--color-text-secondary)]/30"
                        }`}
                      />
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {candidate.name}
                      </span>
                      {isLeader && (
                        <span className="rounded-full border border-[var(--color-text-primary)]/20 px-2 py-0.5 text-xs text-[var(--color-text-primary)]">
                          {t("badge.leading")}
                        </span>
                      )}
                    </div>
                    {candidate.bio && (
                      <div className="text-xs text-[var(--color-text-secondary)] pl-5 line-clamp-2">
                        {candidate.bio}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-right font-medium text-[var(--color-text-primary)] tabular-nums">
                  {candidate.voteCount.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr>
            <td
              colSpan={2}
              className="px-4 py-4 text-[var(--color-text-secondary)] font-medium"
            >
              {t("table.totalVotes")}
            </td>
            <td className="px-4 py-4 text-right font-semibold text-[var(--color-text-primary)] tabular-nums">
              {candidates
                .reduce((sum, c) => sum + c.voteCount, 0)
                .toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}