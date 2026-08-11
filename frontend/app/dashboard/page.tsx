"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { FileUp, History, Settings } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800">
          مرحباً بعودتك، {user?.full_name || "مستخدم"}! 👋
        </h1>
        <p className="text-gray-600 mt-2">
          يمكنك رفع ملف CSV أو Excel لتنظيفه، أو مراجعة تاريخ عملياتك السابقة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/upload"
          className="bg-blue-50 hover:bg-blue-100 transition p-6 rounded-lg border border-blue-200 flex flex-col items-center justify-center gap-2"
        >
          <FileUp className="w-8 h-8 text-blue-600" />
          <span className="font-medium text-blue-700">رفع ملف جديد</span>
          <span className="text-sm text-gray-500">ابدأ بتنظيف بياناتك</span>
        </Link>

        <Link
          href="/dashboard/history"
          className="bg-green-50 hover:bg-green-100 transition p-6 rounded-lg border border-green-200 flex flex-col items-center justify-center gap-2"
        >
          <History className="w-8 h-8 text-green-600" />
          <span className="font-medium text-green-700">تاريخ العمليات</span>
          <span className="text-sm text-gray-500">عرض الملفات السابقة</span>
        </Link>

        <Link
          href="/dashboard/settings"
          className="bg-gray-50 hover:bg-gray-100 transition p-6 rounded-lg border border-gray-200 flex flex-col items-center justify-center gap-2"
        >
          <Settings className="w-8 h-8 text-gray-600" />
          <span className="font-medium text-gray-700">الإعدادات</span>
          <span className="text-sm text-gray-500">تعديل الملف الشخصي</span>
        </Link>
      </div>
    </div>
  );
}

// ✅ منع التصيير الثابت (Static Prerendering) لحل مشكلة useAuth
export const dynamic = 'force-dynamic';