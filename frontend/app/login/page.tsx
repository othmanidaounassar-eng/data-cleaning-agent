"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ التحقق من صحة البريد الإلكتروني قبل الإرسال
  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // ✅ التحقق من صحة المدخلات
    if (!email.trim() || !password.trim()) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    if (!validateEmail(email)) {
      setError("يرجى إدخال بريد إلكتروني صحيح (مثل: user@example.com).");
      return;
    }

    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }

    setLoading(true);

    const url = `${API_BASE}/auth/login`;
    console.log("🔍 Sending login request to:", url);
    console.log("📧 Email:", email);
    console.log("🔑 Password length:", password.length);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ username: email, password }),
        credentials: "include",
      });

      // ✅ قراءة الاستجابة ومعالجتها
      const responseText = await res.text();
      console.log("📦 Response status:", res.status);
      console.log("📄 Response text:", responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`الخادم أعاد استجابة غير متوقعة: ${responseText.substring(0, 100)}`);
      }

      if (!res.ok) {
        // ✅ عرض رسالة الخطأ من الخادم
        const errorMsg = data.detail || data.message || "فشل تسجيل الدخول. تحقق من البريد وكلمة المرور.";
        throw new Error(errorMsg);
      }

      console.log("✅ Login successful, redirecting to dashboard...");
      router.push("/dashboard");
    } catch (err: any) {
      console.error("❌ Login error:", err);
      setError(err.message || "حدث خطأ غير متوقع. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">تسجيل الدخول</h1>
        {error && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm border border-red-300">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="example@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور (8 أحرف على الأقل)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          ليس لديك حساب؟ <Link href="/register" className="text-blue-600 hover:underline">إنشاء حساب جديد</Link>
        </p>
      </div>
    </div>
  );
}