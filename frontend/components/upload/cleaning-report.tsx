import { CheckCircle2, Circle } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CleaningReport } from "@/lib/types";
import { cn } from "@/lib/utils"; // ✅ تم إزالة formatDuration غير المستخدم

export function CleaningResultStats({ report }: { report: CleaningReport }) {
  const s = report.stats;
  const items: { label: string; value: string }[] = [
    { label: "Rows Before", value: s.rowsBefore.toLocaleString() },
    { label: "Rows After", value: s.rowsAfter.toLocaleString() },
    {
      label: "Duplicates Removed",
      value: s.duplicatesRemoved.toLocaleString(),
    },
    {
      label: "Missing Values Fixed",
      value: s.missingValuesFixed.toLocaleString(),
    },
    { label: "Outliers Detected", value: s.outliersDetected.toLocaleString() },
    { label: "Columns Converted", value: s.columnsConverted.toLocaleString() },
    // ✅ عرض الوقت بالثواني
    {
      label: "Cleaning Time",
      value:
        report.processing_time_s !== undefined
          ? `${report.processing_time_s} s`
          : "—",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <div key={item.label} className="glass rounded-xl2 p-4">
          <p className="text-[11px] text-ink-500">{item.label}</p>
          <p className="mt-1 font-mono text-lg font-semibold text-ink-100 tabular-nums">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function qualityTone(score: number): "good" | "warn" | "bad" {
  if (score >= 85) return "good";
  if (score >= 60) return "warn";
  return "bad";
}

export function AiReportCard({ report }: { report: CleaningReport }) {
  const tone = qualityTone(report.stats.qualityScore);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>AI cleaning report</CardTitle>
          <CardDescription>
            Generated automatically after the pipeline finished
          </CardDescription>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink-500">Quality Score</p>
          <p
            className={cn(
              "font-mono text-xl font-semibold",
              tone === "good" && "text-signal-good",
              tone === "warn" && "text-signal-warn",
              tone === "bad" && "text-signal-bad",
            )}
          >
            {report.stats.qualityScore}/100
          </p>
        </div>
      </CardHeader>

      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium text-ink-300 mb-2">Actions taken</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {report.operations.map((op) => (
              <div key={op.label} className="flex items-center gap-2 text-sm">
                {op.done ? (
                  <CheckCircle2 className="h-4 w-4 text-signal-good shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-ink-500 shrink-0" />
                )}
                <span className={op.done ? "text-ink-100" : "text-ink-500"}>
                  {op.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {report.columnConversions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-ink-300 mb-2">
              Column type conversions
            </p>
            <div className="flex flex-wrap gap-2">
              {report.columnConversions.map((c) => (
                <Badge key={c.column} tone="accent">
                  {c.column}: {c.from} → {c.to}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-medium text-ink-300 mb-2">
            Recommendations
          </p>
          <ul className="space-y-1.5">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-ink-100 flex gap-2">
                <span className="text-accent-blue">→</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-signal-good/25 bg-signal-good/[0.06] px-4 py-3 flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-signal-good shrink-0" />
          <p className="text-sm text-signal-good font-medium">
            Data ready for analysis
          </p>
        </div>
      </div>
    </Card>
  );
}
