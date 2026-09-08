"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  listTeamsForCodes,
  listTeamRecipients,
  fixEmailAndResend,
  resendTeamCodes,
  type TeamRecipients,
  type TeamCodeSummary,
} from "../../actions/email-codes";

const PAPER = "#f7f4ed";
const SAFFRON = "#e8a33d";
const DIM = "#9fb0d4";
const RULE = "rgba(247,244,237,0.14)";
const WARN = "#e8a33d";

/**
 * "The codes never arrived."
 *
 * The organiser finds the team BY SCHOOL NAME, sees exactly where its access
 * codes are going, corrects a wrong address, and sends again. Director ruling
 * 2026-08-27, chosen over a bare resend button — resending to the same wrong
 * address fixes nothing, and a wrong address is the most likely cause.
 *
 * The list loads on demand rather than with the page: an organiser opens this
 * dashboard many times a day and needs this panel rarely, so a chapter's worth
 * of teams is not worth fetching every time.
 *
 * NO ACCESS CODE IS EVER DISPLAYED. Only addresses. Putting a school's codes
 * on an organiser's screen is exactly what emailing them was meant to avoid,
 * and that option was explicitly rejected.
 */
export function CodesPanel({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [teams, setTeams] = useState<TeamCodeSummary[] | null>(null);
  const [filter, setFilter] = useState("");
  const [data, setData] = useState<TeamRecipients | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();

  const loadTeams = () => {
    start(async () => {
      const res = await listTeamsForCodes(eventId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setTeams(res.teams);
      if (res.teams.length === 0) {
        toast.error("No teams have registered for this chapter yet.");
      }
    });
  };

  const openTeam = (id: string) => {
    start(async () => {
      const res = await listTeamRecipients(id);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      setData(res.recipients);
      setEditing(null);
      setDraft("");
    });
  };

  const save = (kind: "teacher" | "student", studentId?: string) => {
    if (!data) return;
    start(async () => {
      const res = await fixEmailAndResend({
        teamId: data.teamId,
        kind,
        studentId,
        email: draft,
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Saved. ${res.queued} email${res.queued === 1 ? "" : "s"} queued — they go out within five minutes.`
      );
      setEditing(null);
      setDraft("");
      openTeam(data.teamId);
      router.refresh();
    });
  };

  const resendAll = () => {
    if (!data) return;
    start(async () => {
      const res = await resendTeamCodes(data.teamId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `${res.queued} email${res.queued === 1 ? "" : "s"} queued — they go out within five minutes.`
      );
      router.refresh();
    });
  };

  const q = filter.trim().toLowerCase();
  const shown = (teams ?? []).filter(
    (t) =>
      q === "" ||
      t.teamName.toLowerCase().includes(q) ||
      (t.schoolName ?? "").toLowerCase().includes(q)
  );

  const row = (
    key: string,
    label: string,
    email: string | null,
    kind: "teacher" | "student",
    studentId?: string
  ) => {
    const open = editing === key;
    return (
      <li key={key} className="border-t py-3" style={{ borderColor: RULE }}>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[0.9375rem]" style={{ color: PAPER }}>
            {label}
          </span>
          <span className="text-[0.875rem]" style={{ color: email ? DIM : WARN }}>
            {email || "no address on file — nothing can be sent"}
          </span>
          <button
            type="button"
            onClick={() => {
              setEditing(open ? null : key);
              setDraft(email ?? "");
            }}
            disabled={pending}
            className="ml-auto text-[0.8125rem] underline disabled:opacity-40"
            style={{ color: SAFFRON }}
          >
            {open ? "Cancel" : email ? "Correct this address" : "Add an address"}
          </button>
        </div>

        {open ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="correct@school.edu.in"
              className="min-w-0 flex-1 rounded-lg px-3 py-2 text-[0.9375rem]"
              style={{
                background: "rgba(247,244,237,0.06)",
                color: PAPER,
                border: `1px solid ${RULE}`,
              }}
            />
            <button
              type="button"
              onClick={() => save(kind, studentId)}
              disabled={pending}
              className="rounded-full px-4 py-2 text-[0.875rem] font-medium disabled:opacity-40"
              style={{ background: SAFFRON, color: "#0a1633" }}
            >
              {pending ? "Saving…" : "Save and send"}
            </button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section className="mt-10 rounded-2xl border p-6" style={{ borderColor: RULE }}>
      <h2 className="yiq-display text-[1.5rem]">
        &ldquo;The codes never arrived&rdquo;
      </h2>
      <p className="mt-2 max-w-[44rem] text-[0.9375rem]" style={{ color: DIM }}>
        Find a team to see exactly where its access codes are being sent. If an
        address is wrong, correct it here and the codes go out again. You cannot
        see anybody&apos;s code from this screen — only the addresses.
      </p>

      {teams === null ? (
        <button
          type="button"
          onClick={loadTeams}
          disabled={pending}
          className="mt-4 rounded-full px-4 py-2 text-[0.875rem] font-medium disabled:opacity-40"
          style={{ background: SAFFRON, color: "#0a1633" }}
        >
          {pending ? "Loading…" : "Find a team"}
        </button>
      ) : (
        <>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Type a school or team name"
            className="mt-4 w-full rounded-lg px-3 py-2 text-[0.9375rem]"
            style={{
              background: "rgba(247,244,237,0.06)",
              color: PAPER,
              border: `1px solid ${RULE}`,
            }}
          />

          <ul className="mt-3 max-h-72 overflow-y-auto">
            {shown.map((t) => {
              const broken = t.teacherEmailMissing || t.missingStudentEmails > 0;
              return (
                <li key={t.teamId} className="border-t" style={{ borderColor: RULE }}>
                  <button
                    type="button"
                    onClick={() => openTeam(t.teamId)}
                    disabled={pending}
                    className="w-full py-2.5 text-left disabled:opacity-40"
                  >
                    <span className="text-[0.9375rem]" style={{ color: PAPER }}>
                      {t.schoolName ?? t.teamName}
                    </span>
                    <span className="ml-2 text-[0.8125rem]" style={{ color: DIM }}>
                      {t.teamName} · {t.category ?? "?"} · {t.studentCount} student
                      {t.studentCount === 1 ? "" : "s"}
                    </span>
                    {broken ? (
                      <span className="ml-2 text-[0.8125rem]" style={{ color: WARN }}>
                        ·{" "}
                        {t.teacherEmailMissing
                          ? "no teacher address"
                          : `${t.missingStudentEmails} student address${
                              t.missingStudentEmails === 1 ? "" : "es"
                            } missing`}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {shown.length === 0 ? (
              <li className="py-3 text-[0.875rem]" style={{ color: DIM }}>
                No team matches that.
              </li>
            ) : null}
          </ul>
        </>
      )}

      {data ? (
        <div className="mt-6 border-t pt-5" style={{ borderColor: RULE }}>
          <p className="text-[0.9375rem]" style={{ color: PAPER }}>
            {data.teamName}
            {data.schoolName ? (
              <span style={{ color: DIM }}> · {data.schoolName}</span>
            ) : null}
          </p>

          <ul className="mt-3">
            {row("teacher", "Teacher (gets every code)", data.teacherEmail, "teacher")}
            {data.students.map((s) =>
              row(`s:${s.id}`, s.name, s.email, "student", s.id)
            )}
          </ul>

          <button
            type="button"
            onClick={resendAll}
            disabled={pending}
            className="mt-4 rounded-full border px-4 py-2 text-[0.875rem] disabled:opacity-40"
            style={{ borderColor: RULE, color: PAPER }}
          >
            {pending ? "Sending…" : "Send again without changing anything"}
          </button>
          <p className="mt-2 text-[0.8125rem]" style={{ color: DIM }}>
            Use this when the address is right but the email was lost or went to
            spam.
          </p>
        </div>
      ) : null}
    </section>
  );
}
