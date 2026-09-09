"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username, password);
      } else {
        await register(username, password);
      }
      router.push(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full bg-white/[0.04] border border-white/15 rounded-xl px-4 py-3 placeholder:text-white/40 outline-none focus:border-[#4f7cff]/60 transition";

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center px-4 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(55% 50% at 50% 0%, rgba(79,124,255,0.16) 0%, rgba(79,124,255,0.04) 45%, transparent 80%)",
        }}
      />
      <div className="w-full max-w-md relative">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-blue-500/30">
            <span className="text-2xl font-extrabold text-white">O</span>
          </div>
          <span className="text-2xl font-bold tracking-tight">
            OQZARO{" "}
            <span className="text-white/50 text-lg font-medium">
              DataAnalyzer
            </span>
          </span>
        </div>

        <div className="bg-white/[0.03] p-8 rounded-3xl border border-white/10 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-4 h-4 text-[#4f7cff]" />
            <span className="text-white/60 text-sm">
              {mode === "login" ? "مرحباً بعودتك" : "أنشئ حسابك المجاني"}
            </span>
          </div>

          <div className="flex mb-6 rounded-xl bg-white/[0.04] p-1 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] text-white shadow-lg shadow-blue-500/20"
                  : "text-white/60 hover:text-white"
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] text-white shadow-lg shadow-blue-500/20"
                  : "text-white/60 hover:text-white"
              }`}
            >
              حساب جديد
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                اسم المستخدم
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className={inputCls}
                placeholder="username"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                className={inputCls}
                placeholder="••••••••"
              />
              {password && (
                <p className="text-xs text-white/40 mt-1">
                  {mode === "register"
                    ? "10 أحرف على الأقل"
                    : "لا تظهر كلمة المرور للعلن"}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password}
              className="w-full bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-500/25"
            >
              {loading ? "جاري…" : mode === "login" ? "دخول" : "إنشاء الحساب"}
            </button>
          </form>
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-[#4f7cff] hover:underline text-sm">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
