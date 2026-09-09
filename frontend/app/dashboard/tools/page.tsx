"use client";

import { useState } from "react";
import { FileSpreadsheet, Database, Wrench, Link2 } from "lucide-react";
import { ExcelViewer } from "@/components/dashboard/excel-viewer";
import { PowerBIViewer } from "@/components/dashboard/powerbi-viewer";
import { SqlViewer } from "@/components/dashboard/sql-viewer";
import {
  DataLinkProvider,
  LinkedDataBadge,
} from "@/components/dashboard/data-link";
import {
  MergeTool,
  ConvertTool,
  PowerPivotTool,
} from "@/components/dashboard/file-tools";
import {
  SpreadsheetTool,
  SqlEditorTool,
  JsonFormatterTool,
  RegexTesterTool,
  DictionaryTool,
} from "@/components/dashboard/data-tools";
import { useAppSettings } from "@/components/providers/app-providers";

type ToolsTab = "viewers" | "sql" | "tools";

const TABS: {
  id: ToolsTab;
  label: string;
  icon: typeof FileSpreadsheet;
  desc: string;
  tint: string;
  active: string;
}[] = [
  {
    id: "viewers",
    label: "عارض البيانات",
    icon: FileSpreadsheet,
    desc: "Excel + Power BI",
    tint: "text-[#33a867]",
    active: "bg-[#217346]/15 border-[#217346]/40 text-[#33a867]",
  },
  {
    id: "sql",
    label: "SQL",
    icon: Database,
    desc: "محرر استعلامات",
    tint: "text-[#e05a60]",
    active: "bg-[#a91d22]/15 border-[#a91d22]/40 text-[#e05a60]",
  },
  {
    id: "tools",
    label: "المساعد",
    icon: Wrench,
    desc: "أدوات البيانات",
    tint: "text-sky-300",
    active: "bg-sky-500/15 border-sky-500/40 text-sky-300",
  },
];

export default function ToolsPage() {
  const { t } = useAppSettings();
  const [tab, setTab] = useState<ToolsTab>("viewers");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">{t("tools.title")}</h1>
        <p className="text-sm text-white/60">
          {t("tools.subtitle")} — ارفع ملفاً في أي عارض وستقترح باقي العارضات
          استكمال تحليله تلقائياً
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-sm font-medium transition ${
              tab === tb.id
                ? tb.active
                : "border-white/10 text-white/50 hover:bg-white/5 hover:text-white/75"
            }`}
          >
            <tb.icon className="w-4 h-4" />
            <span>{tb.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 ${tab === tb.id ? tb.tint : "text-white/30"}`}
            >
              {tb.desc}
            </span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Link2 className="w-3.5 h-3.5 text-[#4f7cff]" />
          <span>الربط التلقائي بين العارضات مفعّل</span>
        </div>
      </div>

      <DataLinkProvider>
        <LinkedDataBadge />
        {tab === "viewers" && (
          <div className="space-y-6">
            <ExcelViewer />
            <PowerBIViewer />
          </div>
        )}
        {tab === "sql" && (
          <div className="space-y-6">
            <SqlViewer />
          </div>
        )}
        {tab === "tools" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MergeTool />
            <ConvertTool />
            <SpreadsheetTool />
            <SqlEditorTool />
            <JsonFormatterTool />
            <RegexTesterTool />
            <div className="lg:col-span-2">
              <PowerPivotTool />
              <div className="mt-6">
                <DictionaryTool />
              </div>
            </div>
          </div>
        )}
      </DataLinkProvider>
    </div>
  );
}
