"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose?: () => void;
  duration?: number;
}

export default function Toast({
  message,
  type = "success",
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    if (!onClose) return;

    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium shadow-sm border transition-all ${
        type === "success" 
          ? "bg-[var(--color-card)] border-emerald-500/20 text-[var(--color-text-primary)]" 
          : "bg-[var(--color-card)] border-red-500/20 text-[var(--color-text-primary)]"
      }`}
      role="alert"
    >
      {type === "success" ? (
        <CheckCircle2 className="text-emerald-500" size={18} strokeWidth={2} />
      ) : (
        <AlertCircle className="text-red-500" size={18} strokeWidth={2} />
      )}
      
      <span>{message}</span>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="ml-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          aria-label="Close notification"
        >
          <X size={16} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}