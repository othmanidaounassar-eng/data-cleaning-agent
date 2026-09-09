"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import SplashScreen from "@/components/splash";
import {
  Sparkles,
  Upload,
  BarChart3,
  MessageSquare,
  FileText,
  ArrowRight,
  Wand2,
  CheckCircle2,
  GitMerge,
  RefreshCcw,
  Lightbulb,
  GitCompareArrows,
  Filter,
  Layers,
} from "lucide-react";

const MODES = [
  {
    icon: BarChart3,
    label: "تحليل البيانات",
    desc: "إحصاءات ورسوم وشروحات ذكية",
    href: "/dashboard/analyze",
  },
  {
    icon: Wand2,
    label: "تنظيف البيانات",
    desc: "إزالة التكرارات والقيم المفقودة",
    href: "/dashboard/upload",
  },
  {
    icon: GitMerge,
    label: "الدمج والتحويل",
    desc: "ادمج عدة ملفات وحوّل الصيغ",
    href: "/dashboard/tools",
  },
  {
    icon: FileText,
    label: "التقارير",
    desc: "تقارير شاملة بقوالب PDF احترافية",
    href: "/dashboard/reports",
  },
  {
    icon: MessageSquare,
    label: "المحادثة الذكية",
    desc: "اسأل وكيلك عن نتائج التحليل",
    href: "/dashboard/chat",
  },
];

const FEATURES = [
  {
    icon: Layers,
    title: "التجميع حسب الفئات",
    desc: "قسم بياناتك تلقائياً حسب كل عمود واكتشف الأنماط المخفية بين الفئات.",
  },
  {
    icon: GitCompareArrows,
    title: "مصفوفة الارتباط",
    desc: "افهم العلاقات بين المتغيرات من أعمق إلى أضعف ارتباطاً بأرقام دقيقة.",
  },
  {
    icon: Lightbulb,
    title: "توصيات ذكية",
    desc: "الوكيل يكتشف المشاكل ويقترح خطوات تنظيف قابلة للتنفيذ لبيانات أفضل.",
  },
  {
    icon: Filter,
    title: "الفلترة الدقيقة",
    desc: "فلترة حسب القيم الرقمية والفئوية وإعادة التحليل في ثوانٍ.",
  },
  {
    icon: BarChart3,
    title: "رسوم بيانية حية",
    desc: "توزيعات، علاقات، ودوائر من بياناتك الحقيقية — لا صور مصطنعة.",
  },
  {
    icon: RefreshCcw,
    title: "كل الصيغ والدمج",
    desc: "CSV / Excel / PDF، تحويل فوري بين الصيغ ودمج عدة ملفات في بيانات موحدة.",
  },
];

const STEPS = [
  { n: "1", icon: Upload, t: "ارفع الملف", d: "CSV أو Excel أو حتى PDF" },
  {
    n: "2",
    icon: BarChart3,
    t: "حلّل فوراً",
    d: "إحصائيات ورسوم وتوصيات وفلترة",
  },
  {
    n: "3",
    icon: Wand2,
    t: "نظّف عند الحاجة",
    d: "تُصحَّح الأخطاء والقيم المفقودة",
  },
  { n: "4", icon: FileText, t: "صدّر وادمج", d: "بيانات وتقارير PDF بأي صيغة" },
];

