"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({
  checked,
  onChange,
  label,
  required,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  required?: boolean;
  id?: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex items-start gap-2.5 cursor-pointer select-none"
    >
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        aria-required={required}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors",
          checked
            ? "bg-grad-primary border-transparent"
            : "bg-base-900/60 border-white/15 hover:border-white/25",
        )}
      >
        {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </button>
      {label && (
        <span className="text-xs text-ink-300 leading-relaxed">{label}</span>
      )}
    </label>
  );
}
