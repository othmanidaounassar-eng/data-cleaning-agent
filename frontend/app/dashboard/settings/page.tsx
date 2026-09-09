"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/dashboard/topbar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Select } from "@/components/ui/switch"; // Ù‚Ø¯ ÙŠÙƒÙˆÙ† Ø§Ù„Ø§Ø³ØªÙŠØ±Ø§Ø¯ Ø®Ø·Ø£Ù‹ØŒ Ù„ÙƒÙ†Ù†Ø§ Ù†Ø­ØªÙØ¸ Ø¨Ù‡ ÙƒÙ…Ø§ Ù‡Ùˆ
import { Switch } from "@/components/ui/switch";
import { useAppSettings } from "@/components/providers/app-providers";
import { Lang, LANGUAGE_OPTIONS, Theme } from "@/lib/i18n";
import {
  EMPTY_MICROSOFT_CONFIG,
  fetchMicrosoftStatus,
  isMicrosoftConfigured,
  type MicrosoftConfig,
  type MicrosoftStatus,
  readMicrosoftConfig,
  writeMicrosoftConfig,
} from "@/lib/microsoft";

export default function SettingsPage() {
  const { theme, setTheme, lang, setLang, t } = useAppSettings();
  const [exportFormat, setExportFormat] = useState("csv");
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  const [msConfig, setMsConfig] = useState<MicrosoftConfig>(() =>
    readMicrosoftConfig(),
  );
  const [msStatus, setMsStatus] = useState<
    "loading" | "error" | MicrosoftStatus
  >("loading");
  const [msFeedback, setMsFeedback] = useState("");

  useEffect(() => {
    setMsStatus("loading");
    fetchMicrosoftStatus()
      .then((s) => setMsStatus(s))
      .catch(() => setMsStatus("error"));
  }, []);

  const themeOptions = [
    { label: t("settings.theme.dark"), value: "dark" },
    { label: t("settings.theme.light"), value: "light" },
  ];

  return (
    <>
      <Topbar title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <main className="p-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("settings.appearance")}</CardTitle>
              <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
            </div>
          </CardHeader>
          <Row label={t("settings.theme")}>
            <Select
              value={theme}
              onChange={(v) => setTheme(v as Theme)}
              options={themeOptions}
            />
          </Row>
          <Row label={t("settings.language")}>
            <Select
              value={lang}
              onChange={(v) => setLang(v as Lang)}
              options={LANGUAGE_OPTIONS}
            />
          </Row>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("settings.defaults")}</CardTitle>
              <CardDescription>{t("settings.defaultsDesc")}</CardDescription>
            </div>
          </CardHeader>
          <Row label={t("settings.export")}>
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { label: t("settings.csv"), value: "csv" },
                { label: t("settings.xlsx"), value: "xlsx" },
              ]}
            />
          </Row>
          <Row label={t("settings.autosave")}>
            <Switch
              checked={autoSave}
              onChange={setAutoSave}
              label="Auto save"
            />
          </Row>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("settings.notifications")}</CardTitle>
              <CardDescription>
                {t("settings.notificationsDesc")}
              </CardDescription>
            </div>
          </CardHeader>
          <Row label={t("settings.notif.enable")}>
            <Switch
              checked={notifications}
              onChange={setNotifications}
              label="Notifications"
            />
          </Row>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>{t("ms.title")}</CardTitle>
                <CardDescription>{t("ms.desc")}</CardDescription>
              </div>
              <StatusChip value={msStatus} t={t} />
            </div>
          </CardHeader>
          <Row label={t("ms.clientId")}>
            <input
              type="text"
              value={msConfig.clientId}
              onChange={(e) =>
                setMsConfig({ ...msConfig, clientId: e.target.value })
              }
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-56 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-ink-100 placeholder-white/25 outline-none focus:border-[#f2c811]/50 text-left"
              dir="ltr"
            />
          </Row>
          <Row label={t("ms.tenantId")}>
            <input
              type="text"
              value={msConfig.tenantId}
              onChange={(e) =>
                setMsConfig({ ...msConfig, tenantId: e.target.value })
              }
              placeholder="your-org.onmicrosoft.com"
              className="w-56 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-ink-100 placeholder-white/25 outline-none focus:border-[#f2c811]/50"
              dir="ltr"
            />
          </Row>
          <Row label={t("ms.clientCredential")}>
            <input
              type="password"
              value={msConfig.clientSecret}
              onChange={(e) =>
                setMsConfig({ ...msConfig, clientSecret: e.target.value })
              }
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              className="w-56 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-ink-100 placeholder-white/25 outline-none focus:border-[#f2c811]/50"
              dir="ltr"
            />
          </Row>
          <Row label={t("ms.powerBiGroupId")}>
            <input
              type="text"
              value={msConfig.powerBiGroupId}
              onChange={(e) =>
                setMsConfig({ ...msConfig, powerBiGroupId: e.target.value })
              }
              placeholder="(optional)"
              className="w-56 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-ink-100 placeholder-white/25 outline-none focus:border-[#f2c811]/50"
              dir="ltr"
            />
          </Row>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.05]">
            {msFeedback && (
              <span className="text-[11px] text-ink-500 mr-auto">
                {msFeedback}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                writeMicrosoftConfig({ ...EMPTY_MICROSOFT_CONFIG });
                setMsConfig({ ...EMPTY_MICROSOFT_CONFIG });
                setMsFeedback(t("ms.cleared"));
              }}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-white/60 hover:text-red-400 hover:border-red-400/40 transition"
            >
              {t("ms.clear")}
            </button>
            <button
              type="button"
              onClick={() => {
                writeMicrosoftConfig(msConfig);
                setMsFeedback(
                  isMicrosoftConfigured(msConfig)
                    ? t("ms.staged")
                    : t("ms.saved"),
                );
              }}
              className="px-4 py-1.5 rounded-lg bg-[#f2c811] text-black text-xs font-semibold hover:bg-[#ffd839] transition"
            >
              {t("ms.save")}
            </button>
          </div>
        </Card>

        <p className="text-xs text-ink-500 px-1">{t("settings.saved")}</p>
      </main>
    </>
  );
}

