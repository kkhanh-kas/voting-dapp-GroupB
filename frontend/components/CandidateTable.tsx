import React from "react";

interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}

interface Props {
  candidates: Candidate[];
}

export default function CandidateTable({ candidates }: Props) {
  if (!candidates.length) {
    return (
      <div className="text-center text-gray-500 py-6">
        No candidates yet
      </div>
    );
  }

  const maxVotes = Math.max(...candidates.map(c => c.voteCount));

  return (
    <div className="overflow-x-auto">

      <table className="w-full border rounded-lg">

        {/* HEADER */}
        <thead className="bg-blue-600 text-white">
          <tr>
            <th className="p-3">#</th>
            <th className="p-3 text-left">Name</th>
            <th className="p-3">Votes</th>
          </tr>
        </thead>

        {/* BODY */}
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.id}
              className={`
                border-t hover:bg-gray-50
                ${c.voteCount === maxVotes ? "bg-green-100 font-semibold" : ""}
              `}
            >
              <td className="p-3 text-center">{c.id}</td>
              <td className="p-3">{c.name}</td>
              <td className="p-3 text-center">{c.voteCount}</td>
            </tr>
          ))}
        </tbody>

      </table>

    </div>
  );
}
