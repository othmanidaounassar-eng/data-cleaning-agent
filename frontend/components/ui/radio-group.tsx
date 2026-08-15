"use client";

import { cn } from "@/lib/utils";

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  name,
}: {
  value: T;
  onChange: (v: T) => void;
  options: RadioOption<T>[];
  name: string;
}) {
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            name={name}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors",
              active
                ? "border-accent-blue/50 bg-accent-blue/[0.08]"
                : "border-white/10 bg-white/[0.02] hover:border-white/20",
            )}
          >
            <div className="flex items-center gap-2">
              {Icon && (
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    active ? "text-accent-blue" : "text-ink-500",
                  )}
                />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  active ? "text-ink-100" : "text-ink-300",
                )}
              >
                {opt.label}
              </span>
            </div>
            {opt.description && (
              <span className="text-[11px] text-ink-500">
                {opt.description}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
