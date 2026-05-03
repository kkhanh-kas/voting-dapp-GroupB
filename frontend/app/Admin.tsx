import React, { useState } from "react";
import Layout from "../components/Layout";
import CandidateTable from "../components/CandidateTable";
import Toast from "../components/Toast";
import { INITIAL_CANDIDATES } from "../lib/candidates";

export default function Admin() {
  const [candidates, setCandidates] = useState(INITIAL_CANDIDATES);
  const [name, setName] = useState("");
  const [toast, setToast] = useState("");

  const addCandidate = () => {
    if (!name) return;

    setCandidates(prev => [
      ...prev,
      { id: prev.length + 1, name, voteCount: 0 }
    ]);

    setName("");
    setToast("Candidate added!");

    setTimeout(() => setToast(""), 2000);
  };

  return (
    <Layout>

      <h2 className="text-xl font-bold mb-4">Admin Panel</h2>

      {/* FORM */}
      <div className="bg-white p-4 rounded shadow mb-4">

        <input
          className="border p-2 w-full mb-3"
          placeholder="Candidate name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <button
          onClick={addCandidate}
          className="bg-green-600 text-white px-4 py-2 rounded w-full"
        >
          Add Candidate
        </button>

      </div>

      {/* TABLE */}
      <CandidateTable candidates={candidates} />

      {toast && <Toast message={toast} type="success" />}

    </Layout>
  );
}