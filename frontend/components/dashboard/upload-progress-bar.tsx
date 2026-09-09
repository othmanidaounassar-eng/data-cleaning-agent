"use client";

import {
  useUploadSession,
  readProgress,
} from "@/components/providers/upload-session-provider";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

// Global top progress bar shown on EVERY dashboard page while an upload /
// cleaning job is running in the background. Because the job state lives in a
// module-scope provider, navigating between pages does not cancel the upload
// and the progress bar keeps updating and stays visible.
export function UploadProgressBar() {
  const { jobs, status } = useUploadSession();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const apply = () => {
      const running = jobs.find((j) => j.running);
      if (running) {
        setProgress(running.progress);
      } else {
        setProgress(readProgress());
      }
    };
    apply();
    const id = window.setInterval(apply, 400);
    return () => window.clearInterval(id);
  }, [jobs]);

  const running = jobs.some((j) => j.running);
  const processing = status === "analyzing" || status === "cleaning";

  if (!running && !processing) return null;

  const activeJob = jobs.find((j) => j.running);
  const total = activeJob?.total ?? 1;
  const current = activeJob?.currentIndex ?? 0;
  const pct = activeJob?.progress ?? progress;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100]">
      <div className="h-1 w-full bg-white/10">
        <div
          className="h-1 bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="bg-[var(--bg)]/95 backdrop-blur-xl border-b border-white/10 px-4 py-2 flex items-center gap-3 text-sm">
        {status === "accepted" ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        ) : status === "rejected" ? (
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        ) : (
          <Loader2 className="w-4 h-4 text-[#4f7cff] animate-spin shrink-0" />
        )}
        <span className="text-white/80 truncate">
          {total > 1 && `${current + 1}/${total} · `}
          {status === "cleaning"
            ? "جارٍ المعالجة…"
            : status === "rejected"
              ? "فشلت المعالجة"
              : status === "accepted"
                ? "اكتملت المعالجة"
                : "جارٍ المعالجة…"}
        </span>
        <span className="text-[#4f7cff] font-semibold ml-auto shrink-0">
          {pct}%
        </span>
      </div>
    </div>
  );
}
