"use client";

/**
 * YIQ event admin — the qualifying line and team discipline, on one panel.
 *
 * Two things a chapter organiser can do here:
 *   1. Set how many teams per category qualify for the chapter final —
 *      but ONLY until the online round opens. After that the editor is
 *      visibly locked and says who to ask. A YIQ national admin sees the same
 *      panel with the editor open at every stage.
 *   2. Disqualify a team, with a written reason, and undo it.
 *
 * The panel fetches its own state through a gated server action, so wiring it
 * into the page is one line:  <EventAdminPanel eventId={eventId} />
 * `initialQualifyingCount` is optional and only softens the loading flash.
 *
 * Built for 390px first: nothing here is a table, every control stacks, and
 * every touch target stays finger-sized on a phone.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  disqualifyTeam,
  getEventAdminState,
  reinstateTeam,
  setQualifyingCount,
} from "@/app/yiq/actions/event-admin";
import {
  DISQUALIFY_REASON_MIN,
  QUALIFYING_COUNT_MAX,
  QUALIFYING_COUNT_MIN,
  type EventAdminState,
  type EventAdminTeam,
} from "@/lib/yiq/event-admin";

const INK = "#0a1633";
const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const GREEN = "#14795a";
const VERMILION = "#c8452f";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";

const STATUS_TINT: Record<string, string> = {
  disqualified: VERMILION,
  withdrawn: DIM,
  qualified: GREEN,
  champion: SAFFRON,
  runner_up: SAFFRON,
};

const TEAM_STATUS_LABELS: Record<string, string> = {
  registered: "Registered",
  confirmed: "Confirmed",
  withdrawn: "Withdrawn",
  disqualified: "Disqualified",
  qualified: "Qualified",
  eliminated: "Eliminated",
  runner_up: "Runner-up",
  champion: "Champion",
};

function teamStatusLabel(s: string): string {
  return TEAM_STATUS_LABELS[s] ?? s;
}

function whenText(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function EventAdminPanel({
  eventId,
  initialQualifyingCount,
}: {
  eventId: string;
  initialQualifyingCount?: number;
}) {
  const router = useRouter();
  const [state, setState] = useState<EventAdminState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();

  const [countDraft, setCountDraft] = useState<string>(
    initialQualifyingCount ? String(initialQualifyingCount) : ""
  );

  /** teamId currently open for disqualification, and the typed reason. */
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [mode, setMode] = useState<"disqualify" | "reinstate">("disqualify");
  const [reason, setReason] = useState("");

  const apply = useCallback(
    (res: Awaited<ReturnType<typeof getEventAdminState>>) => {
      if (!res.success) {
        setLoadError(res.error);
        setState(null);
      } else {
        setLoadError(null);
        setState(res.state);
        setCountDraft(String(res.state.qualifyingCount));
      }
      setLoading(false);
    },
    []
  );

  const load = useCallback(
    () => getEventAdminState({ chapterEventId: eventId }).then(apply),
    [eventId, apply]
  );

  // Subscribe-then-callback rather than a synchronous setState in the effect
  // body; `alive` drops a response that lands after the panel unmounts.
  useEffect(() => {
    let alive = true;
    getEventAdminState({ chapterEventId: eventId }).then((res) => {
      if (alive) apply(res);
    });
    return () => {
      alive = false;
    };
  }, [eventId, apply]);

  function closeForm() {
    setOpenTeamId(null);
    setReason("");
  }

  function saveCount() {
    const n = Number(countDraft);
    start(async () => {
      const res = await setQualifyingCount({
        chapterEventId: eventId,
        count: n,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.count} teams per category now qualify`);
      await load();
      router.refresh();
    });
  }

  function submitTeamAction() {
    if (!openTeamId) return;
    const teamId = openTeamId;
    start(async () => {
      const res =
        mode === "disqualify"
          ? await disqualifyTeam({ chapterEventId: eventId, teamId, reason })
          : await reinstateTeam({ chapterEventId: eventId, teamId, reason });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        mode === "disqualify" ? "Team disqualified" : "Team reinstated"
      );
      closeForm();
      await load();
      router.refresh();
    });
  }

  if (loading) {
    return (
      <section
        className="mt-9 rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: RULE }}
      >
        <p className="text-[0.9375rem]" style={{ color: DIM }}>
          Loading the event admin panel…
        </p>
      </section>
    );
  }

  if (loadError || !state) {
    return (
      <section
        className="mt-9 rounded-2xl border p-5 sm:p-6"
        style={{ borderColor: `${VERMILION}66` }}
      >
        <p className="yiq-eyebrow" style={{ color: VERMILION }}>
          Event admin
        </p>
        <p className="mt-2 text-[0.9375rem]" style={{ color: PAPER }}>
          {loadError ?? "This panel could not be loaded."}
        </p>
      </section>
    );
  }

  const locked = !state.lock.allowed;
  const dirty = countDraft.trim() !== String(state.qualifyingCount);

  return (
    <section
      className="mt-9 rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: RULE }}
    >
      <p className="yiq-eyebrow" style={{ color: DIM }}>
        Event admin
      </p>
      <h2 className="yiq-display mt-1 text-[1.5rem]">The qualifying line</h2>

      {/* ---------------- qualifying count ---------------- */}
      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
        <span
          className="yiq-data text-[2.75rem] leading-none"
          style={{ color: SAFFRON }}
        >
          {state.qualifyingCount}
        </span>
        <span className="pb-1 text-[0.9375rem]" style={{ color: DIM }}>
          teams qualify per category · {state.statusLabel}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex items-center gap-3">
          <span className="sr-only">Teams that qualify per category</span>
          <input
            type="number"
            inputMode="numeric"
            min={QUALIFYING_COUNT_MIN}
            max={QUALIFYING_COUNT_MAX}
            step={1}
            value={countDraft}
            disabled={locked || pending}
            onChange={(e) => setCountDraft(e.target.value)}
            aria-describedby="yiq-qualifying-note"
            className="yiq-data w-28 rounded-xl border px-4 py-3 text-[1.125rem] disabled:opacity-45"
            style={{
              borderColor: RULE,
              background: "rgba(247,244,237,0.06)",
              color: PAPER,
            }}
          />
        </label>

        <button
          type="button"
          onClick={saveCount}
          disabled={locked || pending || !dirty}
          className="rounded-full px-5 py-3 text-[0.875rem] font-bold disabled:opacity-45"
          style={{ background: SAFFRON, color: INK }}
        >
          {pending ? "Working…" : "Save qualifying count"}
        </button>
      </div>

      <p
        id="yiq-qualifying-note"
        className="mt-3 text-[0.875rem]"
        style={{ color: locked ? VERMILION : DIM }}
      >
        {locked ? `Locked — ${state.lock.message}` : state.lock.message}
        {!locked
          ? ` Between ${QUALIFYING_COUNT_MIN} and ${QUALIFYING_COUNT_MAX}.`
          : ""}
      </p>

      {state.isNational ? (
        <p className="mt-1 text-[0.8125rem]" style={{ color: SAFFRON }}>
          National override — every change here is written to the audit log.
        </p>
      ) : null}

      {/* ---------------- teams ---------------- */}
      <h3 className="yiq-display mt-8 text-[1.25rem]">Teams</h3>
      <p className="mt-1 text-[0.875rem]" style={{ color: DIM }}>
        Disqualifying a team removes it from the standings. Nothing its
        students answered is deleted, and the reason is recorded against the
        team.
      </p>

      {state.teams.length === 0 ? (
        <p className="mt-4 text-[0.9375rem]" style={{ color: DIM }}>
          No teams have registered yet.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {state.teams.map((t) => (
            <TeamRow
              key={t.id}
              team={t}
              open={openTeamId === t.id}
              mode={mode}
              reason={reason}
              pending={pending}
              onOpen={(m) => {
                setOpenTeamId(t.id);
                setMode(m);
                setReason("");
              }}
              onCancel={closeForm}
              onReason={setReason}
              onSubmit={submitTeamAction}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TeamRow({
  team,
  open,
  mode,
  reason,
  pending,
  onOpen,
  onCancel,
  onReason,
  onSubmit,
}: {
  team: EventAdminTeam;
  open: boolean;
  mode: "disqualify" | "reinstate";
  reason: string;
  pending: boolean;
  onOpen: (mode: "disqualify" | "reinstate") => void;
  onCancel: () => void;
  onReason: (v: string) => void;
  onSubmit: () => void;
}) {
  const out = team.status === "disqualified";
  const tint = STATUS_TINT[team.status] ?? DIM;

  return (
    <li
      className="rounded-xl border p-4"
      style={{
        borderColor: out ? `${VERMILION}55` : RULE,
        background: out ? "rgba(200,69,47,0.10)" : "transparent",
      }}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[1rem] font-semibold" style={{ color: PAPER }}>
            {team.name}
          </p>
          <p className="mt-1 text-[0.8125rem]" style={{ color: DIM }}>
            <span className="yiq-data">{team.teamCode}</span>
            {" · "}
            {team.category === "senior" ? "Senior" : "Junior"}
            {team.schoolName ? ` · ${team.schoolName}` : ""}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[0.8125rem]">
            <span
              className="yiq-eyebrow rounded-full px-2 py-1"
              style={{ background: `${tint}22`, color: tint }}
            >
              {teamStatusLabel(team.status)}
            </span>
            {team.onlineRank !== null ? (
              <span className="yiq-data" style={{ color: DIM }}>
                rank {team.onlineRank}
                {team.onlineTotalScore !== null
                  ? ` · ${team.onlineTotalScore} pts`
                  : ""}
              </span>
            ) : null}
          </p>
        </div>

        {!open ? (
          <button
            type="button"
            onClick={() => onOpen(out ? "reinstate" : "disqualify")}
            disabled={pending}
            className="w-full shrink-0 rounded-full border px-4 py-2.5 text-[0.8125rem] font-semibold disabled:opacity-45 sm:w-auto"
            style={{
              borderColor: out ? `${GREEN}` : `${VERMILION}88`,
              color: out ? PAPER : VERMILION,
              background: out ? GREEN : "transparent",
            }}
          >
            {out ? "Undo disqualification" : "Disqualify"}
          </button>
        ) : null}
      </div>

      {out && team.disqualifiedReason ? (
        <p className="mt-3 text-[0.875rem]" style={{ color: PAPER }}>
          <span className="yiq-eyebrow" style={{ color: VERMILION }}>
            Reason
          </span>
          <br />
          {team.disqualifiedReason}
          {team.disqualifiedAt ? (
            <span style={{ color: DIM }}> — {whenText(team.disqualifiedAt)}</span>
          ) : null}
        </p>
      ) : null}

      {open ? (
        <div
          className="mt-4 rounded-xl p-4"
          style={{
            background:
              mode === "disqualify"
                ? "rgba(200,69,47,0.12)"
                : "rgba(20,121,90,0.14)",
            border: `1px solid ${mode === "disqualify" ? `${VERMILION}55` : `${GREEN}66`}`,
          }}
        >
          <p className="text-[0.9375rem] font-semibold" style={{ color: PAPER }}>
            {mode === "disqualify"
              ? `Disqualify ${team.name}? They leave the standings straight away.`
              : `Put ${team.name} back into the competition?`}
          </p>

          <label className="mt-3 block">
            <span className="yiq-eyebrow" style={{ color: DIM }}>
              Reason (required)
            </span>
            <textarea
              value={reason}
              onChange={(e) => onReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder={
                mode === "disqualify"
                  ? "e.g. Two students used a second device during the round."
                  : "e.g. Disqualified the wrong team — the code was mistyped."
              }
              className="mt-1 w-full rounded-lg border px-3 py-2 text-[0.9375rem]"
              style={{
                borderColor: RULE,
                background: "rgba(247,244,237,0.06)",
                color: PAPER,
              }}
            />
          </label>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onSubmit}
              disabled={pending || reason.trim().length < DISQUALIFY_REASON_MIN}
              className="rounded-full px-4 py-2.5 text-[0.8125rem] font-bold disabled:opacity-45"
              style={{
                background: mode === "disqualify" ? VERMILION : GREEN,
                color: PAPER,
              }}
            >
              {pending
                ? "Working…"
                : mode === "disqualify"
                  ? "Yes, disqualify"
                  : "Yes, reinstate"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-full border px-4 py-2.5 text-[0.8125rem] font-semibold disabled:opacity-45"
              style={{ borderColor: RULE, color: PAPER }}
            >
              Cancel
            </button>
          </div>

          <p className="mt-2 text-[0.75rem]" style={{ color: DIM }}>
            Recorded with your name and the time. At least{" "}
            {DISQUALIFY_REASON_MIN} characters.
          </p>
        </div>
      ) : null}
    </li>
  );
}
