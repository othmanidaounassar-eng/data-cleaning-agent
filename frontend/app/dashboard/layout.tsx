"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">جاري التحقق من الجلسة...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-md px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600">
            AI Data Cleaning
          </Link>
          <span className="text-sm text-gray-500 hidden sm:inline">
            لوحة التحكم
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-700">
            👋 مرحباً، <strong>{user?.full_name || "مستخدم"}</strong>
          </span>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-md transition"
          >
            تسجيل الخروج
          </button>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}