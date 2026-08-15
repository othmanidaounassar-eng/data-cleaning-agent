"use client";

import Link from "next/link";
import { FileUp, History, Settings } from "lucide-react";

export default function DashboardPage() {
  // 🔹 مستخدم وهمي (بدون مصادقة)
  const user = { full_name: "Guest" };

  return (
    <div className="space-y-6">
      <div className="bg-dark-blue-800 p-6 rounded-lg border border-orange-500/20">
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.full_name || "Guest"}! 👋
        </h1>
        <p className="text-white/70 mt-2">
          Upload a CSV or Excel file to clean, or review your previous cleaning
          history.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/dashboard/upload"
          className="bg-dark-blue-800 hover:bg-dark-blue-700 transition p-6 rounded-lg border border-orange-500/20 flex flex-col items-center justify-center gap-2"
        >
          <FileUp className="w-8 h-8 text-orange-500" />
          <span className="font-medium text-white">Upload New File</span>
          <span className="text-sm text-white/60">
            Start cleaning your data
          </span>
        </Link>

        <Link
          href="/dashboard/history"
          className="bg-dark-blue-800 hover:bg-dark-blue-700 transition p-6 rounded-lg border border-orange-500/20 flex flex-col items-center justify-center gap-2"
        >
          <History className="w-8 h-8 text-orange-500" />
          <span className="font-medium text-white">Cleaning History</span>
          <span className="text-sm text-white/60">View previous files</span>
        </Link>

        <Link
          href="/dashboard/settings"
          className="bg-dark-blue-800 hover:bg-dark-blue-700 transition p-6 rounded-lg border border-orange-500/20 flex flex-col items-center justify-center gap-2"
        >
          <Settings className="w-8 h-8 text-orange-500" />
          <span className="font-medium text-white">Settings</span>
          <span className="text-sm text-white/60">Manage your profile</span>
        </Link>
      </div>
    </div>
  );
}
