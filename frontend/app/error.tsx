"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-950 p-6">
      <Card className="w-full max-w-sm glass-strong text-center py-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-bad/10 mb-4">
          <AlertTriangle className="h-5 w-5 text-signal-bad" />
        </div>
        <CardTitle className="text-lg">Something went wrong</CardTitle>
        <CardDescription className="mt-1.5">
          An unexpected error occurred. You can try again, or reload the page.
        </CardDescription>
        <Button className="mt-6 w-full" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Try again
        </Button>
      </Card>
    </div>
  );
}