function StatusChip({
  value,
  t,
}: {
  value: "loading" | "error" | MicrosoftStatus;
  t: (k: string) => string;
}) {
  let label = t("ms.status.unknown");
  let cls = "text-amber-300 border-amber-300/30 bg-amber-300/5";
  if (value === "loading") {
    label = t("ms.status.unknown");
    cls = "text-amber-300 border-amber-300/30 bg-amber-300/5";
  } else if (value === "error") {
    label = t("ms.status.unknown");
    cls = "text-red-300 border-red-400/30 bg-red-400/5";
  } else if (value.configured) {
    label = t("ms.status.configured");
    cls = "text-emerald-400 border-emerald-400/30 bg-emerald-400/5";
  } else if (
    value.clientIdReady ||
    value.tenantReady ||
    value.clientSecretReady
  ) {
    label = t("ms.status.partial");
    cls = "text-amber-300 border-amber-300/30 bg-amber-300/5";
  } else {
    label = t("ms.status.notConfigured");
    cls = "text-white/40 border-white/10 bg-white/[0.03]";
  }
  return (
    <span
      className={`flex items-center gap-1.5 shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      <span>{label}</span>
    </span>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-t border-white/[0.05] first:border-t-0 first:pt-0">
      <span className="text-sm text-ink-100">{label}</span>
      {children}
    </div>
  );
}

// âœ… Ù…Ù†Ø¹ Ø§Ù„ØªØµÙŠÙŠØ± Ø§Ù„Ø«Ø§Ø¨Øª (Static Prerendering) Ù„Ø­Ù„ Ù…Ø´ÙƒÙ„Ø© useAuth
export const dynamic = "force-dynamic";
