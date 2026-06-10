"use client";

/**
 * Student login form (Phase 10) — two paths:
 *   1. Access code (from the acceptance email)
 *   2. Email OTP (the official lost-code recovery path): request → verify
 *
 * Calls the PUBLIC student-auth actions; on success the server has already
 * set the signed yuva_session cookie, so we just navigate to the portal.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Mail } from "lucide-react";
import {
  loginWithAccessCode,
  requestOtp,
  verifyOtp,
} from "@/app/youth-academy/actions/student-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function StudentLoginForm() {
  const router = useRouter();

  // Access-code path
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  // OTP path
  const [email, setEmail] = useState("");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otpInfo, setOtpInfo] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  async function handleCodeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCodeError(null);
    setCodeLoading(true);
    try {
      const result = await loginWithAccessCode(code);
      if (result.success) {
        router.push(result.data.redirectTo);
        router.refresh();
      } else {
        setCodeError(result.error);
        setCodeLoading(false);
      }
    } catch {
      setCodeError("Something went wrong. Please try again.");
      setCodeLoading(false);
    }
  }

  async function handleOtpRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOtpError(null);
    setOtpInfo(null);
    setOtpLoading(true);
    try {
      const result = await requestOtp(email);
      if (result.success) {
        setOtpInfo(result.data.message);
        setOtpStep("verify");
      } else {
        setOtpError(result.error);
      }
    } catch {
      setOtpError("Something went wrong. Please try again.");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleOtpVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOtpError(null);
    setOtpLoading(true);
    try {
      const result = await verifyOtp(email, otpCode);
      if (result.success) {
        router.push(result.data.redirectTo);
        router.refresh();
      } else {
        setOtpError(result.error);
        setOtpLoading(false);
      }
    } catch {
      setOtpError("Something went wrong. Please try again.");
      setOtpLoading(false);
    }
  }

  return (
    <Tabs defaultValue="code" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="code" className="gap-1.5">
          <KeyRound className="size-3.5" />
          Access code
        </TabsTrigger>
        <TabsTrigger value="otp" className="gap-1.5">
          <Mail className="size-3.5" />
          Email code
        </TabsTrigger>
      </TabsList>

      {/* ── Path 1: access code ── */}
      <TabsContent value="code">
        <form onSubmit={handleCodeSubmit} className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="yuva-access-code">Access code</Label>
            <Input
              id="yuva-access-code"
              name="accessCode"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="e.g. K7MPX2RQ"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-widest"
              maxLength={12}
              required
            />
            <p className="text-xs text-slate-500">
              The 8-character code from your acceptance email.
            </p>
          </div>
          {codeError && (
            <p className="text-sm text-red-600" role="alert">
              {codeError}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={codeLoading}>
            {codeLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </TabsContent>

      {/* ── Path 2: email OTP ── */}
      <TabsContent value="otp">
        {otpStep === "request" ? (
          <form onSubmit={handleOtpRequest} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="yuva-otp-email">Email</Label>
              <Input
                id="yuva-otp-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-xs text-slate-500">
                The email you applied with. We&apos;ll send a one-time login
                code — this also works if you lost your access code.
              </p>
            </div>
            {otpError && (
              <p className="text-sm text-red-600" role="alert">
                {otpError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={otpLoading}>
              {otpLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Email me a code"
              )}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleOtpVerify} className="space-y-3 pt-2">
            {otpInfo && <p className="text-sm text-slate-600">{otpInfo}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="yuva-otp-code">6-digit code</Label>
              <Input
                id="yuva-otp-code"
                name="otpCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="font-mono tracking-widest"
                maxLength={6}
                required
              />
            </div>
            {otpError && (
              <p className="text-sm text-red-600" role="alert">
                {otpError}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={otpLoading || otpCode.length !== 6}
            >
              {otpLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Verify & sign in"
              )}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-700"
              onClick={() => {
                setOtpStep("request");
                setOtpCode("");
                setOtpError(null);
                setOtpInfo(null);
              }}
            >
              Use a different email / resend
            </button>
          </form>
        )}
      </TabsContent>
    </Tabs>
  );
}
