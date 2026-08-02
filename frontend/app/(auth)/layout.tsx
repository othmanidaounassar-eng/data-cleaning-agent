import Link from "next/link";
import { Sparkles, ShieldCheck, Zap, Database } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-base-950">
      <div className="relative hidden lg:flex flex-col justify-between p-10 border-r border-white/[0.06] bg-grad-radial-glow overflow-hidden">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-grad-primary shadow-glow-blue">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display text-sm font-semibold text-ink-100">Cleaning Agent</span>
        </Link>

        <div className="max-w-sm">
          <h2 className="font-display text-3xl font-semibold text-ink-100 leading-tight">
            Clean, validate, and ship datasets your team can trust.
          </h2>
          <p className="text-sm text-ink-500 mt-3">
            Every upload runs through the same production-grade pipeline: no crashes, no silent
            data loss, just a clear report of what changed.
          </p>

          <div className="mt-8 space-y-3">
            <Feature icon={ShieldCheck} text="Validation that never crashes on bad input" />
            <Feature icon={Zap} text="Cleaning finishes in seconds, not minutes" />
            <Feature icon={Database} text="CSV and Excel, ready for enterprise data" />
          </div>
        </div>

        <p className="text-[11px] text-ink-500">© {new Date().getFullYear()} AI Data Cleaning Agent</p>
      </div>

      <div className="flex items-center justify-center p-6">{children}</div>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] shrink-0">
        <Icon className="h-4 w-4 text-accent-blue" />
      </div>
      <span className="text-sm text-ink-300">{text}</span>
    </div>
  );
}