export default function HomePage() {
  const { user } = useAuth();
  const authed = Boolean(user);
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  const handleSplashFinish = () => {
    setSplashDone(true);
    if (user) {
      router.replace("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] overflow-x-hidden">
      {!splashDone && <SplashScreen onFinish={handleSplashFinish} />}
      {/* Navbar */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[var(--bg)]/70 border-b border-white/10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-xl font-extrabold text-white">O</span>
          </div>
          <span className="text-xl font-bold tracking-tight">OQZARO</span>
          <span className="hidden sm:inline text-sm text-white/50 font-medium">
            DataAnalyzer
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!authed && (
            <Link
              href="/login"
              className="text-sm text-white/80 hover:text-white transition px-4 py-2"
            >
              تسجيل الدخول
            </Link>
          )}
          <Link
            href={authed ? "/dashboard" : "/login"}
            className="bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 text-white px-5 py-2 rounded-xl text-sm font-semibold transition shadow-lg shadow-blue-500/25"
          >
            {authed ? "لوحة التحكم" : "ابدأ مجاناً"}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-6 pt-16 pb-10 max-w-4xl mx-auto text-center">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(79,124,255,0.18) 0%, rgba(79,124,255,0.05) 45%, transparent 80%)",
          }}
        />
        <div className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 text-sm text-white/70 mb-6 bg-white/5">
          <Sparkles className="w-4 h-4 text-[#4f7cff]" />
          وكيل تحليل البيانات بالذكاء الاصطناعي
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight">
          حلّل بياناتك بالذكاء الاصطناعي
          <br />
          <span className="bg-gradient-to-r from-[#4f7cff] via-[#8b5cf6] to-[#4f7cff] bg-clip-text text-transparent">
            في ثوانٍ
          </span>
        </h1>
        <p className="text-white/60 text-lg mt-5 max-w-2xl mx-auto">
          ارفع ملف CSV أو Excel أو PDF ودع OQZARO يحلّل بياناتك: تجميع،
          ارتباطات، توصيات، فلترة، ورسوم حية — مع تقارير شاملة بقوالب PDF
          احترافية ودمج متعدد الملفات في مساحة واحدة آمنة ومعزولة.
        </p>

        {/* Command bar */}
        <div className="mt-10 max-w-2xl mx-auto">
          <Link
            href={authed ? "/dashboard/upload" : "/login"}
            className="flex items-center gap-3 bg-white/[0.04] border border-white/15 hover:border-[#4f7cff]/60 rounded-2xl px-5 py-4 text-white/50 text-left transition group"
          >
            <Upload className="w-5 h-5 text-[#4f7cff]" />
            <span className="flex-1">ارفع ملفك لبدء التحليل…</span>
            <span className="opacity-0 group-hover:opacity-100 transition">
              <ArrowRight className="w-5 h-5 text-[#4f7cff]" />
            </span>
          </Link>
        </div>

        {/* Mode cards */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
          {MODES.map(({ icon: Icon, label, desc, href }) => (
            <Link
              key={label}
              href={authed ? href : "/login"}
              className="group bg-white/[0.03] border border-white/10 hover:border-[#4f7cff]/50 rounded-2xl p-5 transition hover:-translate-y-0.5"
            >
              <div className="w-10 h-10 rounded-xl bg-[#4f7cff]/10 border border-[#4f7cff]/30 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-[#4f7cff]" />
              </div>
              <div className="font-semibold">{label}</div>
              <div className="text-sm text-white/50 mt-0.5">{desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-14 max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-10 tracking-tight">
          لماذا OQZARO؟
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/[0.03] border border-white/10 rounded-2xl p-6"
            >
              <Icon className="w-7 h-7 text-[#4f7cff] mb-4" />
              <h3 className="font-bold text-lg">{title}</h3>
              <p className="text-white/55 text-sm mt-2 leading-relaxed">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-14 max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-12 tracking-tight">
          كيف يعمل؟
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {STEPS.map(({ n, icon: Icon, t, d }) => (
            <div key={n} className="text-center">
              <div className="relative w-16 h-16 mx-auto mb-3">
                <div className="absolute inset-0 rounded-2xl bg-[#4f7cff]/10 border border-[#4f7cff]/30" />
                <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] text-white text-xs font-bold flex items-center justify-center">
                  {n}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon className="w-7 h-7 text-[#4f7cff]" />
                </div>
              </div>
              <p className="font-semibold">{t}</p>
              <p className="text-white/50 text-sm mt-1">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-16 max-w-3xl mx-auto text-center">
        <div className="bg-gradient-to-br from-[#4f7cff]/10 to-transparent border border-[#4f7cff]/30 rounded-3xl p-10">
          <h2 className="text-3xl font-bold tracking-tight">
            جاهز لتحليل بياناتك؟
          </h2>
          <p className="text-white/60 mt-3 max-w-xl mx-auto">
            أنشئ حساباً مجانياً وابدأ في دقائق. بياناتك محفوظة وآمنة ومعزولة.
          </p>
          <Link
            href={authed ? "/dashboard" : "/login"}
            className="inline-flex items-center gap-2 mt-6 bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 text-white px-8 py-3 rounded-xl font-semibold transition shadow-lg shadow-blue-500/25"
          >
            <CheckCircle2 className="w-5 h-5" />
            {authed ? "افتح لوحة التحكم" : "أنشئ حسابك الآن"}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center">
              <span className="text-white font-extrabold">O</span>
            </div>
            <span className="font-bold">OQZARO</span>
            <span className="text-white/50 text-sm">DataAnalyzer</span>
          </div>
          <div className="flex gap-6 text-white/60 text-sm">
            <Link href="/dashboard" className="hover:text-white transition">
              الرئيسية
            </Link>
            <a
              href="mailto:support@oqzaro.com"
              className="hover:text-white transition"
            >
              الخصوصية
            </a>
            <a
              href="mailto:support@oqzaro.com"
              className="hover:text-white transition"
            >
              تواصل معنا
            </a>
          </div>
          <div className="text-white/50 text-sm">
            © 2026 OQZARO. جميع الحقوق محفوظة.
          </div>
        </div>
      </footer>
    </div>
  );
}
