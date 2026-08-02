import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DatasetInfo, ValidationResult } from "@/lib/types";
import { formatBytes } from "@/lib/utils";

export function ValidationDashboard({ result }: { result: ValidationResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Validation checks</CardTitle>
        <Badge tone={result.valid ? "good" : "bad"}>{result.valid ? "Valid" : "Invalid"}</Badge>
      </CardHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {result.checks.map((check) => (
          <div
            key={check.id}
            className="flex items-start gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"
          >
            {check.passed ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-signal-good mt-0.5" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-signal-bad mt-0.5" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium text-ink-100">{check.label}</p>
              <p className="text-[11px] text-ink-500 truncate">{check.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DatasetInfoCard({ info }: { info: DatasetInfo }) {
  const rows: [string, string][] = [
    ["File Name", info.fileName],
    ["File Type", info.fileKind.toUpperCase()],
    ["Rows", info.rows.toLocaleString()],
    ["Columns", String(info.columns)],
    ["Size", formatBytes(info.sizeBytes)],
    ["Encoding", info.encoding],
    ["Upload Time", new Date(info.uploadedAt).toLocaleTimeString()],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataset information</CardTitle>
      </CardHeader>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] text-ink-500">{label}</dt>
            <dd className="text-sm font-mono text-ink-100 mt-0.5 truncate">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
