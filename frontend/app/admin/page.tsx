"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getContract } from "@/lib/contract";
import Spinner from "@/components/ui/Spinner";
import Toast from "@/components/ui/Toast";
import { useLang } from "@/components/Providers";

// ─── Domain Types ─────────────────────────────────────────────────────────────

interface Candidate {
  id: number;
  name: string;
  bio: string;
  voteCount: number;
}

interface ToastState {
  message: string;
  type: "success" | "error";
}

type AuthState = "loading" | "unauthorized" | "authorized";

// ─── Validation Service ───────────────────────────────────────────────────────

class AdminValidator {
  static candidateName(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return "Candidate name is required";
    if (trimmed.length < 2) return "Name must be at least 2 characters";
    if (trimmed.length > 100) return "Name must be at most 100 characters";
    return null;
  }

  static votingPeriod(
    startInput: string,
    endInput: string
  ): { startUnix: number; endUnix: number } | { error: string } {
    if (!startInput || !endInput) {
      return { error: "Both start and end time are required" };
    }

    const startUnix = Math.floor(new Date(startInput).getTime() / 1000);
    const endUnix = Math.floor(new Date(endInput).getTime() / 1000);
    const nowUnix = Math.floor(Date.now() / 1000);

    if (isNaN(startUnix) || isNaN(endUnix)) {
      return { error: "Invalid date format" };
    }
    if (startUnix < nowUnix - 60) {
      return { error: "Start time cannot be in the past" };
    }
    if (endUnix <= startUnix) {
      return { error: "End time must be after start time" };
    }
    if (endUnix - startUnix < 60) {
      return { error: "Voting period must be at least 1 minute" };
    }

    return { startUnix, endUnix };
  }
}

// ─── Contract Service ─────────────────────────────────────────────────────────

class AdminContractService {
  static async fetchOwnerAndCandidates(
    showToast: (msg: string, type: "success" | "error") => void
  ): Promise<{ owner: string; candidates: Candidate[] } | null> {
    try {
      const contract: any = await getContract();
      const owner: string = await contract.owner();
      const count = Number(await contract.candidatesCount());
      const candidates: Candidate[] = [];

      for (let i = 1; i <= count; i++) {
        const raw = await contract.candidates(i);
        if (raw.name !== "") {
          candidates.push({
            id: Number(raw.id),
            name: raw.name,
            bio: raw.bio,
            voteCount: Number(raw.voteCount),
          });
        }
      }

      return { owner, candidates };
    } catch (err: any) {
      const msg = err?.message?.includes("Wrong network")
        ? err.message
        : "Failed to load admin data";
      showToast(msg, "error");
      return null;
    }
  }

  static resolveContractError(err: any): string {
    if (err.code === "ACTION_REJECTED" || err.code === 4001) {
      return "Transaction rejected by user";
    }
    return err.reason ?? err.message ?? "An unexpected error occurred";
  }

  static async addCandidate(name: string, bio: string): Promise<void> {
    const contract: any = await getContract(true);
    const tx = await contract.addCandidate(name.trim(), bio.trim());
    await tx.wait();
  }

  static async updateCandidate(
    id: number,
    name: string,
    bio: string
  ): Promise<void> {
    const contract: any = await getContract(true);
    const tx = await contract.updateCandidate(id, name.trim(), bio.trim());
    await tx.wait();
  }

  static async deleteCandidate(id: number): Promise<void> {
    const contract: any = await getContract(true);
    const tx = await contract.deleteCandidate(id);
    await tx.wait();
  }

  static async setVotingPeriod(
    startUnix: number,
    endUnix: number
  ): Promise<void> {
    const contract: any = await getContract(true);
    const tx = await contract.setVotingPeriod(startUnix, endUnix);
    await tx.wait();
  }
}

// ─── Confirm Dialog Helper ────────────────────────────────────────────────────

function confirm(message: string): boolean {
  return window.confirm(message);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 shadow-sm space-y-6 transition-colors hover:border-[var(--color-text-secondary)]">
      <h2 className="text-xl font-serif text-[var(--color-text-primary)]">
        {title}
      </h2>
      {children}
    </div>
  );
}

interface FieldErrorProps {
  message: string | null;
}

