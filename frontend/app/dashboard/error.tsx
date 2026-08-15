"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/dashboard/topbar";

export default function DashboardError({
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
    <>
      <Topbar
        title="Something went wrong"
        subtitle="This part of the dashboard hit an error."
      />
      <main className="p-6 max-w-lg mx-auto">
        <Card className="text-center py-10">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-bad/10 mb-4">
            <AlertTriangle className="h-5 w-5 text-signal-bad" />
          </div>
          <CardTitle className="text-lg">
            This page couldn&apos;t load
          </CardTitle>
          <CardDescription className="mt-1.5">
            {error.message ||
              "An unexpected error occurred while rendering this page."}
          </CardDescription>
          <Button className="mt-6" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </Card>
      </main>
    </>
  );
}
