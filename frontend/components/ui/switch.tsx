"use client";

import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200",
        checked ? "bg-grad-primary border-transparent" : "bg-white/10 border-white/10"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-[22px]" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function Select({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-10 rounded-xl border border-white/10 bg-base-900/60 px-3 text-sm text-ink-100 outline-none focus:border-accent-blue/60",
        className
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-base-900">
          {opt.label}
        </option>
      ))}
    </select>
  );
}
