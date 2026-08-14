"use client";

import { useState, useTransition } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Gavel,
  Loader2,
  Pencil,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import {
  SectionShell,
  SectionHeading,
  INK,
  SAFFRON,
  GREEN,
  SERIF,
  inkA,
} from "../credential-ui";
import {
  SELF_NOMINATION_ROLES,
  type SelfNominationRole,
} from "@/lib/yip/self-nomination";
import {
  getMySelfNomination,
  submitSelfNomination,
} from "@/app/yip/actions/self-nomination";

/**
 * Student self-nomination screen (/yip/me/nominate).
 *
 * THREE STATES, exactly as the feature spec behaves:
 *   FORM         — pick 1–3 roles, live counter, Submit disabled until ≥1.
 *   CONFIRMATION — tick + the chosen roles + "Edit selection" (re-submit; the
 *                  row is upserted, so editing is the same server call).
 *   CLOSED       — the organiser's explicit toggle is off. A student who
 *                  already nominated still sees their picks above the closed
 *                  panel; only editing is taken away.
 *
 * Identity NEVER comes from props or the URL — every action resolves the
 * participant from the httpOnly `yip_session` cookie server-side. `eventId` is
 * only a scope hint; the action rejects it if it isn't the session's event.
 *
 * The window can be closed by the organiser WHILE this page is open. A failed
 * submit therefore (a) toasts, (b) leaves the reason on the page next to the
 * button — a toast alone is easy to miss on a phone — and (c) re-reads the
 * server state so the screen flips to CLOSED rather than sitting there looking
 * broken.
 */

type Props = {
  eventId: string;
  initialOpen: boolean;
  initialRoles: SelfNominationRole[];
  initialSubmitted: boolean;
  /** Server-side read failure — shown verbatim; the screen fails CLOSED. */
  loadError: string | null;
};

/** Selection held in catalogue order so the UI never reorders on toggle. */
function ordered(roles: readonly SelfNominationRole[]): SelfNominationRole[] {
  const picked = new Set(roles);
  return SELF_NOMINATION_ROLES.filter((r) => picked.has(r.key)).map(
    (r) => r.key
  );
}

