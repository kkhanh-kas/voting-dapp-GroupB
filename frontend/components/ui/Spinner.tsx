import React from "react";

export default function Spinner() {
  return (
    <div className="flex justify-center py-6">
      <div className="w-8 h-8 border-[3px] border-[var(--color-border)] border-t-[var(--color-text-primary)] rounded-full animate-spin"></div>
    </div>
  );
}