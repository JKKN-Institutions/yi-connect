"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import { ROLE_LABELS, PARTY_COLORS } from "@/lib/yip/constants";
import { committeeLabel } from "@/lib/yip/committee-label";
import { formatFileSize } from "@/lib/yip/questionnaire";
import {
  ArrowLeft,
  GraduationCap,
  Phone,
  Mail,
  Users2,
  Landmark,
  MapPin,
  BadgeCheck,
  Layers,
  KeyRound,
  CircleUserRound,
  ClipboardList,
  FileText,
  Paperclip,
  Scroll,
  Loader2,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { ParticipantProfile } from "@/app/yip/actions/participant-profile";
import {
  getParticipantSubmissions,
  type ParticipantSubmissions,
} from "@/app/yip/actions/participant-submissions";
// Reused, not modified — the same signed-URL action the organiser's full
// questionnaire marking screen already uses to open a handed-in file.
import { getQuestionnaireFileUrl } from "@/app/yip/actions/questionnaire";

const LEVEL_LABEL: Record<string, string> = {
  chapter: "Chapter",
  regional: "Regional",
  national: "National",
};

function titleize(v: string | null | undefined): string {
  if (!v) return "—";
  return v
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function ParticipantProfileClient({
  eventId,
  eventName,
  profile,
  variant = "page",
}: {
  eventId: string;
  eventName: string;
  profile: ParticipantProfile;
  /**
   * "page"   — the standalone /participants/[participantId] route: centred,
   *            page padding, and a "Back to participants" link.
   * "dialog" — the same profile shown inside a popup. Drops the page wrapper
   *            and the Back link, because the dialog's own close button is the
   *            way out and a "Back to participants" link inside a popup opened
   *            FROM a table would navigate the page out from under it.
   * Deliberately the same component either way, so the popup can never drift
   * from the page it is meant to mirror.
   */
  variant?: "page" | "dialog";
}) {
  const inDialog = variant === "dialog";
  const { participant: p, contestant, crossLevel, canManage } = profile;
  const place = [p.city, p.home_state].filter(Boolean).join(", ");
  // Benchless (party_side null) still has a party letter — neutral saffron chip.
  const partyClass =
    p.party_side
      ? PARTY_COLORS[p.party_side as keyof typeof PARTY_COLORS]?.badge ??
        "bg-gray-100 text-gray-700"
      : p.party_number != null
        ? "bg-[#FF9933]/15 text-[#9a5212]"
        : "";

  // What this participant has actually handed in — questionnaire paper(s) +
  // files, and their Private Member's Bill if they have one. Fetched
  // separately from `profile` (rather than added to getParticipantProfile)
  // so the popup variant, which loads `profile` once on open, doesn't need
  // touching: this section owns its own load, same pattern the popup itself
  // already uses for `profile`.
  const [subs, setSubs] = useState<ParticipantSubmissions | null>(null);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    if (!p.id) return;
    setSubsLoading(true);
    setSubsError(null);
    setSubs(null);
    try {
      const res = await getParticipantSubmissions(eventId, p.id);
      if (res.success) setSubs(res.data);
      else setSubsError(res.error);
    } catch {
      setSubsError("Could not load submissions. Reload the page and try again.");
    } finally {
      setSubsLoading(false);
    }
  }, [eventId, p.id]);

  useEffect(() => {
    if (p.id) void loadSubmissions();
  }, [p.id, loadSubmissions]);

  function openHandedInFile(attemptId: string, path: string) {
    // Same fix as #999 (commit 93d26d66), copied exactly — do not "simplify"
    // this. NO noopener/noreferrer: window.open() returns NULL whenever
    // either is passed, which silently defeats opening the tab early — the
    // handle is null, so the blank tab never gets a URL, `tab?.close()` on
    // failure is a no-op that orphans it, and success falls through to
    // navigating THIS page away to the file instead.
    //
    // The tab must be opened synchronously on the click, before the await:
    // Safari treats a window.open after an async gap as a popup and swallows
    // it.
    const tab = window.open("", "_blank");
    // Sever the opener by hand instead, which is what "noopener" was for.
    if (tab) {
      try {
        tab.opener = null;
      } catch {
        // Some browsers make `opener` read-only. Not fatal.
      }
    }
    void (async () => {
      const res = await getQuestionnaireFileUrl(eventId, attemptId, path);
      if (!res.success) {
        tab?.close();
        toast.error(res.error);
        return;
      }
      if (tab) {
        tab.location.href = res.data.url;
      } else {
        toast.error(
          "Your browser blocked the new tab. Allow pop-ups for this site, then tap the file again.",
          { duration: 12000 }
        );
      }
    })();
  }

  return (
    <div
      className={
        inDialog
          ? "space-y-6"
          : "max-w-[1100px] mx-auto px-6 py-6 space-y-6"
      }
    >
      {/* Back — page only. */}
      {!inDialog && (
        <Link
          href={`/yip/dashboard/events/${eventId}/participants`}
          className="inline-flex items-center gap-1.5 text-sm text-[#1a1a3e]/60 hover:text-[#1a1a3e]"
        >
          <ArrowLeft className="size-4" />
          Back to participants
        </Link>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {contestant?.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={contestant.photo_url}
              alt={p.full_name}
              className="size-16 rounded-full object-cover border border-[#1a1a3e]/10"
            />
          ) : (
            <div className="size-16 rounded-full bg-gradient-to-br from-[#FF9933] to-[#E68A2E] flex items-center justify-center text-white text-xl font-bold shrink-0">
              {p.full_name
                .split(" ")
                .slice(0, 2)
                .map((s) => s[0])
                .join("")}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-[#1a1a3e] tracking-tight truncate">
              {p.constituency_number ? `#${p.constituency_number} · ` : ""}
              {p.full_name}
            </h1>
            <p className="text-sm text-[#1a1a3e]/60 mt-0.5">
              {eventName}
              {p.constituency_name ? ` · ${p.constituency_name}` : ""}
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex items-center gap-2">
          {p.checked_in ? (
            <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20">
              Checked in
            </Badge>
          ) : (
            <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]/50 border-[#1a1a3e]/10">
              Not checked in
            </Badge>
          )}
          {p.qualified_for_next && (
            <Badge className="bg-[#FF9933]/10 text-[#E68A2E] border-[#FF9933]/25">
              Qualified for next level
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <GraduationCap className="size-4 text-[#FF9933]" /> Identity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            {/* School + class are collected only to balance allocation and are
                never shown in the platform (purged after the one-time export). */}
            <Row label="Place" value={place || null} />
            {contestant?.bio && (
              <div className="pt-1">
                <div className="text-[11px] uppercase tracking-wider text-[#1a1a3e]/45">
                  Bio
                </div>
                <p className="text-[#1a1a3e]/80 mt-0.5">{contestant.bio}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <Phone className="size-4 text-[#FF9933]" /> Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row label="Phone" value={p.phone} icon={<Phone className="size-3.5" />} />
            <Row label="Email" value={p.email} icon={<Mail className="size-3.5" />} />
            <Row
              label="Parent phone"
              value={p.parent_phone}
              icon={<Users2 className="size-3.5" />}
            />
          </CardContent>
        </Card>

        {/* Parliament */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <Landmark className="size-4 text-[#FF9933]" /> Parliament
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#1a1a3e]/55">Party</span>
              {p.party_side || p.party_number != null ? (
                <Badge variant="secondary" className={partyClass}>
                  {p.party_number != null
                    ? `Party ${String.fromCharCode(64 + p.party_number)}`
                    : p.party_side === "ruling"
                      ? "Ruling"
                      : "Opposition"}
                  {p.party_side
                    ? ` · ${p.party_side === "ruling" ? "Ruling" : "Opposition"}`
                    : ""}
                </Badge>
              ) : (
                <span className="text-[#1a1a3e]/40">—</span>
              )}
            </div>
            <Row
              label="Role"
              value={
                p.parliament_role
                  ? ROLE_LABELS[p.parliament_role] ?? titleize(p.parliament_role)
                  : null
              }
            />
            <Row label="Ministry" value={p.ministry ? titleize(p.ministry) : null} />
            <Row
              label="Constituency"
              value={
                p.constituency_name
                  ? `${p.constituency_name}${
                      p.constituency_state ? ` · ${p.constituency_state}` : ""
                    }`
                  : null
              }
              icon={<MapPin className="size-3.5" />}
            />
            <Row
              label="Committee"
              value={
                (p as { committee_name?: string | null }).committee_name ??
                committeeLabel(
                  (p as { committee_number?: number | null }).committee_number
                )
              }
            />
          </CardContent>
        </Card>

        {/* Status & access */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <BadgeCheck className="size-4 text-[#FF9933]" /> Status & access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <Row
              label="Check-in"
              value={
                p.checked_in
                  ? p.checked_in_at
                    ? `In · ${new Date(p.checked_in_at).toLocaleString()}`
                    : "In"
                  : "Out"
              }
            />
            <div className="flex items-center justify-between">
              <span className="text-[#1a1a3e]/55 flex items-center gap-1.5">
                <KeyRound className="size-3.5" /> Access code
              </span>
              <code className="rounded bg-[#1a1a3e]/5 px-2 py-0.5 text-xs font-mono text-[#1a1a3e]">
                {p.access_code ?? "—"}
              </code>
            </div>
            {canManage && (
              <Link
                href={`/yip/dashboard/events/${eventId}/scoring/${p.id}`}
                className="inline-flex items-center gap-1.5 text-sm text-[#FF9933] hover:text-[#E68A2E] pt-1"
              >
                <ClipboardList className="size-4" /> View scoring detail
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Submissions — what this person actually handed in for this event. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
            <FileText className="size-4 text-[#FF9933]" /> Submissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subsLoading ? (
            <p className="flex items-center gap-2 text-sm text-[#1a1a3e]/50 py-2">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </p>
          ) : subsError ? (
            <p className="flex items-start gap-2 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {subsError}
            </p>
          ) : !subs ||
            (subs.papers.length === 0 && !subs.bill) ? (
            <p className="text-sm text-[#1a1a3e]/50 flex items-center gap-2">
              <CircleUserRound className="size-4 text-[#1a1a3e]/30" />
              Nothing handed in yet for this event.
            </p>
          ) : (
            <div className="space-y-4">
              {subs.papers.length > 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] uppercase tracking-wider text-[#1a1a3e]/45">
                    Selection Questionnaire
                  </p>
                  {subs.papers.map((paper) => (
                    <div
                      key={paper.attemptId}
                      className="rounded-xl border border-[#1a1a3e]/10 p-3 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-[#1a1a3e]">
                          {paper.contestLabel}
                        </span>
                        <span className="text-xs font-semibold">
                          {paper.scored ? (
                            paper.pct != null ? (
                              <span className="text-[#138808]">
                                {paper.pct}%
                                {paper.totalScore != null && paper.maxScore != null
                                  ? ` (${paper.totalScore}/${paper.maxScore})`
                                  : ""}
                              </span>
                            ) : (
                              <span
                                className="text-[#1a1a3e]/50"
                                title="Scores are visible to the chapter chair and national admins only."
                              >
                                Marked · score hidden
                              </span>
                            )
                          ) : (
                            <span
                              className={
                                paper.statusLabel === "Waiting for a person to read it"
                                  ? "text-[#b45309]"
                                  : "text-[#1a1a3e]/50"
                              }
                            >
                              {paper.statusLabel}
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="text-xs text-[#1a1a3e]/55">
                        {paper.submittedAt
                          ? `Handed in ${new Date(paper.submittedAt).toLocaleString()}`
                          : "Not handed in yet"}
                        {paper.drawn > 0 &&
                          ` · ${paper.answered} of ${paper.drawn} answered`}
                      </p>
                      {paper.answered > 0 && !paper.hasTypedText && (
                        <p className="text-xs text-[#1a1a3e]/55 italic">
                          Handed in as a file — nothing typed.
                        </p>
                      )}
                      {paper.files.length > 0 && (
                        <ul className="flex flex-wrap gap-2 pt-1">
                          {paper.files.map((f) => (
                            <li key={f.path}>
                              <button
                                type="button"
                                onClick={() => openHandedInFile(f.attemptId, f.path)}
                                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#1a1a3e]/10 px-2 py-1 text-xs text-[#FF9933] underline-offset-4 hover:underline"
                              >
                                <Paperclip className="size-3 shrink-0" />
                                <span className="truncate">{f.name}</span>
                                <span className="shrink-0 text-[11px] text-[#1a1a3e]/45">
                                  {formatFileSize(f.size)}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {subs.bill && (
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-wider text-[#1a1a3e]/45">
                    Private Member&apos;s Bill
                  </p>
                  <Link
                    href={`/yip/dashboard/events/${eventId}/bills`}
                    className="flex items-center gap-3 rounded-xl border border-[#1a1a3e]/10 p-3 hover:bg-[#1a1a3e]/[0.015] transition-colors"
                  >
                    <Scroll className="size-4 shrink-0 text-[#FF9933]" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[#1a1a3e] truncate">
                        {subs.bill.title}
                      </p>
                      <p className="text-xs text-[#1a1a3e]/55">
                        {subs.bill.statusLabel}
                      </p>
                    </div>
                    <ExternalLink className="size-3.5 shrink-0 text-[#1a1a3e]/40" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Across levels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
            <Layers className="size-4 text-[#FF9933]" /> Across levels
          </CardTitle>
        </CardHeader>
        <CardContent>
          {crossLevel.length === 0 ? (
            <p className="text-sm text-[#1a1a3e]/50 flex items-center gap-2">
              <CircleUserRound className="size-4 text-[#1a1a3e]/30" />
              {contestant
                ? "No other events linked to this student yet."
                : "This roster entry isn't linked to a cross-level profile yet."}
            </p>
          ) : (
            <div className="divide-y divide-[#1a1a3e]/5">
              {crossLevel.map((c) => (
                <Link
                  key={c.participant_id}
                  href={`/yip/dashboard/events/${c.event_id}/participants/${c.participant_id}`}
                  className="flex items-center gap-3 py-3 hover:bg-[#1a1a3e]/[0.015] -mx-2 px-2 rounded-md transition-colors"
                >
                  <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]/70 border border-[#1a1a3e]/10 text-[10px] shrink-0">
                    {c.level ? LEVEL_LABEL[c.level] ?? c.level : "Event"}
                  </Badge>
                  <span className="font-medium text-[#1a1a3e] truncate flex-1">
                    {c.event_name}
                  </span>
                  <span className="text-xs text-[#1a1a3e]/55">
                    {c.parliament_role
                      ? ROLE_LABELS[c.parliament_role] ?? titleize(c.parliament_role)
                      : "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#1a1a3e]/55 flex items-center gap-1.5 shrink-0">
        {icon}
        {label}
      </span>
      <span className="text-[#1a1a3e] text-right truncate">{value || "—"}</span>
    </div>
  );
}
