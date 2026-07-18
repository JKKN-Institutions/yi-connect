"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resolveMember,
  registerMember,
  type ResolvedMember,
  type Fee,
} from "@/app/yifi/actions/register";

const INPUT =
  "w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#FD7215] focus:border-transparent";
const LABEL = "text-white/60 text-xs uppercase tracking-wide mb-1.5 block";

// Stage machine for the member-gated register door:
//   lookup     — enter email/phone, resolve against the Yi member directory
//   rejected   — not a Yi member (explicit screen, never a silent redirect)
//   pay         — resolved: show name + fee + payment instructions, enter a reference
//   done        — registered, payment pending verification, show access code
type Stage =
  | { kind: "lookup" }
  | { kind: "rejected"; email: string }
  | { kind: "pay"; member: ResolvedMember; editionId: string; fee: Fee }
  | { kind: "done"; code: string };

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount == null) return "the registration fee";
  const cur = (currency || "INR").toUpperCase();
  const symbol = cur === "INR" ? "₹" : cur === "USD" ? "$" : `${cur} `;
  const n = Number(amount);
  const pretty = Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toString();
  return `${symbol}${pretty}`;
}

export function RegisterForm({ onUseCode }: { onUseCode?: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "lookup" });

  // lookup inputs
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const headingRef = useRef<HTMLHeadingElement>(null);

  // On stage swaps that show a short card, bring it into view + announce it.
  useEffect(() => {
    if (stage.kind === "done" || stage.kind === "rejected" || stage.kind === "pay") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      headingRef.current?.focus();
    }
  }, [stage]);

  function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await resolveMember(email, phone);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!result.found) {
        setStage({ kind: "rejected", email: email.trim() });
        return;
      }
      setStage({
        kind: "pay",
        member: result.member,
        editionId: result.editionId,
        fee: result.fee,
      });
    });
  }

  function handlePay(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await registerMember(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStage({ kind: "done", code: result.accessCode });
    });
  }

  // ── REJECTED: not in the Yi member directory ──────────────────────────────
  if (stage.kind === "rejected") {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">🙏</div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold text-white mb-2 outline-none"
        >
          We couldn&apos;t find you in the Yi member directory
        </h2>
        <p className="text-white/60 text-sm mb-5">
          YiFi is for Yi members. We looked up{" "}
          {stage.email ? (
            <span className="text-white font-medium">{stage.email}</span>
          ) : (
            "your details"
          )}{" "}
          and didn&apos;t find a matching member. Please ask your chapter to add you to
          the Yi member directory, then try again.
        </p>
        <button
          onClick={() => {
            setError("");
            setStage({ kind: "lookup" });
          }}
          className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors"
        >
          ← Try a different email or phone
        </button>
        <p className="text-white/40 text-xs mt-4">
          Already registered? Use the{" "}
          <button
            type="button"
            onClick={() => onUseCode?.()}
            className="text-[#FD7215] underline hover:no-underline"
          >
            access-code
          </button>{" "}
          door instead.
        </p>
      </div>
    );
  }

  // ── DONE: registered, payment pending verification ────────────────────────
  if (stage.kind === "done") {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-center">
        <div className="text-4xl mb-3">🎉</div>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-bold text-white mb-1 outline-none"
        >
          You&apos;re registered!
        </h2>
        <p className="text-white/60 text-sm mb-4">
          Welcome to YiFi 2026. Your payment is{" "}
          <span className="text-amber-300 font-medium">pending verification</span> by
          the organisers — you have full access in the meantime.
        </p>

        <div className="bg-[#FD7215]/10 border border-[#FD7215]/40 rounded-lg py-4 mb-2">
          <p className="text-white/50 text-[11px] uppercase tracking-wider mb-1">
            Your access code
          </p>
          <p className="text-3xl font-mono font-bold tracking-widest text-[#FD7215]">
            {stage.code}
          </p>
        </div>
        <p className="text-white/40 text-xs mb-6">
          Save this code — it&apos;s how you log back in to your routing card and
          dossier.
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

  // ── PAY: resolved member, show fee + payment instructions, enter reference ─
  if (stage.kind === "pay") {
    const { member, editionId, fee } = stage;
    const amountLabel = formatAmount(fee.amount, fee.currency);

    return (
      <div>
        <div className="text-center mb-6">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold text-white mb-1 outline-none"
          >
            Confirm &amp; <span className="text-[#FD7215]">Pay</span>
          </h1>
          <p className="text-white/50 text-sm">
            One more step — pay your fee, then enter your reference.
          </p>
        </div>

        {/* Resolved member identity */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4 mb-5">
          {member.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.photo_url}
              alt=""
              className="w-12 h-12 rounded-full object-cover border border-white/20"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-[#FD7215]/20 border border-[#FD7215]/40 flex items-center justify-center text-[#FD7215] font-bold text-lg">
              {member.full_name?.[0]?.toUpperCase() ?? "Y"}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-semibold truncate">{member.full_name}</p>
            <p className="text-[#229434] text-xs">✓ Verified Yi member</p>
          </div>
        </div>

        {/* Fee + payment instructions */}
        <div className="bg-[#FD7215]/10 border border-[#FD7215]/40 rounded-xl p-4 mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-white/60 text-xs uppercase tracking-wide">
              Amount due
            </span>
            {fee.tier && (
              <span className="text-[#229434] text-[11px] font-medium uppercase tracking-wide">
                {fee.tier === "early_bird" ? "Early bird" : fee.tier}
              </span>
            )}
          </div>
          <p className="text-3xl font-bold text-[#FD7215] mb-3">{amountLabel}</p>
          {fee.payment_instructions ? (
            <div className="border-t border-white/10 pt-3">
              <p className="text-white/60 text-xs uppercase tracking-wide mb-1.5">
                How to pay
              </p>
              <p className="text-white/80 text-sm whitespace-pre-wrap break-words">
                {fee.payment_instructions}
              </p>
            </div>
          ) : (
            <p className="text-white/50 text-xs border-t border-white/10 pt-3">
              Your chapter organiser will share payment details. Pay via UPI / bank
              transfer, then enter the reference below.
            </p>
          )}
        </div>

        <p className="text-white/50 text-xs mb-4">
          Pay <span className="text-white font-medium">{amountLabel}</span> via UPI /
          bank transfer, then enter your payment reference below. An organiser verifies
          it later — you get access immediately.
        </p>

        <form action={handlePay} className="space-y-4">
          <input type="hidden" name="edition_id" value={editionId} />
          <input type="hidden" name="person_id" value={member.person_id} />
          <input type="hidden" name="full_name" value={member.full_name ?? ""} />
          <input type="hidden" name="email" value={member.email ?? ""} />
          <input type="hidden" name="phone" value={member.phone ?? ""} />
          <input
            type="hidden"
            name="amount_due"
            value={fee.amount != null ? String(fee.amount) : ""}
          />

          <div>
            <label className={LABEL}>Payment reference (UPI / transaction id) *</label>
            <input
              name="payment_reference"
              required
              placeholder="e.g. UPI ref 4032… or bank UTR"
              className={INPUT}
              autoFocus
            />
            <p className="text-white/30 text-[11px] mt-1.5">
              The UPI reference number or bank transaction id from your payment.
            </p>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Submitting…" : "Submit & Get My Access Code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setError("");
              setStage({ kind: "lookup" });
            }}
            className="w-full text-white/40 text-xs hover:text-white/70 transition-colors"
          >
            ← That&apos;s not me
          </button>
        </form>
      </div>
    );
  }

  // ── LOOKUP: resolve against the Yi member directory ───────────────────────
  return (
    <div>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">
          Register for <span className="text-[#FD7215]">YiFi 2026</span>
        </h1>
        <p className="text-white/50 text-sm">
          YiFi is for Yi members. Enter your email (or phone) and we&apos;ll find you in
          the Yi member directory.
        </p>
      </div>

      <form onSubmit={handleLookup} className="space-y-4">
        <div>
          <label className={LABEL}>Email</label>
          <input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={INPUT}
          />
        </div>
        <div>
          <label className={LABEL}>Phone (if email isn&apos;t on file)</label>
          <input
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="10-digit mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={INPUT}
          />
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={isPending || (!email.trim() && !phone.trim())}
          className="w-full py-3 bg-[#FD7215] text-white font-semibold rounded-lg hover:bg-[#e5660f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Looking you up…" : "Continue"}
        </button>
        <p className="text-white/30 text-[11px] text-center">
          Not a Yi member yet? Ask your chapter to add you to the directory first.
        </p>
      </form>
    </div>
  );
}
