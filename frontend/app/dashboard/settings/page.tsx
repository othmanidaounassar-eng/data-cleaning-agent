"use client";

import { useState } from "react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select } from "@/components/ui/switch"; // قد يكون الاستيراد خطأً، لكننا نحتفظ به كما هو
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  const [theme, setTheme] = useState("dark");
  const [language, setLanguage] = useState("en");
  const [exportFormat, setExportFormat] = useState("csv");
  const [notifications, setNotifications] = useState(true);
  const [autoSave, setAutoSave] = useState(true);

  return (
    <>
      <Topbar title="Settings" subtitle="Configure how the agent behaves and exports data." />

      <main className="p-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Currently only dark mode is fully supported</CardDescription>
            </div>
          </CardHeader>
          <Row label="Theme">
            <Select
              value={theme}
              onChange={setTheme}
              options={[
                { label: "Dark", value: "dark" },
                { label: "Light (coming soon)", value: "light" },
              ]}
            />
          </Row>
          <Row label="Language">
            <Select
              value={language}
              onChange={setLanguage}
              options={[
                { label: "English", value: "en" },
                { label: "العربية", value: "ar" },
              ]}
            />
          </Row>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cleaning defaults</CardTitle>
              <CardDescription>Applied to every new dataset you upload</CardDescription>
            </div>
          </CardHeader>
          <Row label="Default export format">
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { label: "CSV", value: "csv" },
                { label: "Excel", value: "xlsx" },
              ]}
            />
          </Row>
          <Row label="Auto-save cleaned files to history">
            <Switch checked={autoSave} onChange={setAutoSave} label="Auto save" />
          </Row>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Get notified when a cleaning job finishes</CardDescription>
            </div>
          </CardHeader>
          <Row label="Enable notifications">
            <Switch checked={notifications} onChange={setNotifications} label="Notifications" />
          </Row>
        </Card>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-t border-white/[0.05] first:border-t-0 first:pt-0">
      <span className="text-sm text-ink-100">{label}</span>
      {children}
    </div>
  );
}

// ✅ منع التصيير الثابت (Static Prerendering) لحل مشكلة useAuth
export const dynamic = 'force-dynamic';