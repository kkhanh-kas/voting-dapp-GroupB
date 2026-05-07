import React from "react";

interface SpinnerProps {
  size?: "sm" | "md";
}

export default function Spinner({ size = "md" }: SpinnerProps) {
  if (size === "sm") {
    return (
      <span className="inline-block w-4 h-4 border-2 border-current/25 border-t-current rounded-full animate-spin" />
    );
  }

  return (
    <div className="flex justify-center py-6">
      <div className="w-8 h-8 border-[3px] border-[var(--color-border)] border-t-[var(--color-text-primary)] rounded-full animate-spin"></div>
    </div>
  );
}