"use client";

/**
 * CandidateTable
 * - Renders the candidate list with live vote counts.
 * - Subscribes to the contract's "votedEvent" to refresh counts in real-time.
 * - Passes candidates down to VoteChart so the chart re-renders on every update.
 * - Cleans up the listener on unmount to prevent memory leaks.
 */

import { useEffect, useState, useCallback } from "react";
import { getContract } from "@/lib/contract";
import type { Candidate } from "./VoteChart";
import VoteChart from "./VoteChart";

interface RawCandidate {
  id: bigint;
  name: string;
  voteCount: bigint;
}

function toCandidate(raw: RawCandidate): Candidate {
  return {
    id: Number(raw.id),
    name: raw.name,
    voteCount: Number(raw.voteCount),
  };
}

export default function CandidateTable() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Fetch all candidates from the contract */
  const refreshCandidates = useCallback(async () => {
    try {
      const contract = await getContract();

      /* Solidity getter: candidates(id) → { id, name, voteCount }
         We keep fetching until a call reverts (no more candidates). */
      const list: Candidate[] = [];
      let id = 0;
      while (true) {
        try {
          const raw: RawCandidate = await contract.candidates(id);
          list.push(toCandidate(raw));
          id++;
        } catch {
          break; // No more candidates
        }
      }

      setCandidates(list);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load candidates");
    } finally {
      setLoading(false);
    }
  }, []);

  /* Subscribe to votedEvent; refresh data on every new vote */
  useEffect(() => {
    let contract: Awaited<ReturnType<typeof getContract>> | null = null;

    async function setup() {
      await refreshCandidates();

      try {
        contract = await getContract();

        const handler = async () => {
          /* Re-fetch all candidates so voteCount values are current */
          await refreshCandidates();
        };

        contract.on("votedEvent", handler);

        /* Cleanup: remove the listener when the component unmounts */
        return () => {
          contract?.off("votedEvent", handler);
        };
      } catch (err) {
        console.error("Could not subscribe to votedEvent:", err);
      }
    }

    const cleanupPromise = setup();

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [refreshCandidates]);

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 text-center py-6">
        Error: {error}
      </p>
    );
  }

  if (!candidates.length) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No candidates have been added yet.
      </p>
    );
  }

  const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <VoteChart candidates={candidates} />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Candidate</th>
              <th className="px-4 py-3 text-right">Votes</th>
              <th className="px-4 py-3 text-right">Share</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.map((c) => {
              const share =
                totalVotes > 0
                  ? ((c.voteCount / totalVotes) * 100).toFixed(1)
                  : "0.0";
              return (
                <tr
                  key={c.id}
                  className="hover:bg-gray-50 transition-colors duration-150"
                >
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {c.id + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {c.name}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-gray-700">
                    {c.voteCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1.5 text-gray-600">
                      {/* Mini bar */}
                      <span className="relative w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <span
                          className="absolute left-0 top-0 h-full rounded-full bg-blue-400 transition-all duration-500"
                          style={{ width: `${share}%` }}
                        />
                      </span>
                      <span className="text-xs w-10 text-right">{share}%</span>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={2} className="px-4 py-2.5 text-xs text-gray-500 font-medium">
                Total
              </td>
              <td className="px-4 py-2.5 text-right font-mono font-semibold text-gray-700 text-sm">
                {totalVotes.toLocaleString()}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
