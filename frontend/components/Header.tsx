"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme, useLang } from "@/components/Providers";
import { Sun, Moon, Globe, ChevronDown, Wallet, LogOut } from "lucide-react";
import { getContract } from "@/lib/contract";
import Toast from "@/components/ui/Toast";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function Header() {
  const [account, setAccount] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const langRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const connectWallet = async () => {
    if (typeof window.ethereum === "undefined") {
      setError(t("msg.metamaskRequired"));
      return;
    }

    try {
      const accounts: string[] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        setError(null);

        try {
          const contract: any = await getContract();
          const ownerAddr = await contract.owner();
          const isAdmin = accounts[0].toLowerCase() === ownerAddr.toLowerCase();
          setIsOwner(isAdmin);
          showToast(
            isAdmin ? t("toast.welcomeAdmin") : t("toast.connectedVoter"),
            isAdmin ? "info" : "success"
          );
        } catch { /* owner check failed silently */ }
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      console.error("Wallet connect error:", e.code, e.message ?? String(err));
      setError(
        e.code === 4001
          ? t("error.connectionRejected")
          : t("error.connectWallet")
      );
    }
  };

  useEffect(() => {
    if (typeof window.ethereum === "undefined") return;

    const checkOwner = async (addr: string) => {
      try {
        const contract: any = await getContract();
        const ownerAddr = await contract.owner();
        setIsOwner(addr.toLowerCase() === ownerAddr.toLowerCase());
      } catch (err) {
        console.error("Failed to check owner:", err);
        setIsOwner(false);
      }
    };

    window.ethereum
      .request({ method: "eth_accounts" })
      .then((accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          checkOwner(accounts[0]);
        }
      });

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        checkOwner(accounts[0]);
      } else {
        setAccount(null);
        setIsOwner(false);
      }
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);

    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
      if (walletRef.current && !walletRef.current.contains(event.target as Node)) {
        setIsWalletOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDisconnect = () => {
    setAccount(null);
    setIsOwner(false);
    setIsWalletOpen(false);
  };

  const navLinks = [
    { href: "/", label: t("nav.vote") },
    ...(isOwner ? [{ href: "/admin", label: t("nav.admin") }] : []),
  ];

  return (
    <header className="border-b border-[var(--color-border)] bg-[var(--color-bg-main)]/80 backdrop-blur-md sticky top-0 z-50">
      {toast && <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast(null)} />}
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-[var(--color-text-primary)] font-serif"
          >
            dApp<span className="italic">Vote</span>
          </Link>

          {account && (
            <nav className="hidden sm:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-[var(--color-text-primary)] text-[var(--color-bg-main)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50 hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50 transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon size={20} strokeWidth={1.5} /> : <Sun size={20} strokeWidth={1.5} />}
          </button>

          <div className="relative" ref={langRef}>
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-2 p-2 rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50 transition-colors text-sm font-medium"
            >
              <Globe size={20} strokeWidth={1.5} />
              <span className="hidden sm:inline">{t("label.language")}</span>
              <ChevronDown size={16} strokeWidth={1.5} className={`transition-transform ${isLangOpen ? "rotate-180" : ""}`} />
            </button>

            {isLangOpen && (
              <div className="absolute right-0 mt-2 w-40 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm py-2">
                <button
                  onClick={() => { setLang("en"); setIsLangOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${lang === "en" ? "font-semibold text-[var(--color-text-primary)] bg-[var(--color-border)]/30" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50 hover:text-[var(--color-text-primary)]"}`}
                >
                  English
                </button>
                <button
                  onClick={() => { setLang("vi"); setIsLangOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${lang === "vi" ? "font-semibold text-[var(--color-text-primary)] bg-[var(--color-border)]/30" : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50 hover:text-[var(--color-text-primary)]"}`}
                >
                  Tiếng Việt
                </button>
              </div>
            )}
          </div>

          {error && (
            <span className="hidden sm:inline text-xs text-red-500 max-w-[200px] truncate">
              {error}
            </span>
          )}

          {account ? (
            <div className="relative" ref={walletRef}>
              <button
                onClick={() => setIsWalletOpen(!isWalletOpen)}
                className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 shadow-sm hover:bg-[var(--color-border)]/30 transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm font-mono text-[var(--color-text-primary)]">
                  {truncateAddress(account)}
                </span>
                <ChevronDown size={14} strokeWidth={1.5} className={`text-[var(--color-text-secondary)] transition-transform ${isWalletOpen ? "rotate-180" : ""}`} />
              </button>

              {isWalletOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-[var(--color-border)]/50 bg-[var(--color-border)]/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">{t("label.role")}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isOwner ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>
                        {isOwner ? t("badge.admin") : t("badge.voter")}
                      </span>
                    </div>
                    <div className="text-sm font-mono text-[var(--color-text-primary)] break-all bg-[var(--color-bg-main)] p-2 rounded-lg border border-[var(--color-border)]/50 select-all">
                      {account}
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="flex items-center justify-center gap-2 w-full p-3 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <LogOut size={16} strokeWidth={2} />
                    {t("btn.disconnect")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={connectWallet}
              className="flex items-center gap-2 rounded-full bg-[var(--color-text-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-bg-main)] transition-opacity hover:opacity-90 shadow-sm"
            >
              <Wallet size={18} strokeWidth={1.5} />
              <span>{t("btn.connect")}</span>
            </button>
          )}
        </div>
      </div>

      {account && (
        <nav className="flex sm:hidden items-center gap-2 px-4 pb-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "bg-[var(--color-text-primary)] text-[var(--color-bg-main)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50 hover:text-[var(--color-text-primary)]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}