"use client";

import Link from "next/link";
import {
  FileUp,
  History,
  MessageSquare,
  FileText,
  Settings,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { useAppSettings } from "@/components/providers/app-providers";
import { useAuth } from "@/components/providers/auth-provider";

const TOOLS = [
  {
    href: "/dashboard/upload",
    icon: FileUp,
    title: "home.upload",
    desc: "home.uploadDesc",
    tint: "text-[#4f7cff]",
    bg: "bg-[#4f7cff]/10 border-[#4f7cff]/30",
  },
  {
    href: "/dashboard/chat",
    icon: MessageSquare,
    title: "home.chat",
    desc: "home.chatDesc",
    tint: "text-[#4f7cff]",
    bg: "bg-[#4f7cff]/10 border-[#4f7cff]/30",
  },
  {
    href: "/dashboard/history",
    icon: History,
    title: "home.history",
    desc: "home.historyDesc",
    tint: "text-[#4F7CFF]",
    bg: "bg-[#4F7CFF]/10 border-[#4F7CFF]/30",
  },
  {
    href: "/dashboard/reports",
    icon: FileText,
    title: "nav.reports",
    desc: "home.uploadDesc",
    tint: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/30",
  },
  {
    href: "/dashboard/settings",
    icon: Settings,
    title: "home.settings",
    desc: "home.settingsDesc",
    tint: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/30",
  },
];

const QUICK = [
  { href: "/dashboard/upload", label: "تنظيف ملف جديد", icon: FileUp },
  { href: "/dashboard/chat", label: "اسأل الوكيل", icon: MessageSquare },
  { href: "/dashboard/history", label: "التاريخ", icon: History },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useAppSettings();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(50% 60% at 20% 0%, rgba(79,124,255,0.14) 0%, transparent 70%)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4f7cff] bg-[#4f7cff]/10 border border-[#4f7cff]/30 rounded-full px-3 py-1 mb-4">
            <ShieldCheck className="w-3.5 h-3.5" />
            بياناتك محفوظة ومعزولة
          </span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t("home.welcome", { name: user?.username || "Guest" })}
          </h1>
          <p className="text-white/55 mt-2 max-w-xl">{t("home.subtitle")}</p>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2 mt-5">
            {QUICK.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group inline-flex items-center gap-2 bg-white/[0.04] border border-white/15 hover:border-[#4f7cff]/50 rounded-full px-4 py-2 text-sm text-white/75 hover:text-white transition"
              >
                <Icon className="w-4 h-4 text-[#4f7cff]" />
                {label}
                <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { icon: Clock, label: "آخر نشاط", value: "اليوم" },
          { icon: Sparkles, label: "حالة الوكيل", value: "جاهز" },
          { icon: ShieldCheck, label: "التخزين", value: "محلي وآمن" },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-[#4f7cff]/10 border border-[#4f7cff]/30 flex items-center justify-center">
              <Icon className="w-5 h-5 text-[#4f7cff]" />
            </div>
            <div>
              <div className="text-xs text-white/50">{label}</div>
              <div className="font-semibold">{value}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Tool cards */}
      <section>
        <h2 className="text-lg font-bold mb-4 tracking-tight">الأدوات</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOOLS.map(({ href, icon: Icon, title, desc, tint, bg }) => (
            <Link
              key={href}
              href={href}
              className="group bg-white/[0.03] border border-white/10 hover:border-[#4f7cff]/40 rounded-2xl p-5 transition hover:-translate-y-0.5"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${bg} ${tint}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold">{t(title)}</h3>
              <p className="text-sm text-white/50 mt-1">{t(desc)}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
