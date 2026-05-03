"use client";

import { InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={clsx(
          "w-full bg-white text-black",
          "border-0 border-b-2 border-black",
          "px-0 py-4",
          "text-lg",
          "placeholder:text-neutral-500",
          "placeholder:italic",
          "outline-none",
          "transition-none",
          "focus:border-b-4",
          "focus-visible:border-b-4",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export default Input;