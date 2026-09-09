"use client";

import Link from "next/link";
import { CheckCircle2, XCircle, FileText, Loader2, X } from "lucide-react";
import { useUploadSession } from "@/components/providers/upload-session-provider";
import { useAppSettings } from "@/components/providers/app-providers";

export function UploadStatusBanner() {
  const { status, meta, clear } = useUploadSession();
  const { t } = useAppSettings();

  if (!meta || status === "idle") return null;

  const sizeKb = (meta.size / 1024).toFixed(1);
  const processing = status === "analyzing" || status === "cleaning";

  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-[var(--bg)]/90 backdrop-blur-xl px-4 lg:px-6 py-2.5">
      <div className="flex items-center gap-3">
        {status === "accepted" && (
          <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
        )}
        {status === "rejected" && (
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
        )}
        {processing && (
          <Loader2 className="w-5 h-5 text-blue-300 animate-spin shrink-0" />
        )}
        {(status === "selected" ||
          status === "analyzing" ||
          status === "cleaning") && (
          <FileText className="w-5 h-5 text-blue-300 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            {meta.name}
            <span className="text-white/40 font-normal"> · {sizeKb} KB</span>
          </p>
          <p className="text-xs">
            {status === "accepted" && (
              <span className="text-green-400">✓ {t("banner.accepted")}</span>
            )}
            {status === "rejected" && (
              <span className="text-red-400">✕ {t("banner.rejected")}</span>
            )}
            {status === "analyzing" && (
              <span className="text-blue-300">{t("banner.analyzing")}</span>
            )}
            {status === "cleaning" && (
              <span className="text-blue-300">{t("banner.cleaning")}</span>
            )}
            {status === "selected" && (
              <span className="text-blue-300">{t("banner.selected")}</span>
            )}
          </p>
        </div>

        <Link
          href="/dashboard/upload"
          className="text-xs font-medium text-[#4f7cff] hover:underline shrink-0"
        >
          {status === "accepted" || status === "rejected"
            ? t("banner.view")
            : t("banner.continue")}
        </Link>

        <button
          type="button"
          onClick={clear}
          aria-label={t("banner.clear")}
          title={t("banner.clear")}
          className="text-white/40 hover:text-white transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
