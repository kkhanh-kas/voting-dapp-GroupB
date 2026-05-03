'use client';

import React from 'react';

export interface Candidate {
  id: number;
  name: string;
  voteCount: number;
}

export default function CandidateTable({
  candidates
}: {
  candidates: Candidate[];
}) {
  if (!candidates || candidates.length === 0) {
    return (
      <div className="p-6 text-center text-gray-400">
        No candidates yet
      </div>
    );
  }

  const maxVotes = Math.max(...candidates.map(c => c.voteCount));

  return (
    <table className="w-full text-left">
      <thead>
        <tr>
          <th>ID</th>
          <th>Name</th>
          <th>Votes</th>
        </tr>
      </thead>

      <tbody>
        {candidates.map(c => (
          <tr key={c.id}>
            <td>{c.id}</td>
            <td>{c.name}</td>
            <td>{c.voteCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}