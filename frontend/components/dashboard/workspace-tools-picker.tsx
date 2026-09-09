"use client";

import { useState } from "react";
import {
  Brush,
  BarChart3,
  PieChart,
  FileText,
  GitMerge,
  Mail,
  Send,
  Pencil,
  Check,
} from "lucide-react";
import {
  WorkTool,
  ALL_TOOLS,
  DeliverySettings,
  DeliveryMode,
} from "@/lib/workspace";
import { useAppSettings } from "@/components/providers/app-providers";

const TOOL_ICONS: Record<WorkTool, typeof Brush> = {
  clean: Brush,
  analyze: BarChart3,
  charts: PieChart,
  reports: FileText,
  merge: GitMerge,
};

const TOOL_KEYS: Record<WorkTool, string> = {
  clean: "onboard.clean",
  analyze: "onboard.analyze",
  charts: "onboard.charts",
  reports: "onboard.reports",
  merge: "onboard.merge",
};

export function WorkspaceToolsPicker({
  initialTools,
  initialDelivery,
  onSave,
  title,
}: {
  initialTools?: WorkTool[];
  initialDelivery?: DeliverySettings;
  onSave: (tools: WorkTool[], delivery: DeliverySettings) => void;
  title?: string;
}) {
  const { t } = useAppSettings();
  const [tools, setTools] = useState<WorkTool[]>(
    initialTools && initialTools.length ? initialTools : [...ALL_TOOLS],
  );
  const [mode, setMode] = useState<DeliveryMode>(
    initialDelivery?.mode || "manual",
  );
  const [email, setEmail] = useState(initialDelivery?.email || "");
  const [telegram, setTelegram] = useState(initialDelivery?.telegram || "");

  const toggle = (tool: WorkTool) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((x) => x !== tool) : [...prev, tool],
    );
  };

  const save = () => {
    onSave(tools.length ? tools : [...ALL_TOOLS], {
      mode,
      email: mode === "auto" ? email.trim() : undefined,
      telegram: mode === "auto" ? telegram.trim() : undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-base">
          {title || t("onboard.agentsTitle")}
        </h3>
        <p className="text-sm text-white/50">{t("onboard.agentsDesc")}</p>
      </div>

      <div className="space-y-2">
        {ALL_TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool];
          const active = tools.includes(tool);
          return (
            <button
              key={tool}
              type="button"
              onClick={() => toggle(tool)}
              className={`w-full flex items-center gap-3 text-left rounded-2xl border px-4 py-3 transition ${
                active
                  ? "border-[#4f7cff]/50 bg-[#4f7cff]/10"
                  : "border-white/10 bg-white/[0.02] hover:border-white/25"
              }`}
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  active
                    ? "bg-gradient-to-br from-[#4f7cff] to-[#8b5cf6]"
                    : "bg-white/[0.05]"
                }`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t(TOOL_KEYS[tool])}</div>
              </div>
              <span
                className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                  active
                    ? "bg-[#4f7cff] border-[#4f7cff] text-white"
                    : "border-white/25 text-transparent"
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Delivery mode */}
      <div className="border-t border-white/10 pt-4">
        <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Send className="w-4 h-4 text-sky-400" /> {t("onboard.deliveryTitle")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition ${
              mode === "manual"
                ? "border-sky-400/60 bg-sky-400/10 text-sky-200"
                : "border-white/10 bg-white/[0.02] text-white/60"
            }`}
          >
            <Pencil className="w-4 h-4" /> {t("onboard.deliveryManual")}
          </button>
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition ${
              mode === "auto"
                ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/[0.02] text-white/60"
            }`}
          >
            <Mail className="w-4 h-4" /> {t("onboard.deliveryAuto")}
          </button>
        </div>

        {mode === "auto" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("onboard.emailPlaceholder")}
              className="bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60"
            />
            <input
              type="text"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder={t("onboard.telegramPlaceholder")}
              className="bg-white/[0.04] border border-white/15 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-400/60"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        className="w-full bg-gradient-to-r from-[#4f7cff] to-[#8b5cf6] hover:brightness-110 text-white font-medium px-5 py-3 rounded-xl transition shadow-lg shadow-blue-500/20"
      >
        {t("onboard.save")}
      </button>
    </div>
  );
}
