"use client";

import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ إزالة useAuth بالكامل
  // ✅ لا نحتاج إلى Router أو Logout

  return (
    <div className="min-h-screen bg-dark-blue-900">
      {/* شريط تنقل مبسط (بدون مصادقة) */}
      <nav className="bg-dark-blue-800 border-b border-orange-500/30 px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-2xl font-bold text-orange-500 hover:text-orange-400 transition"
          >
            OQZARO
          </Link>
          <span className="text-sm text-gray-400 hidden sm:inline">
            وكيل تحليل البيانات
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* يمكن إضافة زر للرجوع للصفحة الرئيسية أو أيقونة مساعدة */}
          <Link
            href="/"
            className="text-sm text-gray-300 hover:text-orange-500 transition"
          >
            الرئيسية
          </Link>
        </div>
      </nav>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}

// ✅ منع التصيير الثابت (اختياري، يمكن حذفه)
export const dynamic = "force-dynamic";
