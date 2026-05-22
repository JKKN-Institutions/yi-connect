"use client";

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { requestEmailOtp, verifyEmailOtp } from "@/app/yi-future/actions/email-verify";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmailStep({
  email: emailProp,
  onSuccess,
  onBack,
}: {
  email?: string;
  onSuccess: () => void;
  onBack?: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>("Code sent — check your inbox.");
  const [cooldown, setCooldown] = useState<number>(RESEND_COOLDOWN_SECONDS);
  const [email, setEmail] = useState<string | null>(emailProp ?? null);
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const sentInitialRef = useRef(false);

  // Send the first OTP on mount.
  useEffect(() => {
    if (sentInitialRef.current) return;
    sentInitialRef.current = true;
    startResend(async () => {
      const res = await requestEmailOtp();
      if (!res.ok) {
        setInfo(null);
        setError(res.error);
      } else if (res.email) {
        setEmail(res.email);
      }
    });
    inputsRef.current[0]?.focus();
    // We want this to run exactly once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cooldown ticker for the Resend button.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function shake() {
    const el = cardRef.current;
    if (!el) return;
    el.classList.remove("animate-shake");
    void el.offsetWidth;
    el.classList.add("animate-shake");
  }

  function setDigitAt(idx: number, value: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }

  function handleChange(idx: number, raw: string) {
    const onlyDigits = raw.replace(/\D/g, "");
    if (error) setError(null);

    if (onlyDigits.length === 0) {
      setDigitAt(idx, "");
      return;
    }

    // Pasted multi-character input — distribute across boxes.
    if (onlyDigits.length > 1) {
      const next = [...digits];
      let cursor = idx;
      for (const ch of onlyDigits) {
        if (cursor >= 6) break;
        next[cursor] = ch;
        cursor += 1;
      }
      setDigits(next);
      const focusIdx = Math.min(cursor, 5);
      inputsRef.current[focusIdx]?.focus();
      maybeSubmit(next);
      return;
    }

    // Single character input — set + auto-advance.
    setDigitAt(idx, onlyDigits);
    if (idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
    const tentative = [...digits];
    tentative[idx] = onlyDigits;
    maybeSubmit(tentative);
  }

  function handleKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[idx]) {
        setDigitAt(idx, "");
        return;
      }
      if (idx > 0) {
        inputsRef.current[idx - 1]?.focus();
        setDigitAt(idx - 1, "");
      }
    } else if (e.key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (e.key === "ArrowRight" && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    const focusIdx = Math.min(text.length, 5);
    inputsRef.current[focusIdx]?.focus();
    maybeSubmit(next);
  }

  function maybeSubmit(current: string[]) {
    if (current.every((d) => d.length === 1)) {
      const code = current.join("");
      submit(code);
    }
  }

  function submit(code: string) {
    if (pending) return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const res = await verifyEmailOtp(code);
      if (res.ok) {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate?.(30);
          } catch {
            /* no-op */
          }
        }
        onSuccess();
      } else {
        setError(res.error);
        shake();
        setDigits(["", "", "", "", "", ""]);
        inputsRef.current[0]?.focus();
      }
    });
  }

  function handleResend() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setInfo(null);
    startResend(async () => {
      const res = await requestEmailOtp();
      if (res.ok) {
        if (res.email) setEmail(res.email);
        setInfo("New code sent — check your inbox.");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setDigits(["", "", "", "", "", ""]);
        inputsRef.current[0]?.focus();
      } else {
        setError(res.error);
      }
    });
  }

  const allFilled = digits.every((d) => d.length === 1);

  return (
    <div className="max-w-lg mx-auto px-4 py-10 md:py-16">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-navy/60 hover:text-navy mb-6 min-h-[44px] py-2 px-3 inline-flex items-center"
        >
          ← Back
        </button>
      )}

      <div ref={cardRef}>
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yi-gold/10 text-navy text-[11px] font-semibold tracking-wider uppercase mb-4">
            <span>✉</span> Verify your email
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-navy tracking-tight">
            Enter the 6-digit code
          </h1>
          <p className="mt-3 text-sm text-navy/60 leading-relaxed max-w-sm mx-auto">
            We sent a verification code to{" "}
            <span className="font-semibold text-navy">
              {email ?? "your email"}
            </span>
            . It expires in 15 minutes.
          </p>
        </div>

        <div className="mt-10">
          <div
            className="flex justify-center gap-1.5 md:gap-3"
            onPaste={handlePaste}
          >
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={`Digit ${i + 1}`}
                disabled={pending}
                className={`w-10 h-14 md:w-14 md:h-20 min-w-[44px] min-h-[44px] rounded-lg border-2 text-center text-2xl md:text-4xl font-mono font-bold transition-all outline-none focus:ring-2 focus:ring-yi-gold ${
                  d
                    ? "border-yi-gold bg-yi-gold/5 text-navy scale-[1.02]"
                    : "border-navy/20 bg-white text-navy"
                } disabled:opacity-50`}
              />
            ))}
          </div>

          {error && (
            <div className="mt-5 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 text-center">
              {error}
            </div>
          )}

          {!error && info && (
            <div className="mt-5 p-3 rounded-md bg-yi-green/5 border border-yi-green/20 text-sm text-navy/70 text-center">
              {info}
            </div>
          )}

          <button
            type="button"
            onClick={() => submit(digits.join(""))}
            disabled={!allFilled || pending}
            className="mt-8 w-full min-h-[44px] py-4 rounded-xl bg-navy text-ivory font-semibold hover:bg-navy-dark transition-all disabled:opacity-40 disabled:cursor-not-allowed text-base"
          >
            {pending ? "Verifying…" : "Verify email"}
          </button>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="min-h-[44px] py-2 px-3 text-sm font-semibold text-navy hover:text-yi-gold disabled:text-navy/40 disabled:cursor-not-allowed"
            >
              {resending
                ? "Sending…"
                : cooldown > 0
                  ? `Resend code in ${cooldown}s`
                  : "Resend code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
