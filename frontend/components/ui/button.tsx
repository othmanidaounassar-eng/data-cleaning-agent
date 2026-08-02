"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and disables the button — for async submits / uploads. */
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-grad-primary text-white shadow-glow-blue hover:brightness-110 active:brightness-95",
  secondary:
    "bg-base-800 text-ink-100 border border-base-600 hover:bg-base-700",
  outline:
    "bg-transparent border border-white/10 text-ink-100 hover:bg-white/5",
  ghost: "bg-transparent text-ink-300 hover:text-ink-100 hover:bg-white/5",
  danger: "bg-signal-bad/15 text-signal-bad border border-signal-bad/30 hover:bg-signal-bad/25",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-12 px-6 text-sm rounded-xl gap-2",
  icon: "h-9 w-9 rounded-lg",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none select-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
