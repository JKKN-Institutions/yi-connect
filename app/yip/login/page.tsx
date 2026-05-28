"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginOrganizer } from "@/app/yip/actions/auth";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/yip/ui/card";
import { LogIn, Loader2 } from "lucide-react";
import { GoogleOAuthButton } from "@/lib/auth/google-oauth-button";
import { MagicLinkForm } from "@/lib/auth/magic-link-form";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginOrganizer(email, password);
      if (result.success) {
        router.push("/yip/dashboard");
        router.refresh();
      } else {
        setError(result.error);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Logo / Branding */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF9933]/10">
          <span className="text-2xl font-bold text-[#FF9933]">YIP</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Young Indians Parliament
        </h1>
        <p className="mt-1 text-sm text-gray-500">Organizer Portal</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Enter your credentials to access the organizer dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="organizer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-10"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full bg-[#FF9933] text-white hover:bg-[#E68A2E]"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Alternative auth methods — Google OAuth + magic-link.
              All three (password / Google / magic-link) produce the same
              Supabase session cookie. Per CLAUDE.md auth-UI rule we share
              these from lib/auth/. */}
          <div className="mt-6 space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#1a1a3e]/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-[#1a1a3e]/50">Or continue with</span>
              </div>
            </div>
            <GoogleOAuthButton
              redirectTo="/yip/dashboard"
              className="h-10 w-full justify-center"
            />
            <MagicLinkForm redirectTo="/yip/dashboard" />
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-gray-500">
        Are you a participant or jury member?{" "}
        <Link href="/yip/join" className="font-medium text-[#FF9933] hover:underline">
          Join with access code
        </Link>
      </p>

      <div className="mt-4 rounded-lg border border-dashed border-[#1a1a3e]/15 bg-[#1a1a3e]/[0.02] px-4 py-3 text-center">
        <p className="text-xs text-[#1a1a3e]/60 mb-2">
          Exploring the platform?
        </p>
        <Link
          href="/yip/test-login"
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#FF9933] hover:underline"
        >
          One-click demo accounts →
        </Link>
      </div>
    </>
  );
}
