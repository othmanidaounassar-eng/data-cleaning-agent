"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UploadCloud,
  History,
  FileText,
  Settings,
  LifeBuoy,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/upload", label: "Upload Dataset", icon: UploadCloud },
  { href: "/dashboard/history", label: "Cleaning History", icon: History },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/[0.06] bg-base-900/60 backdrop-blur-xl px-4 py-6">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 mb-8">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-grad-primary shadow-glow-blue">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="font-display text-sm font-semibold text-ink-100">
          Cleaning Agent
        </span>
      </Link>

      <nav className="flex flex-col gap-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-white/[0.06] text-ink-100"
                  : "text-ink-500 hover:text-ink-100 hover:bg-white/[0.03]"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0",
                  active ? "text-accent-blue" : "text-ink-500 group-hover:text-ink-300"
                )}
              />
              {item.label}
              {active && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-blue" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl2 glass p-4">
        <p className="text-xs font-medium text-ink-100">Agent status</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-good animate-pulse-node" />
          Online · Client-side engine
        </p>
      </div>
    </aside>
  );
}
