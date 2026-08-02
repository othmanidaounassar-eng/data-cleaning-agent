import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VerifyEmailSuccessPage() {
  return (
    <Card className="w-full max-w-sm glass-strong text-center py-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-good/10 mb-4">
        <CheckCircle2 className="h-5 w-5 text-signal-good" />
      </div>

      <CardTitle className="text-lg">Email verified</CardTitle>
      <CardDescription className="mt-1.5">
        Your account is now active. You&apos;re ready to start cleaning datasets.
      </CardDescription>

      <Link href="/dashboard">
        <Button className="mt-6 w-full">Go to dashboard</Button>
      </Link>
    </Card>
  );
}
