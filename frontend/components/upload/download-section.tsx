"use client";

import { FileDown, FileJson, FileSpreadsheet, FileText } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CleaningReport } from "@/lib/types";
import {
  downloadCleanedCsv,
  downloadCsvReport,
  downloadJsonReport,
  downloadPdfReport,
} from "@/lib/export-utils";

export function DownloadSection({
  report,
  headers,
  rows,
}: {
  report: CleaningReport;
  headers: string[];
  rows: Record<string, unknown>[];
}) {
  // دعم كلا التنسيقين: downloadUrl (قديم) و download_url (جديد)
  const downloadUrl = report.download_url || report.downloadUrl || "";
  const cleanedFileName =
    report.cleaned_file_name || report.cleanedFileName || "cleaned_data.csv";

  const hasDownloadUrl =
    typeof downloadUrl === "string" && downloadUrl.trim() !== "";
  const hasLocalRows = headers.length > 0 && rows.length > 0;
  const canDownloadDataset = hasDownloadUrl || hasLocalRows;

  const handleDownloadDataset = () => {
    if (hasDownloadUrl) {
      // إذا كان الرابط من نوع Base64 (data:)
      if (downloadUrl.startsWith("data:")) {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = cleanedFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
      // إذا كان رابطاً عادياً
      window.open(downloadUrl, "_blank");
      return;
    }

    if (hasLocalRows) {
      downloadCleanedCsv(headers, rows, cleanedFileName);
      return;
    }

    alert("No cleaned dataset is available.");
  };

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Download</CardTitle>
          <CardDescription>
            {canDownloadDataset
              ? "Your cleaned dataset is ready."
              : "No downloadable dataset was returned from the backend."}
          </CardDescription>
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          variant="primary"
          className="justify-start"
          disabled={!canDownloadDataset}
          onClick={handleDownloadDataset}
        >
          <FileDown className="h-4 w-4" />
          Download Clean Dataset
        </Button>

        <Button
          variant="secondary"
          className="justify-start"
          onClick={() => downloadPdfReport(report)}
        >
          <FileText className="h-4 w-4" />
          Download Cleaning Report (PDF)
        </Button>

        <Button
          variant="secondary"
          className="justify-start"
          onClick={() => downloadJsonReport(report)}
        >
          <FileJson className="h-4 w-4" />
          Download JSON Report
        </Button>

        <Button
          variant="secondary"
          className="justify-start"
          onClick={() => downloadCsvReport(report)}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Download CSV Report
        </Button>
      </div>
    </Card>
  );
}
