"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getContract } from "@/lib/contract";
import CandidateTable from "@/components/CandidateTable";
import Spinner from "@/components/ui/Spinner";
import Toast from "@/components/ui/Toast";
import { useLang } from "@/components/Providers";

interface Candidate {
  id: number;
  name: string;
  bio: string;
  voteCount: number;
}

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLang();

  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [newName, setNewName] = useState("");
  const [newBio, setNewBio] = useState("");
  const [addingCandidate, setAddingCandidate] = useState(false);

  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [settingPeriod, setSettingPeriod] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [updatingCandidate, setUpdatingCandidate] = useState(false);
  const [deletingCandidate, setDeletingCandidate] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error") => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast({ message, type });
      toastTimer.current = setTimeout(() => setToast(null), 4000);
    },
    []
  );

  /* SSR guard */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Detect wallet */
  useEffect(() => {
    if (!mounted || typeof window.ethereum === "undefined") return;

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0]);
      });

    const handler = (accounts: string[]) => {
      setAccount(accounts.length > 0 ? accounts[0] : null);
    };

    window.ethereum.on("accountsChanged", handler);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handler);
    };
  }, [mounted]);

  /* Load owner + candidates */
  const loadData = useCallback(async () => {
    try {
      const contract: any = await getContract();

      const contractOwner: string = await contract.owner();
      setOwner(contractOwner);

      const count = Number(await contract.candidatesCount());
      const list: Candidate[] = [];

      for (let i = 1; i <= count; i++) {
        const raw = await contract.candidates(i);
        if (raw.name !== "") {
          list.push({
            id: Number(raw.id),
            name: raw.name,
            bio: raw.bio,
            voteCount: Number(raw.voteCount),
          });
        }
      }

      setCandidates(list);
    } catch (err: any) {
      console.error("Failed to load admin data:", err);
      showToast(
        err?.message?.includes("Wrong network")
          ? err.message
          : "Failed to load admin data",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!mounted || typeof window.ethereum === "undefined") {
      setLoading(false);
      return;
    }
    loadData();
  }, [mounted, loadData]);

  /* Authorization check */
  useEffect(() => {
    if (!account || !owner) {
      setAuthorized(null);
      return;
    }

    if (account.toLowerCase() === owner.toLowerCase()) {
      setAuthorized(true);
    } else {
      setAuthorized(false);
      const timer = setTimeout(() => router.push("/"), 2000);
      return () => clearTimeout(timer);
    }
  }, [account, owner, router]);

  /* Add candidate */
  const handleAddCandidate = async () => {
    const trimmedName = newName.trim();
    const trimmedBio = newBio.trim();

    if (!trimmedName) {
      showToast("Please enter a candidate name", "error");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to add "${trimmedName}" as a new candidate?`
    );
    if (!confirmed) return;

    try {
      setAddingCandidate(true);
      const contract: any = await getContract(true);
      const tx = await contract.addCandidate(trimmedName, trimmedBio);
      await tx.wait();

      setNewName("");
      setNewBio("");
      showToast(`Candidate "${trimmedName}" added successfully`, "success");
      await loadData();
    } catch (err: any) {
      let msg = "Failed to add candidate";

      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        msg = "Transaction rejected by user";
      } else if (err.reason) {
        msg = err.reason;
      }

      showToast(msg, "error");
    } finally {
      setAddingCandidate(false);
    }
  };

  /* Update candidate */
  const handleUpdateCandidate = async (id: number) => {
    const trimmedName = editName.trim();
    const trimmedBio = editBio.trim();

    if (!trimmedName) {
      showToast("Please enter a candidate name", "error");
      return;
    }

    try {
      setUpdatingCandidate(true);
      const contract: any = await getContract(true);
      const tx = await contract.updateCandidate(id, trimmedName, trimmedBio);
      await tx.wait();

      setEditingId(null);
      setEditName("");
      setEditBio("");
      showToast(t("msg.candidateUpdated"), "success");
      await loadData();
    } catch (err: any) {
      let msg = "Failed to update candidate";
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        msg = "Transaction rejected by user";
      } else if (err.reason) {
        msg = err.reason;
      }
      showToast(msg, "error");
    } finally {
      setUpdatingCandidate(false);
    }
  };

  /* Delete candidate */
  const handleDeleteCandidate = async (id: number) => {
    const confirmed = window.confirm(t("msg.confirmDelete"));
    if (!confirmed) return;

    try {
      setDeletingCandidate(id);
      const contract: any = await getContract(true);
      const tx = await contract.deleteCandidate(id);
      await tx.wait();

      showToast(t("msg.candidateDeleted"), "success");
      await loadData();
    } catch (err: any) {
      let msg = "Failed to delete candidate";
      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        msg = "Transaction rejected by user";
      } else if (err.reason) {
        msg = err.reason;
      }
      showToast(msg, "error");
    } finally {
      setDeletingCandidate(null);
    }
  };

  /* Set voting period */
  const handleSetPeriod = async () => {
    if (!startInput || !endInput) {
      showToast("Please select both start and end time", "error");
      return;
    }

    const startUnix = Math.floor(new Date(startInput).getTime() / 1000);
    const endUnix = Math.floor(new Date(endInput).getTime() / 1000);

    if (endUnix <= startUnix) {
      showToast("End time must be after start time", "error");
      return;
    }

    const confirmed = window.confirm(
      `Set voting period?\n\nStart: ${new Date(startUnix * 1000).toLocaleString()}\nEnd: ${new Date(endUnix * 1000).toLocaleString()}`
    );
    if (!confirmed) return;

    try {
      setSettingPeriod(true);
      const contract: any = await getContract(true);
      const tx = await contract.setVotingPeriod(startUnix, endUnix);
      await tx.wait();

      showToast("Voting period updated successfully", "success");
    } catch (err: any) {
      let msg = "Failed to set voting period";

      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        msg = "Transaction rejected by user";
      } else if (err.reason) {
        msg = err.reason;
      }

      showToast(msg, "error");
    } finally {
      setSettingPeriod(false);
    }
  };

  /* ---- Render ---- */

  if (!mounted) return null;

  if (typeof window.ethereum === "undefined") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-12 shadow-sm max-w-xl w-full">
          <h1 className="text-2xl font-serif text-[var(--color-text-primary)] mb-4">
            {t("msg.metamaskRequired")}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t("msg.installMetamask")}
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-12 shadow-sm max-w-xl w-full">
          <h1 className="text-2xl font-serif text-[var(--color-text-primary)] mb-4">
            {t("msg.walletNotConnected")}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t("msg.connectToAccess")}
          </p>
        </div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center rounded-2xl border border-red-500/20 bg-[var(--color-card)] p-12 shadow-sm max-w-xl w-full">
          <h1 className="text-2xl font-serif text-red-500 mb-4">
            {t("msg.accessDenied")}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t("msg.notOwner")}
          </p>
        </div>
      </div>
    );
  }

  if (authorized !== true) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-12 px-4">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <h1 className="text-3xl font-serif text-[var(--color-text-primary)] mb-8">
        {t("label.adminPanel")}
      </h1>

      {/* Add Candidate */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm space-y-6 transition-colors hover:border-[var(--color-text-secondary)]">
        <h2 className="text-xl font-serif text-[var(--color-text-primary)]">
          {t("label.addCandidate")}
        </h2>

        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder={t("label.candidateName")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)] transition-colors"
            disabled={addingCandidate}
          />
          <textarea
            placeholder={t("label.candidateBio")}
            value={newBio}
            onChange={(e) => setNewBio(e.target.value)}
            rows={3}
            className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)] transition-colors resize-none"
            disabled={addingCandidate}
          />
          <div className="flex justify-end">
            <button
              onClick={handleAddCandidate}
              disabled={addingCandidate}
              className="bg-[var(--color-text-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-bg-main)] font-medium px-8 py-3 rounded-xl transition-opacity whitespace-nowrap"
            >
              {addingCandidate ? t("btn.adding") : t("btn.add")}
            </button>
          </div>
        </div>
      </div>

      {/* Set Voting Period */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm space-y-6 transition-colors hover:border-[var(--color-text-secondary)]">
        <h2 className="text-xl font-serif text-[var(--color-text-primary)]">
          {t("label.setVotingPeriod")}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {t("label.startTime")}
            </label>
            <input
              type="datetime-local"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)] transition-colors"
              disabled={settingPeriod}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {t("label.endTime")}
            </label>
            <input
              type="datetime-local"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)] transition-colors"
              disabled={settingPeriod}
            />
          </div>
        </div>

        <button
          onClick={handleSetPeriod}
          disabled={settingPeriod}
          className="w-full sm:w-auto bg-[var(--color-text-primary)] hover:opacity-90 disabled:opacity-50 text-[var(--color-bg-main)] font-medium px-8 py-3 rounded-xl transition-opacity"
        >
          {settingPeriod ? t("btn.updating") : t("btn.setPeriod")}
        </button>
      </div>

      {/* Candidate Table */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm space-y-6 transition-colors hover:border-[var(--color-text-secondary)]">
        <h2 className="text-xl font-serif text-[var(--color-text-primary)]">
          {t("label.currentCandidates")}
        </h2>
        
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-text-secondary)]">
                    {t("msg.noCandidates")}
                  </td>
                </tr>
              ) : (
                candidates.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-border)]/50">
                    <td className="px-4 py-4 text-[var(--color-text-secondary)] align-top">
                      {c.id}
                    </td>
                    <td className="px-4 py-4 align-top">
                      {editingId === c.id ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)]"
                            disabled={updatingCandidate}
                          />
                          <textarea
                            value={editBio}
                            onChange={(e) => setEditBio(e.target.value)}
                            rows={2}
                            className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)] resize-none"
                            disabled={updatingCandidate}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-[var(--color-text-primary)]">{c.name}</span>
                          {c.bio && <span className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{c.bio}</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      {editingId === c.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleUpdateCandidate(c.id)}
                            disabled={updatingCandidate}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                          >
                            {t("btn.save")}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={updatingCandidate}
                            className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                          >
                            {t("btn.cancel")}
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => {
                              setEditingId(c.id);
                              setEditName(c.name);
                              setEditBio(c.bio);
                            }}
                            disabled={deletingCandidate === c.id}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                          >
                            {t("btn.edit")}
                          </button>
                          <button
                            onClick={() => handleDeleteCandidate(c.id)}
                            disabled={deletingCandidate === c.id}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            {deletingCandidate === c.id ? "..." : t("btn.delete")}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}