function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p className="text-xs text-red-500 mt-1 pl-1">{message}</p>
  );
}

// ─── Add Candidate Form ───────────────────────────────────────────────────────

interface AddCandidateFormProps {
  t: any;
  onSuccess: () => Promise<void>;
  showToast: (msg: string, type: "success" | "error") => void;
}

function AddCandidateForm({ t, onSuccess, showToast }: AddCandidateFormProps) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validate
    const nameErr = AdminValidator.candidateName(name);
    setNameError(nameErr);
    if (nameErr) return;

    // Confirm
    if (!confirm(`Are you sure you want to add "${name.trim()}" as a new candidate?`)) return;

    try {
      setLoading(true);
      await AdminContractService.addCandidate(name, bio);
      setName("");
      setBio("");
      setNameError(null);
      showToast(`Candidate "${name.trim()}" added successfully`, "success");
      await onSuccess();
    } catch (err: any) {
      showToast(AdminContractService.resolveContractError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <input
          type="text"
          placeholder={t("label.candidateName")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(AdminValidator.candidateName(e.target.value));
          }}
          className={`w-full border rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none transition-colors ${
            nameError
              ? "border-red-400 focus:border-red-500"
              : "border-[var(--color-border)] focus:border-[var(--color-text-primary)]"
          }`}
          disabled={loading}
        />
        <FieldError message={nameError} />
      </div>

      <textarea
        placeholder={t("label.candidateBio")}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        rows={3}
        className="w-full border border-[var(--color-border)] rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)] transition-colors resize-none"
        disabled={loading}
      />

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-[var(--color-text-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--color-bg-main)] font-medium px-8 py-3 rounded-xl transition-opacity whitespace-nowrap flex items-center gap-2"
        >
          {loading && (
            <span className="w-4 h-4 border-2 border-[var(--color-bg-main)]/40 border-t-[var(--color-bg-main)] rounded-full animate-spin" />
          )}
          {loading ? t("btn.adding") : t("btn.add")}
        </button>
      </div>
    </div>
  );
}

// ─── Voting Period Form ───────────────────────────────────────────────────────

interface VotingPeriodFormProps {
   t: any;
  showToast: (msg: string, type: "success" | "error") => void;
}

function VotingPeriodForm({ t, showToast }: VotingPeriodFormProps) {
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    // Validate
    const result = AdminValidator.votingPeriod(startInput, endInput);
    if ("error" in result) {
      setPeriodError(result.error);
      return;
    }

    setPeriodError(null);
    const { startUnix, endUnix } = result;

    const startStr = new Date(startUnix * 1000).toLocaleString();
    const endStr = new Date(endUnix * 1000).toLocaleString();

    if (!confirm(`Set voting period?\n\nStart: ${startStr}\nEnd: ${endStr}`)) return;

    try {
      setLoading(true);
      await AdminContractService.setVotingPeriod(startUnix, endUnix);
      showToast("Voting period updated successfully", "success");
      setStartInput("");
      setEndInput("");
    } catch (err: any) {
      showToast(AdminContractService.resolveContractError(err), "error");
    } finally {
      setLoading(false);
    }
  };

  const validateOnChange = (start: string, end: string) => {
    if (periodError) {
      const result = AdminValidator.votingPeriod(start, end);
      setPeriodError("error" in result ? result.error : null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            {t("label.startTime")}
          </label>
          <input
            type="datetime-local"
            value={startInput}
            onChange={(e) => {
              setStartInput(e.target.value);
              validateOnChange(e.target.value, endInput);
            }}
            className={`w-full border rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none transition-colors ${
              periodError
                ? "border-red-400 focus:border-red-500"
                : "border-[var(--color-border)] focus:border-[var(--color-text-primary)]"
            }`}
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            {t("label.endTime")}
          </label>
          <input
            type="datetime-local"
            value={endInput}
            onChange={(e) => {
              setEndInput(e.target.value);
              validateOnChange(startInput, e.target.value);
            }}
            className={`w-full border rounded-xl px-4 py-3 text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none transition-colors ${
              periodError
                ? "border-red-400 focus:border-red-500"
                : "border-[var(--color-border)] focus:border-[var(--color-text-primary)]"
            }`}
            disabled={loading}
          />
        </div>
      </div>

      <FieldError message={periodError} />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full sm:w-auto bg-[var(--color-text-primary)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--color-bg-main)] font-medium px-8 py-3 rounded-xl transition-opacity flex items-center gap-2"
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-[var(--color-bg-main)]/40 border-t-[var(--color-bg-main)] rounded-full animate-spin" />
        )}
        {loading ? t("btn.updating") : t("btn.setPeriod")}
      </button>
    </div>
  );
}

