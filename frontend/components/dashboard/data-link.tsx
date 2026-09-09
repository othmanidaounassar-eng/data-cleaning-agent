"use client";

/* ─── Shared dataset store linking Excel, Power BI and SQL viewers ───
   Any viewer that uploads a file publishes its parsed data to this store.
   The other two viewers can pick it up with one click ("use shared dataset").
*/

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  Link2,
  FileSpreadsheet,
  BarChart3,
  Database,
  CheckCircle2,
} from "lucide-react";

export interface LinkedDataset {
  source: "excel" | "powerbi" | "sql";
  headers: string[];
  rows: Record<string, unknown>[];
  fileName: string;
  uploadedAt: number;
}

interface LinkContextValue {
  dataset: LinkedDataset | null;
  publish: (ds: Omit<LinkedDataset, "uploadedAt">) => void;
  clear: () => void;
}

const LinkContext = createContext<LinkContextValue>({
  dataset: null,
  publish: () => {},
  clear: () => {},
});

export function DataLinkProvider({ children }: { children: React.ReactNode }) {
  const [dataset, setDataset] = useState<LinkedDataset | null>(null);

  const publish = useCallback((ds: Omit<LinkedDataset, "uploadedAt">) => {
    setDataset({ ...ds, uploadedAt: Date.now() });
  }, []);

  const clear = useCallback(() => setDataset(null), []);

  const value = useMemo(
    () => ({ dataset, publish, clear }),
    [dataset, publish, clear],
  );
  return <LinkContext.Provider value={value}>{children}</LinkContext.Provider>;
}

export function useDataLink() {
  return useContext(LinkContext);
}

/* ─── badge shown inside each viewer connecting them ─── */
const SOURCE_META: Record<
  LinkedDataset["source"],
  { label: string; icon: typeof FileSpreadsheet; color: string; ring: string }
> = {
  excel: {
    label: "Excel",
    icon: FileSpreadsheet,
    color: "text-[#33a867]",
    ring: "border-[#217346]/30",
  },
  powerbi: {
    label: "Power BI",
    icon: BarChart3,
    color: "text-[#f2c811]",
    ring: "border-[#f2c811]/30",
  },
  sql: {
    label: "SQL",
    icon: Database,
    color: "text-[#e05a60]",
    ring: "border-[#a91d22]/30",
  },
};

export function LinkedDataBadge() {
  const { dataset, clear } = useDataLink();
  if (!dataset) return null;
  const meta = SOURCE_META[dataset.source];
  const Icon = meta.icon;
  return (
    <div
      className={`flex items-center gap-2 bg-white/[0.03] border ${meta.ring} rounded-xl px-3 py-2`}
    >
      <Link2 className={`w-3.5 h-3.5 ${meta.color}`} />
      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
      <span className="text-[10px] text-white/50">
        مرتبط بمجموعة بيانات من{" "}
        <span className={`${meta.color} font-medium`}>{meta.label}</span> —{" "}
        {dataset.fileName}
      </span>
      <span className="text-[9px] text-white/30">
        {dataset.headers.length} عمود · {dataset.rows.length} صف
      </span>
      <button
        onClick={clear}
        className="text-[10px] text-white/40 hover:text-red-400 transition"
      >
        ✕
      </button>
    </div>
  );
}

/* ─── Button to pull the shared dataset into the current viewer ─── */
export function UseLinkedData({
  onApply,
}: {
  onApply: (ds: LinkedDataset) => void;
}) {
  const { dataset } = useDataLink();
  if (!dataset) return null;
  const meta = SOURCE_META[dataset.source];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onApply(dataset)}
      className={`flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border ${meta.ring} ${meta.color} bg-white/[0.03] hover:bg-white/[0.06] transition`}
    >
      <Link2 className="w-3 h-3" />
      <Icon className="w-3 h-3" />
      استخدم بيانات {meta.label} ({dataset.fileName})
      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
    </button>
  );
}
