"use client";

/**
 * Per-member sign-in repair, on the chapter setup screen.
 *
 * A `future.chapter_core_team` row whose `user_id` is NULL is a person who is
 * visibly on the roster and cannot open a single chapter screen, because every
 * chapter gate matches those rows by `user_id`. Adding a member now creates the
 * account, but until this panel there was no way to repair a row that already
 * existed — it took a hand-run script, on the eve of a chapter finale.
 *
 * FAILURE PATH IS THE POINT. The server action can throw (deploy mid-request,
 * dropped connection, auth outage) or half-succeed (account created, roster link
 * failed). Both must land as words on screen, never as a button that spins
 * forever:
 *   - every call is wrapped in try/catch/finally, so a rejection releases the UI;
 *   - a watchdog says "still working" after 15s instead of looking hung;
 *   - the action is idempotent, so the message on every failure tells the admin
 *     that pressing the button again is safe.
 *
 * The one-time password is rendered from the action's return value only. It is
 * never emailed, never logged, and never placed in a URL. The result block is
 * rendered INDEPENDENTLY of `member.user_id` on purpose: the action revalidates
 * this route, so the member flips to "linked" a moment later — if the panel
 * branched on that prop, the password would vanish the instant it was issued.
 */

import { useEffect, useRef, useState } from "react";
import { createCoreTeamMemberLogin } from "@/app/yi-future/actions/core-team";
import type { CreateLoginResult } from "@/lib/yi-future/auth/core-team-login";

const WATCHDOG_MS = 15_000;

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  user_id: string | null;
};

export function CoreTeamAccessPanel({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<CreateLoginResult | null>(null);
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (watchdog.current) clearTimeout(watchdog.current);
    },
    []
  );

  const hasEmail = Boolean(member.email && member.email.trim());
  const password =
    result && result.ok && (result.kind === "created" || result.kind === "reset")
      ? result.tempPassword
      : null;

  async function run(resetPassword: boolean) {
    if (pending) return; // double-submit guard: two clicks must not race
    setPending(true);
    setSlow(false);
    setCopied(false);
    setResult(null);
    watchdog.current = setTimeout(() => setSlow(true), WATCHDOG_MS);
    try {
      const res = await createCoreTeamMemberLogin({
        id: member.id,
        email: email.trim() || null,
        resetPassword,
      });
      setResult(res);
      if (res.ok) {
        setOpen(false);
        setConfirmReset(false);
      }
    } catch (err) {
      // Never swallow this and never leave the button spinning. We genuinely do
      // not know how far the server got, so say exactly that — and say that
      // retrying is safe, because the action looks an account up by email before
      // creating one and so cannot mint a duplicate.
      setResult({
        ok: false,
        kind: "error",
        error: `The request did not complete: ${
          err instanceof Error ? err.message : "connection lost"
        }. It may have partly succeeded. Pressing the button again is safe — it re-uses an existing account instead of creating a second one. Reload the page first to see the current state.`,
      });
    } finally {
      if (watchdog.current) {
        clearTimeout(watchdog.current);
        watchdog.current = null;
      }
      setPending(false);
      setSlow(false);
    }
  }

  async function copyPassword() {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked on insecure origins. The password is on screen and
      // selectable, so this is a deliberate silent fallback.
      setCopied(false);
    }
  }

  return (
    <div className="mt-2">
      {/* ─── Triggers ──────────────────────────────────────────────── */}
      {!member.user_id && !open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setResult(null);
          }}
          className="text-xs font-semibold text-navy border border-navy/25 rounded px-2.5 py-1 bg-white hover:border-yi-gold hover:text-yi-gold"
        >
          Create login
        </button>
      )}

      {member.user_id && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirmReset) {
              void run(true);
            } else {
              setConfirmReset(true);
              setResult(null);
            }
          }}
          className="text-xs font-semibold text-navy/60 hover:text-navy underline disabled:opacity-50"
        >
          {pending
            ? "Working…"
            : confirmReset
              ? "Confirm: replace their password"
              : "Issue a new password"}
        </button>
      )}
      {member.user_id && confirmReset && !pending && (
        <p className="mt-1 text-[11px] text-navy/60">
          This replaces the password they use today across Yi. Only do it if they
          cannot sign in.{" "}
          <button
            type="button"
            onClick={() => setConfirmReset(false)}
            className="underline"
          >
            Cancel
          </button>
        </p>
      )}

      {/* ─── Create-login panel ────────────────────────────────────── */}
      {open && !member.user_id && (
        <div className="mt-2 rounded-md border border-navy/15 bg-navy/[0.03] p-3 space-y-2">
          {hasEmail ? (
            <p className="text-[11px] text-navy/70">
              Creates a sign-in for{" "}
              <span className="font-mono">{member.email}</span> and shows a
              temporary password once. If an account already exists for that
              address it is linked instead — no second account, and their
              existing password is left alone. Their role does not change.
            </p>
          ) : (
            <>
              {/* Requirement: explain, don't fail obscurely. A sign-in account
                  cannot exist without an email address. */}
              <p className="text-[11px] text-navy/70">
                <span className="font-semibold text-navy">
                  No email on record.
                </span>{" "}
                A sign-in needs an email address, so nothing can be created yet.
                Collect their email and enter it here — only the email is saved,
                their role is untouched.
              </p>
              <label
                htmlFor={`cta-email-${member.id}`}
                className="block text-[10px] font-semibold uppercase tracking-widest text-navy/60"
              >
                Email address
              </label>
              <input
                id={`cta-email-${member.id}`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-2.5 py-1.5 border border-navy/20 rounded text-sm bg-white"
              />
            </>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              aria-busy={pending}
              onClick={() => void run(false)}
              className="text-xs font-semibold rounded px-3 py-1.5 bg-navy text-ivory hover:bg-navy-dark disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create login"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setEmail("");
              }}
              className="text-xs text-navy/60 hover:text-navy disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ─── Watchdog + result ─────────────────────────────────────── */}
      <div aria-live="polite">
        {pending && slow && (
          <p className="mt-2 text-[11px] font-semibold text-navy/70">
            Still working — don&apos;t press it again yet. If nothing happens,
            reload the page to see whether it went through; retrying is safe
            either way.
          </p>
        )}

        {result && !result.ok && (
          <p
            className={`mt-2 text-xs font-semibold ${
              result.kind === "no_email" ? "text-navy" : "text-red-600"
            }`}
          >
            {result.error}
          </p>
        )}

        {result && result.ok && (
          <div className="mt-2 rounded-md border border-yi-green/40 bg-yi-green/10 p-3">
            <p className="text-xs font-semibold text-navy">{result.message}</p>
            {password && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="px-2 py-1 rounded bg-white border border-navy/20 font-mono text-sm tracking-widest text-navy select-all">
                  {password}
                </code>
                <button
                  type="button"
                  onClick={() => void copyPassword()}
                  className="text-xs font-semibold text-navy border border-navy/20 rounded px-2 py-1 bg-white"
                >
                  {copied ? "Copied ✓" : "Copy"}
                </button>
                <span className="text-[11px] text-navy/60">
                  Shown once — it is not stored anywhere and cannot be shown
                  again.
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
