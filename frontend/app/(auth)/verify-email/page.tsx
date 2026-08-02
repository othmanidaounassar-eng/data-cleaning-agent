"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck, RotateCcw } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function VerifyEmailPendingPage() {
  const { user, resendVerificationEmail, loading, error } = useAuth();
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    if (!user?.email) return;
    try {
      await resendVerificationEmail(user.email);
      setResent(true);
    } catch {
      // error surfaced via useAuth().error
    }
  };

  return (
    <Card className="w-full max-w-sm glass-strong text-center py-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-blue/10 mb-4">
        <MailCheck className="h-5 w-5 text-accent-blue" />
      </div>

      <CardTitle className="text-lg">Verify your email</CardTitle>
      <CardDescription className="mt-1.5">
        We sent a verification link to{" "}
        <span className="text-ink-100 font-medium">{user?.email ?? "your email address"}</span>.
        Click it to activate your account.
      </CardDescription>

      {resent && (
        <p className="mt-4 text-xs text-signal-good">Verification email resent.</p>
      )}

      {error && <p className="mt-4 text-xs text-signal-bad">{error.message}</p>}

      <Button variant="secondary" size="sm" className="mt-6" onClick={handleResend} loading={loading}>
        <RotateCcw className="h-3.5 w-3.5" />
        Resend email
      </Button>

      <p className="mt-6 text-xs text-ink-500">
        Already verified?{" "}
        <Link href="/dashboard" className="text-accent-blue hover:underline">
          Go to dashboard
        </Link>
      </p>
    </Card>
  );
}
