"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileWarning, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ValidationResult } from "@/lib/types";

export function Dropzone({
  onFile,
  validationError,
}: {
  onFile: (file: File) => void;
  validationError: ValidationResult | null;
}) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent, active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(active);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  return (
    <div>
      <div
        onDragEnter={(e) => handleDrag(e, true)}
        onDragOver={(e) => handleDrag(e, true)}
        onDragLeave={(e) => handleDrag(e, false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-3 rounded-xl2 border-2 border-dashed px-6 py-16 text-center cursor-pointer transition-colors duration-200",
          dragActive
            ? "border-accent-blue bg-accent-blue/[0.06]"
            : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.03]"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />

        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl bg-grad-primary transition-transform duration-200",
            dragActive ? "scale-110" : "group-hover:scale-105"
          )}
        >
          <UploadCloud className="h-6 w-6 text-white" />
        </div>

        <div>
          <p className="font-display text-base font-medium text-ink-100">
            Drag &amp; drop your dataset
          </p>
          <p className="text-sm text-ink-500 mt-1">
            or <span className="text-accent-blue">browse files</span> from your computer
          </p>
        </div>

        <div className="flex items-center gap-2 mt-2 text-[11px] text-ink-500">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Supports CSV, XLSX, XLS · up to 50 MB
        </div>
      </div>

      {validationError && !validationError.valid && (
        <div className="mt-4 flex gap-3 rounded-xl2 border border-signal-bad/25 bg-signal-bad/[0.06] p-4">
          <FileWarning className="h-5 w-5 shrink-0 text-signal-bad" />
          <div>
            <p className="text-sm font-medium text-signal-bad">{validationError.errorTitle}</p>
            <p className="text-sm text-ink-300 mt-0.5">{validationError.errorMessage}</p>
            {validationError.suggestion && (
              <p className="text-xs text-ink-500 mt-1.5">{validationError.suggestion}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
