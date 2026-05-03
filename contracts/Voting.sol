"use client";

import { useEffect, useState, useCallback } from "react";
import { getContract } from "@/lib/contract";
import type { Candidate } from "./VoteChart";
import VoteChart from "./VoteChart";
import Spinner from "@/components/ui/Spinner";
import Toast from "@/components/ui/Toast";

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

  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const refreshCandidates = useCallback(async () => {
    try {
      const contract: any = await getContract();

      // Voting.sol:
      // uint public candidatesCount;
      const count = Number(await contract.candidatesCount());

      const list: Candidate[] = [];

      // Voting.sol starts from ID = 1
      for (let i = 1; i <= count; i++) {
        const raw = await contract.candidates(i);

        list.push(
          toCandidate({
            id: raw.id,
            name: raw.name,
            voteCount: raw.voteCount,
          })
        );
      }

      setCandidates(list);
    } catch (err: any) {
      console.error(err);

      setToast({
        message: "Failed to load candidates",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let contract: any;

    const setup = async () => {
      await refreshCandidates();

      try {
        contract = await getContract();

        const handler = async () => {
          await refreshCandidates();

          setToast({
            message: "Vote updated in real time",
            type: "success",
          });
        };

        contract.on("votedEvent", handler);

        return () => {
          contract?.off("votedEvent", handler);
        };
      } catch (err) {
        console.error("Event listener error:", err);
      }
    };

    const cleanupPromise = setup();

    return () => {
      cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [refreshCandidates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (!candidates.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 text-center text-gray-400">
        No candidates yet
      </div>
    );
  }

  const totalVotes = candidates.reduce(
    (sum, candidate) => sum + candidate.voteCount,
    0
  );

  const highestVote = Math.max(...candidates.map((c) => c.voteCount));

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="space-y-6">
        {/* Chart */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6">
          <VoteChart candidates={candidates} />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 text-left text-gray-400 font-medium">
                  #
                </th>

                <th className="px-6 py-4 text-left text-gray-400 font-medium">
                  Candidate
                </th>

                <th className="px-6 py-4 text-right text-gray-400 font-medium">
                  Votes
                </th>

                <th className="px-6 py-4 text-right text-gray-400 font-medium">
                  Share
                </th>
              </tr>
            </thead>

            <tbody>
              {candidates.map((candidate) => {
                const share =
                  totalVotes > 0
                    ? (
                        (candidate.voteCount / totalVotes) *
                        100
                      ).toFixed(1)
                    : "0.0";

                const isLeader =
                  candidate.voteCount === highestVote &&
                  highestVote > 0;

                return (
                  <tr
                    key={candidate.id}
                    className={`border-b border-white/5 transition-all duration-200 hover:bg-white/5 ${
                      isLeader ? "bg-blue-500/10" : ""
                    }`}
                  >
                    <td className="px-6 py-4 text-gray-400">
                      {candidate.id}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-3 w-3 rounded-full ${
                            isLeader
                              ? "bg-blue-400"
                              : "bg-gray-500"
                          }`}
                        />

                        <span className="font-medium text-white">
                          {candidate.name}
                        </span>

                        {isLeader && (
                          <span className="rounded-full bg-blue-500/20 px-2 py-1 text-xs text-blue-300">
                            Leading
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right font-semibold text-white">
                      {candidate.voteCount.toLocaleString()}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-blue-400 transition-all duration-500"
                            style={{
                              width: `${share}%`,
                            }}
                          />
                        </div>

                        <span className="w-12 text-xs text-gray-300">
                          {share}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot className="bg-white/5">
              <tr>
                <td
                  colSpan={2}
                  className="px-6 py-4 text-gray-400 font-medium"
                >
                  Total Votes
                </td>

                <td className="px-6 py-4 text-right font-bold text-white">
                  {totalVotes.toLocaleString()}
                </td>

                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}