// ─── Candidate Row ────────────────────────────────────────────────────────────

interface CandidateRowProps {
  candidate: Candidate;
    t: any;
  onUpdated: () => Promise<void>;
  onDeleted: () => Promise<void>;
  showToast: (msg: string, type: "success" | "error") => void;
}

function CandidateRow({
  candidate,
  t,
  onUpdated,
  onDeleted,
  showToast,
}: CandidateRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(candidate.name);
  const [editBio, setEditBio] = useState(candidate.bio);
  const [nameError, setNameError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpdate = async () => {
    const nameErr = AdminValidator.candidateName(editName);
    setNameError(nameErr);
    if (nameErr) return;

    if (
      !confirm(
        `Are you sure you want to update candidate #${candidate.id} "${candidate.name}"?\n\nNew name: ${editName.trim()}`
      )
    )
      return;

    try {
      setUpdating(true);
      await AdminContractService.updateCandidate(candidate.id, editName, editBio);
      showToast(t("msg.candidateUpdated"), "success");
      setEditing(false);
      setNameError(null);
      await onUpdated();
    } catch (err: any) {
      showToast(AdminContractService.resolveContractError(err), "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `${t("msg.confirmDelete")}\n\nCandidate: "${candidate.name}" (ID: ${candidate.id})`
      )
    )
      return;

    try {
      setDeleting(true);
      await AdminContractService.deleteCandidate(candidate.id);
      showToast(t("msg.candidateDeleted"), "success");
      await onDeleted();
    } catch (err: any) {
      showToast(AdminContractService.resolveContractError(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditName(candidate.name);
    setEditBio(candidate.bio);
    setNameError(null);
  };

  return (
    <tr className="border-b border-[var(--color-border)]/50 last:border-0">
      <td className="px-4 py-4 text-[var(--color-text-secondary)] align-top w-12 text-sm">
        {candidate.id}
      </td>

      <td className="px-4 py-4 align-top">
        {editing ? (
          <div className="flex flex-col gap-2">
            <div>
              <input
                type="text"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value);
                  if (nameError) setNameError(AdminValidator.candidateName(e.target.value));
                }}
                className={`w-full border rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none transition-colors ${
                  nameError
                    ? "border-red-400 focus:border-red-500"
                    : "border-[var(--color-border)] focus:border-[var(--color-text-primary)]"
                }`}
                disabled={updating}
                autoFocus
              />
              <FieldError message={nameError} />
            </div>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={2}
              className="w-full border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] bg-[var(--color-bg-main)] focus:outline-none focus:border-[var(--color-text-primary)] resize-none transition-colors"
              disabled={updating}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-[var(--color-text-primary)] text-sm">
              {candidate.name}
            </span>
            {candidate.bio && (
              <span className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                {candidate.bio}
              </span>
            )}
          </div>
        )}
      </td>

      <td className="px-4 py-4 text-right align-top w-32">
        {editing ? (
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={handleUpdate}
              disabled={updating}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              {updating && (
                <span className="w-3 h-3 border-[1.5px] border-emerald-400/40 border-t-emerald-600 rounded-full animate-spin" />
              )}
              {t("btn.save")}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={updating}
              className="text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-40 transition-colors"
            >
              {t("btn.cancel")}
            </button>
          </div>
        ) : (
          <div className="flex justify-end gap-3 pt-1">
            <button
              onClick={() => setEditing(true)}
              disabled={deleting}
              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 transition-colors"
            >
              {t("btn.edit")}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              {deleting && (
                <span className="w-3 h-3 border-[1.5px] border-red-300/40 border-t-red-500 rounded-full animate-spin" />
              )}
              {deleting ? "…" : t("btn.delete")}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── Candidate Manager Table ──────────────────────────────────────────────────

interface CandidateManagerProps {
  candidates: Candidate[];
  t: any;
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type: "success" | "error") => void;
}

function CandidateManager({ candidates, t, onRefresh, showToast }: CandidateManagerProps) {
  return (
    <div className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--color-border)]">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-12">
              {t("table.number")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              {t("table.name")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider w-32">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="px-4 py-10 text-center text-sm text-[var(--color-text-secondary)]"
              >
                {t("msg.noCandidates")}
              </td>
            </tr>
          ) : (
            candidates.map((c) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                t={t}
                onUpdated={onRefresh}
                onDeleted={onRefresh}
                showToast={showToast}
              />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Gate Views ───────────────────────────────────────────────────────────────

function GateView({
  title,
  message,
  variant = "default",
}: {
  title: string;
  message: string;
  variant?: "default" | "error";
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div
        className={`text-center rounded-2xl border bg-[var(--color-card)] p-12 shadow-sm max-w-xl w-full ${
          variant === "error"
            ? "border-red-500/20"
            : "border-[var(--color-border)]"
        }`}
      >
        <h1
          className={`text-2xl font-serif mb-4 ${
            variant === "error"
              ? "text-red-500"
              : "text-[var(--color-text-primary)]"
          }`}
        >
          {title}
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm">{message}</p>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const { t } = useLang();

  const [mounted, setMounted] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("loading");
  const [account, setAccount] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // SSR guard
  useEffect(() => { setMounted(true); }, []);

  // Wallet detection
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
    return () => { window.ethereum?.removeListener("accountsChanged", handler); };
  }, [mounted]);

  // Load contract data
  const loadData = useCallback(async () => {
    const result = await AdminContractService.fetchOwnerAndCandidates(showToast);
    if (result) {
      setOwner(result.owner);
      setCandidates(result.candidates);
    }
    setDataLoading(false);
  }, [showToast]);

  useEffect(() => {
    if (!mounted || typeof window.ethereum === "undefined") {
      setDataLoading(false);
      return;
    }
    loadData();
  }, [mounted, loadData]);

  // Authorization: runs only after BOTH account and owner are resolved
  useEffect(() => {
    if (!account || !owner) return;

    if (account.toLowerCase() === owner.toLowerCase()) {
      setAuthState("authorized");
    } else {
      setAuthState("unauthorized");
      const timer = setTimeout(() => router.push("/"), 2000);
      return () => clearTimeout(timer);
    }
  }, [account, owner, router]);

  // ── Early returns (before authorized render) ──────────────────────────────

  if (!mounted) return null;

  if (typeof window.ethereum === "undefined") {
    return (
      <GateView
        title={t("msg.metamaskRequired")}
        message={t("msg.installMetamask")}
      />
    );
  }

  // Show spinner until BOTH data is loaded AND auth is determined
  if (dataLoading || (account && owner && authState === "loading")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!account) {
    return (
      <GateView
        title={t("msg.walletNotConnected")}
        message={t("msg.connectToAccess")}
      />
    );
  }

  if (authState === "unauthorized") {
    return (
      <GateView
        title={t("msg.accessDenied")}
        message={t("msg.notOwner")}
        variant="error"
      />
    );
  }

  // Prevent flash of admin content during initial auth check
  if (authState !== "authorized") return null;

  // ── Authorized admin view ──────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-12 px-4">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Page header */}
      <div className="border-b border-[var(--color-border)] pb-6">
        <h1 className="text-3xl font-serif text-[var(--color-text-primary)]">
          {t("label.adminPanel")}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)] font-mono">
          {owner}
        </p>
      </div>

      {/* Add Candidate */}
      <SectionCard title={t("label.addCandidate")}>
        <AddCandidateForm
          t={t}
          onSuccess={loadData}
          showToast={showToast}
        />
      </SectionCard>

      {/* Set Voting Period */}
      <SectionCard title={t("label.setVotingPeriod")}>
        <VotingPeriodForm t={t} showToast={showToast} />
      </SectionCard>

      {/* Candidate Manager */}
      <SectionCard title={t("label.currentCandidates")}>
        <CandidateManager
          candidates={candidates}
          t={t}
          onRefresh={loadData}
          showToast={showToast}
        />
      </SectionCard>
    </div>
  );
}
