import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  return (
    <div className="glass rounded-xl2 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-500">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05]">
          <Icon className="h-4 w-4 text-accent-blue" />
        </div>
      </div>
      <p className="mt-3 font-display font-mono text-2xl font-semibold text-ink-100 tabular-nums">
        {value}
      </p>
      {trend && (
        <p
          className={cn(
            "mt-1 text-[11px] font-medium",
            tone === "good" && "text-signal-good",
            tone === "warn" && "text-signal-warn",
            tone === "neutral" && "text-ink-500",
          )}
        >
          {trend}
        </p>
      )}
    </div>
  );
}
