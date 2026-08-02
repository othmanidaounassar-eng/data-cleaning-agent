"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, MailCheck } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function ForgotPasswordPage() {
  const { requestPasswordReset, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      // error surfaced via useAuth().error
    }
  };

  return (
    <Card className="w-full max-w-sm glass-strong">
      {sent ? (
        <div className="text-center py-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-blue/10 mb-4">
            <MailCheck className="h-5 w-5 text-accent-blue" />
          </div>
          <CardTitle className="text-lg">Check your email</CardTitle>
          <CardDescription className="mt-1">
            We sent a password reset link if an account exists for that address.
          </CardDescription>
        </div>
      ) : (
        <>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription className="mb-6">
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-signal-bad/25 bg-signal-bad/[0.06] px-3 py-2.5">
                <AlertCircle className="h-4 w-4 text-signal-bad shrink-0 mt-0.5" />
                <p className="text-xs text-signal-bad">{error.message}</p>
              </div>
            )}

            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-xs text-ink-500">
        <Link href="/login" className="text-accent-blue hover:underline">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