export function NominateClient({
  eventId,
  initialOpen,
  initialRoles,
  initialSubmitted,
  loadError,
}: Props) {
  const [open, setOpen] = useState(initialOpen);
  const [hasSubmitted, setHasSubmitted] = useState(initialSubmitted);
  const [submittedRoles, setSubmittedRoles] =
    useState<SelfNominationRole[]>(initialRoles);
  // A returning student opens straight in CONFIRMATION; a first-timer in FORM.
  const [editing, setEditing] = useState(!initialSubmitted);
  const [selected, setSelected] = useState<SelfNominationRole[]>(initialRoles);
  const [error, setError] = useState<string | null>(loadError);
  const [isPending, startTransition] = useTransition();

  // Closed always wins over "editing" — a stale edit view must never linger
  // once the organiser shuts the window.
  const showForm = open && editing;
  const showConfirmation = hasSubmitted && !showForm;

  function toggle(role: SelfNominationRole) {
    if (isPending) return;
    setError(null);
    setSelected((prev) =>
      ordered(
        prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
      )
    );
  }

  function handleSubmit() {
    if (selected.length === 0) {
      setError("Select at least one role to nominate for.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await submitSelfNomination(eventId, selected);
      if (res.success) {
        setSubmittedRoles(res.data.roles);
        setSelected(res.data.roles);
        setHasSubmitted(true);
        setEditing(false);
        toast.success("Nomination submitted.");
        return;
      }

      // Keep the reason on the page AND toast it.
      setError(res.error);
      toast.error(res.error);

      // Re-sync with the server — the usual cause is the organiser closing the
      // window mid-session, and the screen must show that, not just an error.
      const fresh = await getMySelfNomination(eventId);
      if (fresh.success) {
        setOpen(fresh.data.open);
        if (fresh.data.nomination) {
          setHasSubmitted(true);
          setSubmittedRoles(fresh.data.nomination.roles);
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* ─── HEADER ────────────────────────────────────────────── */}
      <SectionShell accent={SAFFRON}>
        <div className="px-5 py-4">
          <SectionHeading
            eyebrow="Leadership"
            title="Self-Nomination"
            icon={Gavel}
            accent={SAFFRON}
            trailing={
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{
                  background: open ? `${GREEN}14` : inkA(0.06),
                  color: open ? GREEN : inkA(0.55),
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: open ? GREEN : inkA(0.35) }}
                />
                {open ? "Open now" : "Closed"}
              </span>
            }
          />
          <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
            Put yourself forward for Administrator, Speaker and/or Party Leader.
          </p>
        </div>
      </SectionShell>

      {/* ─── ERROR (stays visible — a toast is missable on a phone) ─ */}
      {error && (
        <div
          className="flex items-start gap-2.5 rounded-xl px-4 py-3"
          style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <p className="text-xs leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {/* ─── CONFIRMATION ──────────────────────────────────────── */}
      {showConfirmation && (
        <SectionShell accent={GREEN}>
          <div className="px-5 py-5">
            <div className="flex items-center gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${GREEN}14` }}
              >
                <CheckCircle2 className="size-6" style={{ color: GREEN }} />
              </span>
              <div className="min-w-0">
                <h2
                  className="text-[17px] font-semibold leading-snug"
                  style={{ ...SERIF, color: INK }}
                >
                  Nomination Submitted
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: inkA(0.55) }}>
                  {open
                    ? "You're in the running for the role(s) below. You can still edit this until Admin closes the session."
                    : "Nominations are closed. This is the selection the organiser has for you."}
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {SELF_NOMINATION_ROLES.filter((r) =>
                submittedRoles.includes(r.key)
              ).map((role) => (
                <li
                  key={role.key}
                  className="flex items-start gap-2.5 rounded-xl px-3.5 py-3"
                  style={{
                    background: `${GREEN}0a`,
                    border: `1px solid ${GREEN}2e`,
                  }}
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: GREEN }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-[15px] font-semibold leading-snug"
                      style={{ ...SERIF, color: INK }}
                    >
                      {role.label}
                    </p>
                    <p
                      className="mt-0.5 text-xs leading-relaxed"
                      style={{ color: inkA(0.6) }}
                    >
                      {role.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {open && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSelected(submittedRoles);
                  setEditing(true);
                }}
                className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors active:translate-y-px"
                style={{ background: `${SAFFRON}14`, color: SAFFRON }}
              >
                <Pencil className="size-4" />
                Edit selection
              </button>
            )}
          </div>
        </SectionShell>
      )}

      {/* ─── FORM ──────────────────────────────────────────────── */}
      {showForm && (
        <SectionShell accent={SAFFRON}>
          <div className="px-5 py-5">
            <h2
              className="text-[16px] font-semibold leading-snug"
              style={{ ...SERIF, color: INK }}
            >
              Select the role(s) you want to contest for.
            </h2>
            <p
              className="mt-1.5 text-xs leading-relaxed"
              style={{ color: inkA(0.6) }}
            >
              You may select one, two, or all three — this is a shared
              nomination window for all three roles.
            </p>

            <div className="mt-4 space-y-2.5">
              {SELF_NOMINATION_ROLES.map((role) => {
                const isOn = selected.includes(role.key);
                return (
                  <label
                    key={role.key}
                    className="flex min-h-[64px] cursor-pointer items-start gap-3 rounded-xl px-3.5 py-3.5 transition-colors"
                    style={{
                      border: `1.5px solid ${isOn ? SAFFRON : inkA(0.1)}`,
                      background: isOn ? `${SAFFRON}0f` : "#ffffff",
                    }}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={isOn}
                      disabled={isPending}
                      onChange={() => toggle(role.key)}
                    />
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md transition-colors"
                      style={{
                        border: `1.5px solid ${isOn ? SAFFRON : inkA(0.2)}`,
                        background: isOn ? SAFFRON : "transparent",
                      }}
                    >
                      {isOn && <Check className="size-4 text-white" />}
                    </span>
                    <span className="min-w-0">
                      <span
                        className="block text-[15px] font-semibold leading-snug"
                        style={{ ...SERIF, color: INK }}
                      >
                        {role.label}
                      </span>
                      <span
                        className="mt-0.5 block text-xs leading-relaxed"
                        style={{ color: inkA(0.6) }}
                      >
                        {role.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {/* Live counter */}
            <p
              className="mt-3.5 text-center text-xs font-medium"
              aria-live="polite"
              style={{ color: selected.length === 0 ? inkA(0.5) : SAFFRON }}
            >
              {selected.length === 0
                ? "No roles selected yet"
                : `${selected.length} of 3 roles selected`}
            </p>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={selected.length === 0 || isPending}
              className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition-all active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: SAFFRON }}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  {hasSubmitted ? "Save Selection" : "Submit Nomination"}
                </>
              )}
            </button>

            <p
              className="mt-2.5 text-center text-[11px] leading-relaxed"
              style={{ color: inkA(0.45) }}
            >
              You can change your selection any time before Admin closes the
              session.
            </p>

            {hasSubmitted && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setSelected(submittedRoles);
                  setEditing(false);
                }}
                disabled={isPending}
                className="mt-2 min-h-[44px] w-full rounded-xl text-xs font-medium disabled:opacity-50"
                style={{ color: inkA(0.5) }}
              >
                Cancel
              </button>
            )}
          </div>
        </SectionShell>
      )}

      {/* ─── CLOSED ────────────────────────────────────────────── */}
      {!open && (
        <SectionShell accent={inkA(0.25)}>
          <div className="px-5 py-5">
            <div className="flex items-center gap-3">
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: inkA(0.06) }}
              >
                <Clock3 className="size-6" style={{ color: inkA(0.5) }} />
              </span>
              <h2
                className="text-[17px] font-semibold leading-snug"
                style={{ ...SERIF, color: INK }}
              >
                Self-Nomination Closed
              </h2>
            </div>
            <p
              className="mt-3 text-sm leading-relaxed"
              style={{ color: inkA(0.65) }}
            >
              Admin has closed the session. If you nominated, check your
              Party/Committee WhatsApp group for next steps. If you didn&apos;t,
              you&apos;ll remain a Regular MP.
            </p>
          </div>
        </SectionShell>
      )}
    </div>
  );
}
