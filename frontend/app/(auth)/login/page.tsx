"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const router = useRouter();
  const { login, loading, error } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login({ email, password, rememberMe });
      router.push("/dashboard");
    } catch {
      // error state is already surfaced via useAuth().error
    }
  };

  return (
    <Card className="w-full max-w-sm glass-strong">
      <CardTitle className="text-xl">Welcome back</CardTitle>
      <CardDescription className="mb-6">Sign in to continue cleaning datasets</CardDescription>

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
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-accent-blue hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Checkbox
          id="remember-me"
          checked={rememberMe}
          onChange={setRememberMe}
          label="Remember me on this device"
        />

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-signal-bad/25 bg-signal-bad/[0.06] px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-signal-bad shrink-0 mt-0.5" />
            <p className="text-xs text-signal-bad">{error.message}</p>
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-accent-blue hover:underline">
          Create one
        </Link>
      </p>
    </Card>
  );
}
