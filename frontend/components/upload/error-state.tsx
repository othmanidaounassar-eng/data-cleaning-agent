import {
  AlertTriangle,
  RotateCcw,
  WifiOff,
  Clock,
  ServerCrash,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ApiErrorKind } from "@/lib/api-client";

const ICONS: Record<ApiErrorKind, typeof AlertTriangle> = {
  network: WifiOff,
  timeout: Clock,
  server: ServerCrash,
  parse: AlertTriangle,
  aborted: AlertTriangle,
};

export function UploadErrorState({
  title,
  message,
  kind = "server",
  onRetry,
}: {
  title: string;
  message: string;
  kind?: ApiErrorKind;
  onRetry: () => void;
}) {
  const Icon = ICONS[kind] ?? AlertTriangle;

  return (
    <Card className="flex flex-col items-center text-center py-12 border-signal-bad/25">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-bad/10 mb-4">
        <Icon className="h-5 w-5 text-signal-bad" />
      </div>
      <p className="text-sm font-medium text-ink-100">{title}</p>
      <p className="text-sm text-ink-500 mt-1.5 max-w-sm">{message}</p>
      <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
        <RotateCcw className="h-3.5 w-3.5" />
        Try again
      </Button>
    </Card>
  );
}
