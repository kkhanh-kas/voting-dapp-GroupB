"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getContract } from "@/lib/contract";
import CandidateTable from "@/components/CandidateTable";
import VoteChart from "@/components/VoteChart";
import VotingStatus from "@/components/VotingStatus";
import Spinner from "@/components/ui/Spinner";
import Toast from "@/components/ui/Toast";
import { useLang } from "@/components/Providers";
import { translateBio } from "@/lib/i18n";
import { Check } from "lucide-react";

interface Candidate {
  id: number;
  name: string;
  bio: string;
  voteCount: number;
}

type Status = "NOT_STARTED" | "ACTIVE" | "ENDED";

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

export default function VoterPage() {
  const [mounted, setMounted] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedId, setSelectedId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  const { t, lang } = useLang();
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, type: "success" | "error" | "info") => {
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

  /* Load contract data */
  const loadData = useCallback(async () => {
    try {
      const contract: any = await getContract();

      const rawStatus: string = await contract.getVotingStatus();
      setStatus(rawStatus as Status);

      const count = Number(await contract.candidatesCount());
      const list: Candidate[] = [];

      for (let i = 1; i <= count; i++) {
        const c = await contract.candidates(i);
        if (c.name !== "") {
          list.push({
            id: Number(c.id),
            name: c.name,
            bio: translateBio(c.bio, lang),
            voteCount: Number(c.voteCount),
          });
        }
      }

      setCandidates(list);

      if (account) {
        const voted: boolean = await contract.hasVoted(account);
        setHasVoted(voted);
      }
    } catch (err: any) {
      console.error("Failed to load contract data:", err);
      const msg = err?.message?.includes("Wrong network")
        ? err.message
        : t("error.loadContractData");
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [account, lang, showToast]);

  /* Initial data load */
  useEffect(() => {
    if (!mounted || typeof window.ethereum === "undefined") {
      setLoading(false);
      return;
    }
    loadData();
  }, [mounted, loadData]);

  /* votedEvent listener */
  useEffect(() => {
    if (!mounted || typeof window.ethereum === "undefined") return;

    let contract: any;
    let handler: (() => Promise<void>) | null = null;
    let active = true;

    (async () => {
      try {
        contract = await getContract();

        handler = async () => {
          if (!active) return;
          await loadData();
          showToast(t("toast.newVote"), "success");
        };

        if (active) contract.on("votedEvent", handler);
      } catch (err) {
        console.error("Event listener setup error:", err);
      }
    })();

    return () => {
      active = false;
      if (contract && handler) contract.off("votedEvent", handler);
    };
  }, [mounted, loadData, showToast]);

  /* Vote handler */
  const handleVote = async () => {
    if (!selectedId) {
      showToast(t("toast.selectCandidate"), "error");
      return;
    }

    try {
      setVoting(true);
      const contract: any = await getContract(true);
      const tx = await contract.vote(selectedId);
      await tx.wait(); // Wait for the block to be mined.

      setHasVoted(true);
      showToast(t("toast.voteSubmitted"), "success");
      await loadData();
    } catch (err: any) {
      let msg = t("error.submitVote");

      if (err.code === "ACTION_REJECTED" || err.code === 4001) {
        msg = t("error.txRejected");
      } else if (err.code === "INSUFFICIENT_FUNDS" || err.message?.includes("insufficient funds")) {
        msg = t("error.insufficientFunds");
      } else if (err.message?.includes("Already voted") || err.reason?.includes("Already voted")) {
        msg = t("error.alreadyVoted");
      } else if (err.reason) {
        msg = err.reason;
      }

      showToast(msg, "error");
    } finally {
      setVoting(false);
    }
  };

  /* Connect wallet */
  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      showToast(t("msg.installMetamask"), "error");
      return;
    }

    try {
      const accounts: string[] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        try {
          const contract: any = await getContract();
          const ownerAddr = await contract.owner();
          const isAdmin = accounts[0].toLowerCase() === ownerAddr.toLowerCase();
          showToast(
            isAdmin ? t("toast.welcomeAdmin") : t("toast.connectedVoter"),
            isAdmin ? "info" : "success"
          );
        } catch { /* owner check failed silently */ }
      }
    } catch {
      showToast(t("error.connectWallet"), "error");
    }
  };

  /* ---- Render ---- */

  if (!mounted) return null;

  // MetaMask is not installed show error message.
  if (typeof window.ethereum === "undefined") {
    return (
      <div className="mx-auto max-w-xl mt-20 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center shadow-sm">
        <h2 className="text-2xl font-serif text-[var(--color-text-primary)] mb-4">
          {t("msg.metamaskRequired")}
        </h2>
        <p className="text-[var(--color-text-secondary)]">
          {t("msg.installMetamask")}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner />
      </div>
    );
  }

  // STATE 1: Disconnected (Landing Page)
  if (!account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center max-w-3xl mx-auto">
        <h1 className="text-5xl sm:text-6xl font-serif text-[var(--color-text-primary)] mb-6 tracking-tight">
          {t("app.title")}
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)] mb-10 max-w-2xl leading-relaxed">
          {t("app.description")}
        </p>
        <button
          onClick={connectWallet}
          className="rounded-full bg-[var(--color-text-primary)] px-8 py-4 text-base font-medium text-[var(--color-bg-main)] transition-opacity hover:opacity-90 shadow-sm"
        >
          {t("btn.connectWallet")}
        </button>
      </div>
    );
  }

  // STATE 2: Connected (Voting Interface)
  const canVote = status === "ACTIVE" && !hasVoted;
  const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-12 px-4 py-12">
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* Header Area with Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-6">
        <div>
          <h1 className="text-3xl font-serif text-[var(--color-text-primary)] mb-2">
            {t("app.title")}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t("msg.votingAs")} <span className="font-mono">{truncate(account)}</span>
          </p>
        </div>
        {status && <VotingStatus status={status} />}
      </div>

      {/* Already voted message */}
      {hasVoted && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-[var(--color-text-primary)] shadow-sm">
          {t("msg.alreadyVoted")}
        </div>
      )}

      {/* Voting Area */}
      {canVote && (
        <div className="space-y-8">
          <div className="mb-4">
            <h2 className="text-2xl font-serif text-[var(--color-text-primary)] mb-2">{t("msg.castYourVote")}</h2>
            <p className="text-[var(--color-text-secondary)]">{t("msg.castYourVoteDesc")}</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {candidates.map((c, idx) => {
              const percentage = totalVotes > 0 ? (c.voteCount / totalVotes) * 100 : 0;
              const isSelected = selectedId === c.id;
              const hasSomeSelection = selectedId > 0;

              const faces = [
                <path key="1" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-3.5-7.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-6.5 3.5c1 1.5 5 1.5 6 0" strokeLinecap="round" strokeLinejoin="round"/>,
                <path key="2" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-4-8h2m4 0h2m-5 4v1" strokeLinecap="round" strokeLinejoin="round"/>,
                <path key="3" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-3-7l2-1m4 1l-2-1m-3 4c1-1 3-1 4 0" strokeLinecap="round" strokeLinejoin="round"/>,
                <path key="4" d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-3-8a1 1 0 110-2 1 1 0 010 2zm6 0a1 1 0 110-2 1 1 0 010 2zm-5 4c1 1 3 1 4 0" strokeLinecap="round" strokeLinejoin="round"/>
              ];
              const face = faces[idx % faces.length];
              
              return (
                <div
                  key={c.id}
                  className={`relative rounded-2xl border bg-[var(--color-card)] p-6 transition-all duration-200 ${
                    isSelected
                      ? "border-[var(--color-text-primary)] shadow-sm"
                      : hasSomeSelection
                        ? "border-[var(--color-border)] opacity-50"
                        : "border-[var(--color-border)] hover:border-[var(--color-text-secondary)] hover:shadow-sm"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[var(--color-text-primary)] flex items-center justify-center">
                      <Check size={14} strokeWidth={2.5} className="text-[var(--color-bg-main)]" />
                    </div>
                  )}

                  <div className="flex flex-col space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-[var(--color-text-secondary)]">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10">
                          {face}
                        </svg>
                      </div>
                      
                      <div className="text-sm text-[var(--color-text-secondary)]">{c.voteCount} {t("label.votes")}</div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium text-[var(--color-text-primary)]">{c.name}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-2 line-clamp-3">{c.bio}</p>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--color-bg-main)] rounded-b-2xl overflow-hidden">
                    <div 
                      className="h-full bg-[var(--color-text-secondary)] transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Confirmation Area */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm max-w-3xl mx-auto">
            <div className="flex-1 w-full sm:w-auto">
              <select
                value={selectedId || ""}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                disabled={voting}
                className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)] transition-colors appearance-none"
              >
                <option value="" disabled>{t("msg.selectBelow")}</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedId > 0 && (
                <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  {t("msg.votingFor")} <span className="font-medium text-[var(--color-text-primary)]">{candidates.find(c => c.id === selectedId)?.name}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleVote}
              disabled={voting || !selectedId}
              className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-[var(--color-text-primary)] px-8 py-3 text-sm font-medium text-[var(--color-bg-main)] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm whitespace-nowrap"
            >
              {voting && <Spinner size="sm" />}
              {voting ? t("btn.submitting") : t("btn.submitVote")}
            </button>
          </div>
        </div>
      )}

      {/* Results & Table Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
          <h2 className="text-xl font-serif text-[var(--color-text-primary)] mb-6">
            {t("label.liveResults")}
          </h2>
          <VoteChart candidates={candidates} />
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm">
          <h2 className="text-xl font-serif text-[var(--color-text-primary)] mb-6">
            {t("label.currentCandidates")}
          </h2>
          <CandidateTable candidates={candidates} />
        </div>
      </div>
    </div>
  );
}