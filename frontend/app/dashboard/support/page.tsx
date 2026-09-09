"use client";

import { useState } from "react";
import { LifeBuoy, Mail, MessageSquare, CheckCircle2 } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppSettings } from "@/components/providers/app-providers";

export default function SupportPage() {
  const [sent, setSent] = useState(false);
  const { t } = useAppSettings();

  return (
    <>
      <Topbar title={t("support.title")} subtitle={t("support.subtitle")} />

      <main className="p-6 max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("support.contact")}</CardTitle>
              <CardDescription>{t("support.contactDesc")}</CardDescription>
            </div>
            <LifeBuoy className="h-5 w-5 text-accent-blue" />
          </CardHeader>

          {sent ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-signal-good/25 bg-signal-good/[0.06] px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-signal-good" />
              <p className="text-sm text-signal-good">
                {t("support.sent")} — {t("support.sentDesc")}
              </p>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
            >
              <div>
                <Label htmlFor="email">{t("support.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder={t("support.emailPh")}
                />
              </div>
              <div>
                <Label htmlFor="message">{t("support.message")}</Label>
                <textarea
                  id="message"
                  required
                  rows={5}
                  placeholder={t("support.messagePh")}
                  className="w-full rounded-xl border border-white/10 bg-base-900/60 px-3.5 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 outline-none focus:border-accent-blue/60"
                />
              </div>
              <Button type="submit">
                <Mail className="h-4 w-4" />
                {t("support.send")}
              </Button>
            </form>
          )}
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>{t("support.resources")}</CardTitle>
              <CardDescription>{t("support.resourcesDesc")}</CardDescription>
            </div>
            <MessageSquare className="h-5 w-5 text-accent-violet" />
          </CardHeader>
          <ul className="space-y-2 text-sm text-ink-300">
            <li>· {t("support.r1")}</li>
            <li>· {t("support.r2")}</li>
            <li>· {t("support.r3")}</li>
          </ul>
        </Card>
      </main>
    </>
  );
}
