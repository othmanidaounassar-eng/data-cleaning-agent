"use client";

import { useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export default function VerifyEmailExpiredPage() {
  const { resendVerificationEmail, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await resendVerificationEmail(email);
      setSent(true);
    } catch {
      // error surfaced via useAuth().error
    }
  };

  return (
    <Card className="w-full max-w-sm glass-strong text-center py-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-signal-warn/10 mb-4">
        <Clock className="h-5 w-5 text-signal-warn" />
      </div>

      <CardTitle className="text-lg">This link has expired</CardTitle>
      <CardDescription className="mt-1.5">
        Verification links are valid for 24 hours. Enter your email to get a new one.
      </CardDescription>

      {sent ? (
        <p className="mt-5 text-xs text-signal-good">A new verification link is on its way.</p>
      ) : (
        <form className="mt-5 space-y-3 text-left" onSubmit={handleResend}>
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

          {error && <p className="text-xs text-signal-bad">{error.message}</p>}

          <Button type="submit" className="w-full" loading={loading}>
            <RotateCcw className="h-3.5 w-3.5" />
            Send new link
          </Button>
        </form>
      )}
    </Card>
  );
}
