import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-xl border border-white/10 bg-base-900/60 px-3.5 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition-colors focus:border-accent-blue/60",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium text-ink-300", className)} {...props} />;
}
