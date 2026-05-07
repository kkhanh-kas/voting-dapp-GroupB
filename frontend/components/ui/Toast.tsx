"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose?: () => void;
  duration?: number;
}

const toastStyles = {
  success: { border: "border-emerald-500/20", icon: <CheckCircle2 className="text-emerald-500" size={18} strokeWidth={2} /> },
  error: { border: "border-red-500/20", icon: <AlertCircle className="text-red-500" size={18} strokeWidth={2} /> },
  info: { border: "border-amber-500/20", icon: <Info className="text-amber-500" size={18} strokeWidth={2} /> },
};

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

  const style = toastStyles[type];

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium shadow-sm border transition-all bg-[var(--color-card)] text-[var(--color-text-primary)] ${style.border}`}
      role="alert"
    >
      {style.icon}
      
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