"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerSelf, prefillByEmail } from "@/app/yifi/actions/register";

const INPUT =
  "w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FD7215] focus:border-transparent";
const SELECT =
  "w-full px-3 py-2.5 bg-[#0a0a4a] border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FD7215] focus:border-transparent";
const LABEL = "text-white/60 text-xs uppercase tracking-wide mb-1.5 block";

const MEMBER_CATEGORIES = [
  { value: "ec", label: "EC — Enablers of Change" },
  { value: "gc", label: "GC" },
  { value: "nmt", label: "NMT" },
  { value: "general", label: "General / Guest" },
];

const TEAM_SIZES = ["Just me", "2–10", "11–50", "51–200", "200+"];

const SEEKING_OPTIONS = [
  { value: "co-founder", label: "Find a co-founder / partner" },
  { value: "investor", label: "Raise capital / find investors" },
  { value: "scale", label: "Scale / grow my business" },
  { value: "customers", label: "Find customers / distribution" },
  { value: "mentorship", label: "Get mentorship" },
  { value: "talent", label: "Hire / find talent" },
  { value: "suppliers", label: "Find suppliers / vendors" },
  { value: "learn", label: "Learn & explore" },
];

type SuccessState = { kind: "registered"; code: string } | { kind: "already" };

export function RegisterForm({ onUseCode }: { onUseCode?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [isCouple, setIsCouple] = useState(false);

  // Controlled so directory pre-fill can populate them on email blur.
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [prefilled, setPrefilled] = useState(false);

  const [success, setSuccess] = useState<SuccessState | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // On the success swap, bring the (short) success card into view and announce it —
  // otherwise on this long form the all-important access code can render above the fold.
  useEffect(() => {
    if (success) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      headingRef.current?.focus();
    }
  }, [success]);

  // Prefill runs OUTSIDE the submit transition so a slow directory lookup never
  // disables the submit button, and only fills fields the user has left blank.
  async function handleEmailBlur() {
    const value = email.trim();
    if (!value.includes("@")) return;
    const match = await prefillByEmail(value);
    if (match?.full_name) {
      setFullName((prev) => (prev ? prev : match.full_name));
      setPrefilled(true);
    }
  }

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await registerSelf(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.status === "already_registered") {
        setSuccess({ kind: "already" });
        return;
      }
      setSuccess({ kind: "registered", code: result.accessCode });
    });
  }

  if (success?.kind === "already") {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">👋</div>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-white mb-1 outline-none">
          You&apos;re already registered
        </h2>
        <p className="text-white/50 text-sm mb-5">
          This email already has a YiFi registration. Use the access code from your registration
          confirmation to log in.
        </p>
        <button
          onClick={() => onUseCode?.()}
          className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors"
        >
          I have a code →
        </button>
        <p className="text-white/40 text-xs mt-4">
          Can&apos;t find your code? Contact your chapter&apos;s YiFi organiser to have it resent.
        </p>
      </div>
    );
  }

  if (success?.kind === "registered") {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-white mb-1 outline-none">
          You&apos;re in.
        </h2>
        <p className="text-white/50 text-sm mb-5">
          Welcome to YiFi 2026 — Built for Generations.
        </p>

        <div className="bg-[#FD7215]/10 border border-[#FD7215]/40 rounded-lg py-4 mb-2">
          <p className="text-white/50 text-[11px] uppercase tracking-wider mb-1">Your access code</p>
          <p className="text-3xl font-mono font-bold tracking-widest text-[#FD7215]">{success.code}</p>
        </div>
        <p className="text-white/40 text-xs mb-6">
          Save this code — it&apos;s how you log back in to your routing card and dossier.
        </p>

        <button
          onClick={() => router.push("/yifi/me")}
          className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors"
        >
          Continue to YiFi →
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">
          Register for <span className="text-[#FD7215]">YiFi 2026</span>
        </h1>
        <p className="text-white/50 text-sm">
          This is your census too — it powers your personalised matches and dossier.
        </p>
      </div>

      <form action={handleSubmit} className="space-y-5">
        {/* Identity */}
        <div className="space-y-3">
          <div>
            <label className={LABEL}>
              Email{" "}
              {prefilled && <span className="text-[#229434] normal-case">· found your Yi profile</span>}
            </label>
            <input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com (helps us pre-fill your name)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              className={INPUT}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Full name *</label>
              <input
                name="full_name"
                required
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={INPUT}
              />
            </div>
            <div>
              <label className={LABEL}>Phone (WhatsApp) *</label>
              <input
                name="phone"
                required
                inputMode="tel"
                autoComplete="tel"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Member category *</label>
              <select name="member_category" required defaultValue="" className={SELECT}>
                <option value="" disabled>Select…</option>
                {MEMBER_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Yi chapter</label>
              <input name="chapter_name" placeholder="e.g. Yi Erode" className={INPUT} />
            </div>
          </div>
        </div>

        {/* Business / routing core */}
        <div className="border-t border-white/10 pt-4 space-y-3">
          <p className="text-white/70 text-sm font-medium">About your business</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Sector / industry *</label>
              <input name="sector" required placeholder="e.g. Manufacturing, SaaS" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Organisation</label>
              <input name="organisation" placeholder="Company name" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Your role</label>
              <input name="designation" placeholder="e.g. Founder, MD" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>City</label>
              <input name="city" placeholder="City" className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Total team size</label>
              <select name="total_team_size" defaultValue="" className={SELECT}>
                <option value="">Select…</option>
                {TEAM_SIZES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Challenges — the match input */}
        <div className="border-t border-white/10 pt-4">
          <label className={LABEL}>Your top 3 business challenges right now</label>
          <p className="text-white/40 text-xs mb-2">This is what we match you on. Be specific.</p>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <input
                key={i}
                name={`challenge${i + 1}`}
                required={i === 0}
                placeholder={`Challenge ${i + 1}${i === 0 ? " (required)" : " (optional)"}`}
                className={INPUT}
              />
            ))}
          </div>
        </div>

        {/* What you're seeking — intent */}
        <div className="border-t border-white/10 pt-4">
          <label className={LABEL}>What are you hoping to get from YiFi?</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SEEKING_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/80 text-sm cursor-pointer hover:bg-white/10 transition-colors has-[:checked]:border-[#FD7215]/50 has-[:checked]:bg-[#FD7215]/10"
              >
                <input type="checkbox" name="seeking" value={o.value} className="accent-[#FD7215]" />
                {o.label}
              </label>
            ))}
          </div>
        </div>

        {/* What you can offer */}
        <div className="border-t border-white/10 pt-4">
          <label className={LABEL}>What can you offer other founders? (optional)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input name="offer_capital" placeholder="Capital range (e.g. ₹5L–50L)" className={INPUT} />
            <input name="offer_hours" placeholder="Hours/month you can mentor" className={INPUT} />
            <input name="offer_distribution" placeholder="Distribution reach" className={INPUT} />
            <input name="offer_customers" placeholder="Customer access / intro" className={INPUT} />
          </div>
        </div>

        {/* Couple */}
        <div className="border-t border-white/10 pt-4">
          <label className="flex items-center gap-2 text-white/80 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="is_couple"
              checked={isCouple}
              onChange={(e) => setIsCouple(e.target.checked)}
              className="accent-[#FD7215] w-4 h-4"
            />
            Registering as a couple (both attending together)
          </label>
          {isCouple && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <div className="sm:col-span-2">
                <label className={LABEL}>Partner&apos;s name *</label>
                <input name="partner_name" required={isCouple} placeholder="Partner's full name" className={INPUT} />
              </div>
              <input name="partner_phone" inputMode="tel" placeholder="Partner's phone (optional)" className={INPUT} />
              <input name="partner_email" type="email" placeholder="Partner's email (optional)" className={INPUT} />
            </div>
          )}
          {isCouple && (
            <p className="text-white/40 text-xs mt-2">
              Your partner gets their own access code and confirms their own census when they log in.
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Registering…" : "Complete Registration"}
        </button>
        <p className="text-white/30 text-[11px] text-center">
          Your data stays inside Yi — never sold, never shared with sponsors.
        </p>
      </form>
    </div>
  );
}
