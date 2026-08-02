"use client";

import { useEffect, useState } from "react";
import { FileJson, FileText, FileSpreadsheet, ClipboardList } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HistoryEntry } from "@/lib/types";
import { getHistory } from "@/lib/history-store";
import { formatDate } from "@/lib/utils";
import { downloadCsvReport, downloadJsonReport, downloadPdfReport } from "@/lib/export-utils";

export default function ReportsPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setEntries(getHistory());
  }, []);

  return (
    <>
      <Topbar title="Reports" subtitle="Every AI cleaning report generated so far." />

      <main className="p-6 space-y-4 max-w-5xl mx-auto">
        {entries.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-8 w-8 text-ink-500 mb-3" />
            <p className="text-sm font-medium text-ink-100">No reports yet</p>
            <p className="text-xs text-ink-500 mt-1">Clean a dataset to generate your first report.</p>
          </Card>
        ) : (
          entries.map((entry) => (
            <Card key={entry.id}>
              <CardHeader>
                <div>
                  <CardTitle>{entry.originalFileName}</CardTitle>
                  <CardDescription>{formatDate(entry.cleaningDate)}</CardDescription>
                </div>
              </CardHeader>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => downloadPdfReport(entry.report)}>
                  <FileText className="h-3.5 w-3.5" />
                  PDF
                </Button>
                <Button variant="secondary" size="sm" onClick={() => downloadJsonReport(entry.report)}>
                  <FileJson className="h-3.5 w-3.5" />
                  JSON
                </Button>
                <Button variant="secondary" size="sm" onClick={() => downloadCsvReport(entry.report)}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>
            </Card>
          ))
        )}
      </main>
    </>
  );
}
