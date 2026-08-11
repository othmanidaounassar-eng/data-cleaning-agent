"use client";

import { useEffect, useState } from "react";
import { Download, Trash2, FileSpreadsheet } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HistoryEntry } from "@/lib/types";
import { getHistory, deleteHistoryEntry } from "@/lib/history-store";
import { formatDate, formatDuration } from "@/lib/utils";
import { downloadCleanedCsv } from "@/lib/export-utils";

function qualityTone(score: number): "good" | "warn" | "bad" {
  if (score >= 85) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(getHistory());
  }, []);

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <>
      <Topbar title="Cleaning History" subtitle="Every dataset you've cleaned in this browser." />

      <main className="p-6 space-y-4 max-w-5xl mx-auto">
        {entries.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="h-8 w-8 text-ink-500 mb-3" />
            <p className="text-sm font-medium text-ink-100">No cleaning history yet</p>
            <p className="text-xs text-ink-500 mt-1">
              Files you clean will show up here, ready to download again.
            </p>
          </Card>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink-100 truncate">
                    {entry.originalFileName}
                  </p>
                  <Badge tone={qualityTone(entry.qualityScore)}>{entry.qualityScore}/100</Badge>
                </div>
                <p className="text-xs text-ink-500 mt-1">
                  Cleaned {formatDate(entry.cleaningDate)} · {formatDuration(entry.processingTimeMs)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={entry.cleanedRows.length === 0 && !entry.report.downloadUrl}
                  onClick={() => {
                    if (entry.report.downloadUrl) {
                      const a = document.createElement("a");
                      a.href = entry.report.downloadUrl;
                      a.download = entry.cleanedFileName;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      return;
                    }
                    downloadCleanedCsv(entry.columns, entry.cleanedRows, entry.cleanedFileName);
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)}>
                  <Trash2 className="h-4 w-4 text-signal-bad" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </main>
    </>
  );
}

// ✅ منع التصيير الثابت (Static Prerendering) لحل مشكلة useAuth
export const dynamic = 'force-dynamic';