"use client";

import { Bell, Search } from "lucide-react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-white/[0.06] bg-base-950/70 px-6 py-4 backdrop-blur-xl sticky top-0 z-10">
      <div>
        <h1 className="font-display text-lg font-semibold text-ink-100">{title}</h1>
        {subtitle && <p className="text-xs text-ink-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-ink-500 w-56">
          <Search className="h-3.5 w-3.5" />
          Search datasets, reports…
        </div>
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-ink-300 hover:text-ink-100">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-accent-violet" />
        </button>
        <div className="h-9 w-9 rounded-xl bg-grad-primary flex items-center justify-center text-xs font-semibold text-white">
          AI
        </div>
      </div>
    </header>
  );
}
