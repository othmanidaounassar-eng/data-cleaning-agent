"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, User, Building2 } from "lucide-react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/use-auth";
import { AccountType } from "@/lib/auth/types";

export default function RegisterPage() {
  const router = useRouter();
  const { register, loading, error } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("individual");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register({ fullName, email, password, confirmPassword, acceptTerms, accountType });
      router.push("/verify-email");
    } catch {
      // error state is already surfaced via useAuth().error
    }
  };

  return (
    <Card className="w-full max-w-sm glass-strong">
      <CardTitle className="text-xl">Create your account</CardTitle>
      <CardDescription className="mb-6">Start cleaning datasets in minutes</CardDescription>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label>Account type</Label>
          <RadioGroup
            name="accountType"
            value={accountType}
            onChange={setAccountType}
            options={[
              { value: "individual", label: "Individual", icon: User },
              { value: "company", label: "Company", icon: Building2 },
            ]}
          />
        </div>

        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" required placeholder="Jane Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            required
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <Checkbox
          id="accept-terms"
          checked={acceptTerms}
          onChange={setAcceptTerms}
          required
          label={
            <>
              I agree to the{" "}
              <Link href="#" className="text-accent-blue hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="#" className="text-accent-blue hover:underline">
                Privacy Policy
              </Link>
            </>
          }
        />

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-signal-bad/25 bg-signal-bad/[0.06] px-3 py-2.5">
            <AlertCircle className="h-4 w-4 text-signal-bad shrink-0 mt-0.5" />
            <p className="text-xs text-signal-bad">{error.message}</p>
          </div>
        )}

        <Button type="submit" className="w-full" loading={loading} disabled={!acceptTerms}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-500">
        Already have an account?{" "}
        <Link href="/login" className="text-accent-blue hover:underline">
          Sign in
        </Link>
      </p>
    </Card>
  );
}
