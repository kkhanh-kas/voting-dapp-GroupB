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
  // Shown in admin view so owner can see vote distribution before editing/removing.
  voteCount: number;
}

interface ToastState {
  message: string;
  type: "success" | "error";
}

// Discriminated union beats two booleans — eliminates the impossible
// `isLoading && isAuthorized` state and makes render branches exhaustive.
type AuthState = "loading" | "unauthorized" | "authorized";

// ─── Constants ────────────────────────────────────────────────────────────────

// Long enough to read "Access Denied", short enough not to feel stuck.
const UNAUTHORIZED_REDIRECT_DELAY_MS = 2000;

const TOAST_DURATION_MS = 4000;

// Accounts for ~1-block latency between Submit click and tx mine time.
// Without this, a valid startTime≈now gets rejected client-side.
const PAST_START_GRACE_SECONDS = 60;

// Prevents zero-duration elections from identical start/end timestamps.
const MIN_VOTING_PERIOD_SECONDS = 60;

// ─── Validation Service ───────────────────────────────────────────────────────

// Pure validation helpers — no side effects, no contract calls.
// Static class so they can be unit-tested without mounting any component.
class AdminValidator {
  // 100-char limit mirrors the Solidity storage constraint.
  // Catching it here gives instant feedback without burning gas.
  static candidateName(name: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return "Candidate name is required";
    if (trimmed.length < 2) return "Name must be at least 2 characters";
    if (trimmed.length > 100) return "Name must be at most 100 characters";
    return null;
  }

  // Validates a datetime-local pair and converts to Unix timestamps for
  // `setVotingPeriod(uint256, uint256)`. All rules here mirror on-chain modifiers —
  // client-side check saves gas on a doomed tx and gives instant UX feedback.
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
    if (startUnix < nowUnix - PAST_START_GRACE_SECONDS) {
      return { error: "Start time cannot be in the past" };
    }
    if (endUnix <= startUnix) {
      return { error: "End time must be after start time" };
    }
    if (endUnix - startUnix < MIN_VOTING_PERIOD_SECONDS) {
      return { error: "Voting period must be at least 1 minute" };
    }

    return { startUnix, endUnix };
  }
}

// ─── Contract Service ─────────────────────────────────────────────────────────

// Thin facade over admin-only contract writes.
// Always awaits tx.wait() before resolving so callers re-fetch committed state.
// Errors are not caught here — callers own the try/catch for loading state.
class AdminContractService {
  // Fetches owner + full candidate list in one pass.
  // Skips empty-name slots — contract soft-deletes by clearing `name`,
  // so IDs are non-contiguous after deletions.
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
      // "Wrong network" is the most common issue — MetaMask pointed at mainnet
      // instead of local/test chain.
      const msg = err?.message?.includes("Wrong network")
        ? err.message
        : "Failed to load admin data";
      showToast(msg, "error");
      return null;
    }
  }

  // Normalizes Ethers.js + MetaMask errors into a display string.
  // ACTION_REJECTED = Ethers v6; 4001 = legacy EIP-1193 (older MetaMask builds).
  static resolveContractError(err: any): string {
    if (err.code === "ACTION_REJECTED" || err.code === 4001) {
      return "Transaction rejected by user";
    }
    return err.reason ?? err.message ?? "An unexpected error occurred";
  }

  // getContract(true) requests a signer → MetaMask prompts user to sign.
  // tx.wait() blocks until included in a block, so subsequent loadData() sees the new row.
  static async addCandidate(name: string, bio: string): Promise<void> {
    const contract: any = await getContract(true);
    const tx = await contract.addCandidate(name.trim(), bio.trim());
    await tx.wait();
  }

  /** Overwrites an existing candidate's `name` and `bio` on-chain. */
  static async updateCandidate(
    id: number,
    name: string,
    bio: string
  ): Promise<void> {
    const contract: any = await getContract(true);
    const tx = await contract.updateCandidate(id, name.trim(), bio.trim());
    await tx.wait();
  }

  // Soft-delete: clears `name` field on-chain. Vote data stays in the mapping
  // for audit purposes.
  static async deleteCandidate(id: number): Promise<void> {
    const contract: any = await getContract(true);
    const tx = await contract.deleteCandidate(id);
    await tx.wait();
  }

  // Both values are Unix seconds. block.timestamp can drift ±15s on PoS Ethereum
  // — that's why PAST_START_GRACE_SECONDS exists in the validator.
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

// Named wrapper to avoid accidentally shadowing `window` in SSR/test environments.
function confirm(message: string): boolean {
  return window.confirm(message);
}

// ─── Shared UI Primitives ─────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

/** Consistent card shell used by every admin panel section. */
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
  /** Called after confirmed tx to re-sync the parent's candidate list. */
  onSuccess: () => Promise<void>;
  showToast: (msg: string, type: "success" | "error") => void;
}

