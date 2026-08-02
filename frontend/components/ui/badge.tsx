import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "good" | "warn" | "bad" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-ink-300 border-white/10",
  good: "bg-signal-good/10 text-signal-good border-signal-good/25",
  warn: "bg-signal-warn/10 text-signal-warn border-signal-warn/25",
  bad: "bg-signal-bad/10 text-signal-bad border-signal-bad/25",
  accent: "bg-accent-blue/10 text-accent-blue border-accent-blue/25",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
