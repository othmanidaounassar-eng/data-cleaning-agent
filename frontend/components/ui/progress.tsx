import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  barClassName,
}: {
  value: number;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}>
      <div
        className={cn("h-full rounded-full bg-grad-primary transition-all duration-500 ease-out", barClassName)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