// Submit flow: validate → confirm → MetaMask sign → tx.wait() → onSuccess()
// Local `loading` locks the form for the full async lifecycle to prevent
// duplicate submissions while a tx is in-flight.
function AddCandidateForm({ t, onSuccess, showToast }: AddCandidateFormProps) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const nameErr = AdminValidator.candidateName(name);
    setNameError(nameErr);
    if (nameErr) return;

    if (!confirm(`Are you sure you want to add "${name.trim()}" as a new candidate?`)) return;

    try {
      setLoading(true);
      await AdminContractService.addCandidate(name, bio);
      setName("");
      setBio("");
      setNameError(null);
      showToast(`Candidate "${name.trim()}" added successfully`, "success");
      // Re-fetch after confirmed tx so the table reflects committed on-chain state.
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
            // Only re-validate after a failed submit — clears error as input becomes valid.
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

// datetime-local gives a local-timezone string; validator converts to UTC Unix
// seconds. Contract uses block.timestamp (always UTC) so no extra TZ handling needed.
// Live re-validation only kicks in after a failed submit — avoids marking a
// half-filled form as invalid mid-typing.
function VotingPeriodForm({ t, showToast }: VotingPeriodFormProps) {
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const result = AdminValidator.votingPeriod(startInput, endInput);
    if ("error" in result) {
      setPeriodError(result.error);
      return;
    }

    setPeriodError(null);
    const { startUnix, endUnix } = result;

    // Show human-readable timestamps in the confirm — this controls election access.
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

  // Re-runs validation only while an error is visible, so the border clears
  // as soon as the input becomes valid.
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
  /** Triggered after confirmed update tx — parent re-fetches. */
  onUpdated: () => Promise<void>;
  /** Triggered after confirmed delete tx — parent re-fetches. */
  onDeleted: () => Promise<void>;
  showToast: (msg: string, type: "success" | "error") => void;
}

// Edit state is row-local — toggling one row doesn't affect siblings.
// `updating` and `deleting` are separate so each action button has its own
// loading indicator and neither blocks the other.
// On cancel, fields reset to current props (last known on-chain values),
// not to the unsaved draft — guards against a background re-fetch mid-edit.
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
      // Parent unmounts this row after re-fetch — no further local state updates.
      await onDeleted();
    } catch (err: any) {
      showToast(AdminContractService.resolveContractError(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  /** Resets draft fields to last known on-chain values from props. */
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
  /** Passed to each row — re-fetches the full list after any mutation. */
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

// Covers four cases: no MetaMask, not connected, unauthorized address, redirect window.
// `error` variant = security boundary (wrong account); `default` = missing prerequisite.
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

// Owner-only admin panel. Auth flow:
// 1. `mounted` gate defers window.ethereum access to client (SSR safety).
// 2. `loadData` fetches contract owner + candidates; `dataLoading` tracks the flight.
// 3. Separate effect compares wallet vs owner once both settle → sets authState.
// 4. Spinner held until both resolve — prevents auth flash between state updates.
// 5. Unauthorized address triggers delayed redirect (readable "Access Denied").
//
// `loadData` is the single source of truth for candidate list.
// Every mutating action calls it after tx confirmation.
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

  // Stable ref so child components don't re-render when parent updates.
  // Cancels any pending dismiss before scheduling the new one.
  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  // Prevent setState on unmounted component (React dev warning).
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Defer to client before touching `window` — component is "use client" but
  // still runs on the server during initial HTML render in App Router.
  useEffect(() => { setMounted(true); }, []);

  // eth_accounts is silent (no popup); eth_requestAccounts would prompt the user.
  // Subscribes to account switches and cleans up on unmount to avoid stale setState.
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

  // showToast is stable (empty-dep useCallback), safe to include in deps
  // without causing spurious re-fetches.
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

  // Normalize checksum casing before comparing addresses (EIP-55).
  // Depends on dataLoading so the effect re-runs once the fetch settles —
  // handles the race where account arrives before the contract fetch completes.
  // Cleanup cancels the redirect if the user reconnects with an authorized account
  // before UNAUTHORIZED_REDIRECT_DELAY_MS elapses.
  useEffect(() => {
    if (!account || !owner) return;

    if (account.toLowerCase() === owner.toLowerCase()) {
      setAuthState("authorized");
    } else {
      setAuthState("unauthorized");
      const timer = setTimeout(() => router.push("/"), UNAUTHORIZED_REDIRECT_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [account, owner, router]);

  // ── Authorization gate (early returns) ────────────────────────────────────

  // Hold all output until client hydrates — avoids SSR/client HTML mismatch.
  if (!mounted) return null;

  if (typeof window.ethereum === "undefined") {
    return (
      <GateView
        title={t("msg.metamaskRequired")}
        message={t("msg.installMetamask")}
      />
    );
  }

  // authState stays "loading" even after dataLoading flips — the auth useEffect
  // runs on the next render cycle. Without this guard there's a single-frame
  // white flash between spinner unmount and gate render.
  if (dataLoading || authState === "loading") {
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

  // Defensive: don't leak admin UI into an indeterminate auth state.
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

      {/* Owner address as trust signal — confirms connected wallet = contract deployer. */}
      <div className="border-b border-[var(--color-border)] pb-6">
        <h1 className="text-3xl font-serif text-[var(--color-text-primary)]">
          {t("label.adminPanel")}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)] font-mono">
          {owner}
        </p>
      </div>

      <SectionCard title={t("label.addCandidate")}>
        <AddCandidateForm
          t={t}
          onSuccess={loadData}
          showToast={showToast}
        />
      </SectionCard>

      <SectionCard title={t("label.setVotingPeriod")}>
        <VotingPeriodForm t={t} showToast={showToast} />
      </SectionCard>

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
