"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Moon,
  Sun,
  Languages,
  LogOut,
  LayoutDashboard,
  FileUp,
  BarChart3,
  History,
  MessageSquare,
  FileText,
  HelpCircle,
  Settings,
  GitMerge,
  Layers,
  PieChart,
  Workflow,
} from "lucide-react";
import { useAppSettings } from "@/components/providers/app-providers";
import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspaces } from "@/components/providers/workspace-provider";
import { WorkTool } from "@/lib/workspace";
import { UploadStatusBanner } from "@/components/dashboard/upload-status-banner";
import { UploadProgressBar } from "@/components/dashboard/upload-progress-bar";

// Nav entries. Tool-specific pages carry the WorkTool they belong to so
// they can be hidden when the user didn't select that agent for the active
// workspace. Entries with `tool: undefined` are always shown.
const NAV: Array<{
  href: string;
  icon: typeof LayoutDashboard;
  key: string;
  tool?: WorkTool;
}> = [
  { href: "/dashboard", icon: LayoutDashboard, key: "nav.dashboard" },
  { href: "/dashboard/pipeline", icon: Workflow, key: "nav.pipeline" },
  { href: "/dashboard/upload", icon: FileUp, key: "nav.clean", tool: "clean" },
  {
    href: "/dashboard/analyze",
    icon: BarChart3,
    key: "nav.analyze",
    tool: "analyze",
  },
  {
    href: "/dashboard/charts",
    icon: PieChart,
    key: "nav.charts",
    tool: "charts",
  },
  {
    href: "/dashboard/reports",
    icon: FileText,
    key: "nav.reports",
    tool: "reports",
  },
  { href: "/dashboard/history", icon: History, key: "nav.history" },
  { href: "/dashboard/tools", icon: GitMerge, key: "nav.tools" },
  { href: "/dashboard/chat", icon: MessageSquare, key: "nav.chat" },
  { href: "/dashboard/workspaces", icon: Layers, key: "nav.workspaces" },
  { href: "/dashboard/support", icon: HelpCircle, key: "nav.support" },
  { href: "/dashboard/settings", icon: Settings, key: "nav.settings" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, toggleTheme, toggleLang, t } = useAppSettings();
  const { user, loading, logout } = useAuth();
  const { activeWork, switchWorkspace, workspaces, setupDone } =
    useWorkspaces();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!setupDone || !activeWork) {
      if (pathname !== "/dashboard/workspaces") {
        router.replace("/dashboard/workspaces");
      }
    }
  }, [loading, user, setupDone, activeWork, pathname, router]);

  if (loading || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-16 lg:w-60 border-r border-white/10 bg-white/[0.02] px-2 py-4 sticky top-0 h-screen">
        <Link href="/" className="flex items-center gap-2 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
            <span className="text-xl font-extrabold text-white">O</span>
          </div>
          <span className="hidden lg:inline text-lg font-bold tracking-tight">
            OQZARO
          </span>
        </Link>

        <nav className="flex-1 space-y-1">
          {NAV.filter(
            (item) =>
              !item.tool ||
              !activeWork ||
              (activeWork.tools && activeWork.tools.includes(item.tool)),
          ).map(({ href, icon: Icon, key }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm transition ${
                  active
                    ? "bg-[#4f7cff]/10 text-[#4f7cff] border border-[#4f7cff]/30"
                    : "text-white/60 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="hidden lg:inline font-medium">{t(key)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 pt-3 mt-3">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center font-bold text-white text-sm shrink-0">
              {user.username?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-sm font-medium truncate">
                {user.username}
              </div>
              <button
                onClick={logout}
                className="text-xs text-white/40 hover:text-[#4f7cff] transition flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" /> {t("topbar.logout")}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Global upload progress bar (visible on every page while a job runs) */}
        <UploadProgressBar />
        {/* Persistent file status banner (shows at top on every dashboard page) */}
        <UploadStatusBanner />

        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-[var(--bg)]/80 backdrop-blur-xl px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3 md:hidden">
            <Link
              href="/"
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center"
            >
              <span className="text-white font-extrabold">O</span>
            </Link>
            <span className="font-bold">OQZARO</span>
          </div>

          <div className="hidden md:block text-sm text-white/50">
            {t("nav.agent")}
          </div>

          {/* Active workspace switcher */}
          {activeWork && (
            <div className="flex items-center gap-2 text-sm">
              <span
                className={`w-6 h-6 rounded-lg bg-gradient-to-br ${activeWork.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}
              >
                {activeWork.name.charAt(0).toUpperCase()}
              </span>
              <select
                value={activeWork.id}
                onChange={(e) => switchWorkspace(e.target.value)}
                title={t("ws.switch")}
                aria-label={t("ws.switch")}
                className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white/70 outline-none focus:border-[#4f7cff]/50 max-w-[140px]"
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={toggleTheme}
              title={t("topbar.theme")}
              aria-label={t("topbar.theme")}
              className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-[#4f7cff] hover:border-[#4f7cff]/40 transition"
            >
              {theme === "dark" ? (
                <Moon className="w-4 h-4" />
              ) : (
                <Sun className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleLang}
              title={t("topbar.language")}
              aria-label={t("topbar.language")}
              className="w-9 h-9 rounded-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-[#4f7cff] hover:border-[#4f7cff]/40 transition"
            >
              <Languages className="w-4 h-4" />
            </button>
            {user && (
              <button
                type="button"
                onClick={logout}
                title={t("topbar.logout")}
                aria-label={t("topbar.logout")}
                className="w-9 h-9 md:hidden rounded-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-red-500 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        <main className="p-4 lg:p-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
