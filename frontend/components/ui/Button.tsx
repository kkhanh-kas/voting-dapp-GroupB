"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

const clsx = (...args: any[]) => {
  const classes: string[] = [];
  for (const arg of args) {
    if (typeof arg === 'string') classes.push(arg);
    else if (Array.isArray(arg)) classes.push(...arg.filter(Boolean));
  }
  return classes.join(' ');
};

type ButtonVariant = "primary" | "outline" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
}

export default function Button({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-[48px] items-center justify-center",
        "px-8 py-4",
        "border-2 border-black",
        "uppercase tracking-[0.18em]",
        "text-xs md:text-sm",
        "font-medium",
        "transition-none",
        "focus-visible:outline",
        "focus-visible:outline-4",
        "focus-visible:outline-black",
        "focus-visible:outline-offset-4",
        "disabled:cursor-not-allowed disabled:opacity-40",

        variant === "primary" && [
          "bg-black text-white",
          "hover:bg-white hover:text-black",
        ],

        variant === "outline" && [
          "bg-white text-black",
          "hover:bg-black hover:text-white",
        ],

        variant === "ghost" && [
          "border-transparent bg-transparent text-black",
          "hover:underline",
        ],

        className
      )}
      {...props}
    >
      <span className="flex items-center gap-3">
        {children}
        {variant !== "ghost" && <span aria-hidden>→</span>}
      </span>
    </button>
  );
}