import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import Link from "next/link";
import { Badge } from "@/components/yip/ui/badge";
import {
  ArrowLeft,
  Trophy,
  Calendar,
  MapPin,
  CheckCircle2,
  Sparkles,
  ChevronUp,
} from "lucide-react";
import {
  getPersonIdForParticipant,
  getPerson,
  getPersonJourney,
} from "@/app/yip/actions/people";
import { ROLE_LABELS } from "@/lib/yip/constants";
import {
  getEventSchoolNumbers,
  schoolNumberOf,
} from "@/lib/yip/school-numbers";
import { SectionShell, SectionHeading, INK, SAFFRON, GOLD, SERIF, inkA } from "../credential-ui";

interface ParticipantSession {
  type: "participant";
  id: string;
  name: string;
  eventId: string;
}

function parseSession(raw: string | undefined): ParticipantSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.type === "participant" && parsed.id) return parsed as ParticipantSession;
  } catch {}
  return null;
}

export default async function JourneyPage() {
  const session = await getYipSession();
  if (!session || session.type !== "participant") redirect("/yip/join");

  const personId = await getPersonIdForParticipant(session.id);
  if (!personId) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          href="/yip/me"
          className="inline-flex items-center gap-1 text-xs text-[#1a1a3e]/60 hover:text-[#1a1a3e] mb-4"
        >
          <ArrowLeft className="size-3" /> Back
        </Link>
        <SectionShell accent={SAFFRON}>
          <div className="py-12 px-5 text-center">
            <p className="text-sm" style={{ color: inkA(0.6) }}>
              Your profile is not yet linked to a person record. Check back after
              your organizer completes setup.
            </p>
          </div>
        </SectionShell>
      </div>
    );
  }

  const [person, journey] = await Promise.all([
    getPerson(personId),
    getPersonJourney(personId),
  ]);

  if (!person) redirect("/yip/me");

  // Participants see their school as an anonymised per-event NUMBER, never the
  // name (director decision 2026-06-27), consistent with /yip/me and the ballot.
  const schoolNumbers = await getEventSchoolNumbers(session.eventId);
  const schoolNum = schoolNumberOf(schoolNumbers, person.school_name);

  // Participants must NEVER see their raw scores (Director ruling — raw scores
  // invite comparison & disputes between students). Rank + awards stay; strip
  // avg_score here so it is never rendered AND never serialized to the browser.
  // The admin people page calls getPersonJourney separately and keeps scores.
  for (const step of journey) step.avg_score = null;

  const totalEvents = journey.length;
  const levelsReached = new Set(journey.map((j) => j.event_level));
  const awardsList = journey
    .filter((j) => j.awards)
    .flatMap((j) => (j.awards ?? "").split(",").map((a) => a.trim()).filter(Boolean));
  const uniqueAwards = Array.from(new Set(awardsList));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-24 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/yip/me"
          className="inline-flex items-center gap-1 text-xs text-[#1a1a3e]/60 hover:text-[#1a1a3e] mb-2"
        >
          <ArrowLeft className="size-3" /> Back to My Dashboard
        </Link>
        <p
          className="text-[10px] font-bold uppercase tracking-[0.16em]"
          style={{ color: SAFFRON }}
        >
          The Record
        </p>
        <h1
          className="mt-0.5 text-[28px] font-bold leading-[1.1] tracking-tight"
          style={{ ...SERIF, color: INK }}
        >
          Your YIP Journey
        </h1>
        <p className="text-sm mt-1.5" style={{ color: inkA(0.6) }}>
          Every chapter, regional, and national round you've been part of.
        </p>
      </div>

      {/* Summary */}
      <SectionShell
        accent={`linear-gradient(to right, #FF9933 0 33.33%, ${GOLD} 33.33% 66.66%, #138808 66.66% 100%)`}
      >
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-4">
            {person.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={person.photo_url}
                alt={person.full_name}
                className="size-14 rounded-full object-cover"
              />
            ) : (
              <div className="size-14 rounded-full bg-gradient-to-br from-[#FF9933] to-[#E68A2E] flex items-center justify-center text-white font-bold text-xl">
                {person.full_name
                  .split(" ")
                  .slice(0, 2)
                  .map((s) => s[0]?.toUpperCase() ?? "")
                  .join("")}
              </div>
            )}
            <div>
              <div
                className="text-xl font-bold"
                style={{ ...SERIF, color: INK }}
              >
                {person.full_name}
              </div>
              {person.school_name && (
                <div className="text-sm" style={{ color: inkA(0.6) }}>
                  {schoolNum != null ? `School #${schoolNum}` : "School #—"}
                  {person.home_state ? ` · ${person.home_state}` : ""}
                </div>
              )}
            </div>
          </div>
          <div
            className="grid grid-cols-3 gap-3 pt-3"
            style={{ borderTop: `1px solid ${inkA(0.06)}` }}
          >
            <Stat value={totalEvents} label="Rounds" />
            <Stat value={levelsReached.size} label="Levels" />
            <Stat value={uniqueAwards.length} label="Awards" />
          </div>
        </div>
      </SectionShell>

      {/* Awards aggregate */}
      {uniqueAwards.length > 0 && (
        <SectionShell accent={GOLD}>
          <div className="px-5 py-4">
            <SectionHeading
              eyebrow="Honours"
              title="Career Awards"
              icon={Trophy}
              accent={GOLD}
            />
            <div className="flex flex-wrap gap-2 mt-3.5">
              {uniqueAwards.map((a) => (
                <Badge
                  key={a}
                  className="bg-amber-50 text-amber-800 border-amber-200 text-xs"
                >
                  <Sparkles className="size-3 mr-1" />
                  {a}
                </Badge>
              ))}
            </div>
          </div>
        </SectionShell>
      )}

      {/* Journey timeline */}
      <div className="space-y-3">
        <h2
          className="text-[18px] font-semibold"
          style={{ ...SERIF, color: INK }}
        >
          Timeline
        </h2>
        {journey.length === 0 ? (
          <SectionShell>
            <div
              className="py-12 px-5 text-center text-sm"
              style={{ color: inkA(0.6) }}
            >
              No events yet.
            </div>
          </SectionShell>
        ) : (
          journey.map((step, idx) => (
            <JourneyCard key={step.participant_id} step={step} isFirst={idx === 0} />
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <div
        className="text-2xl font-bold tabular-nums"
        style={{ ...SERIF, color: INK }}
      >
        {value}
      </div>
      <div
        className="text-[10px] uppercase tracking-widest"
        style={{ color: inkA(0.5) }}
      >
        {label}
      </div>
    </div>
  );
}

function JourneyCard({
  step,
  isFirst,
}: {
  step: Awaited<ReturnType<typeof getPersonJourney>>[number];
  isFirst: boolean;
}) {
  const levelColor: Record<string, string> = {
    chapter: "bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20",
    regional: "bg-blue-50 text-blue-700 border-blue-200",
    national: "bg-[#138808]/10 text-[#138808] border-[#138808]/20",
  };
  const levelAccent: Record<string, string> = {
    chapter: SAFFRON,
    regional: "#2563eb",
    national: "#138808",
  };

  const awardList = step.awards
    ? step.awards.split(",").map((a) => a.trim()).filter(Boolean)
    : [];

  return (
    <SectionShell
      accent={levelAccent[step.event_level] ?? inkA(0.2)}
      className={isFirst ? "shadow-sm" : ""}
    >
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={`${levelColor[step.event_level] ?? "bg-gray-50 border-gray-200"} text-[10px] border uppercase`}
              >
                {step.event_level}
              </Badge>
              {step.event_year && (
                <span className="text-xs font-mono text-[#1a1a3e]/40">
                  {step.event_year}
                </span>
              )}
              {step.qualified_for_next && (
                <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20 text-[9px]">
                  <ChevronUp className="size-2.5 mr-0.5" />
                  Promoted
                </Badge>
              )}
            </div>
            <div
              className="text-base font-semibold mt-1"
              style={{ ...SERIF, color: INK }}
            >
              {step.event_name}
            </div>
            {step.day1_date && (
              <div className="text-xs text-[#1a1a3e]/50 flex items-center gap-1 mt-0.5">
                <Calendar className="size-3" />
                {new Date(step.day1_date).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
                {step.event_zone && (
                  <>
                    <MapPin className="size-3 ml-2" />
                    {step.event_zone}
                  </>
                )}
              </div>
            )}
          </div>
          {step.rank && (
            <div className="text-right shrink-0">
              <div
                className="text-2xl font-bold tabular-nums"
                style={{ ...SERIF, color: INK }}
              >
                #{step.rank}
              </div>
              {/* Raw avg score intentionally NOT shown to participants. */}
            </div>
          )}
        </div>

        {/* Identity badges */}
        {(step.parliament_role || step.party_side || step.serial_no) && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[#1a1a3e]/5">
            {step.serial_no !== null && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                S.No {step.serial_no}
              </Badge>
            )}
            {step.parliament_role && (
              <Badge variant="secondary" className="text-[10px]">
                {ROLE_LABELS[step.parliament_role] ?? step.parliament_role}
              </Badge>
            )}
            {step.party_number !== null && (
              <Badge
                className={`text-[10px] border ${
                  step.party_side === "ruling"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : step.party_side === "opposition"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-[#FF9933]/15 text-[#9a5212] border-[#FF9933]/30"
                }`}
              >
                Party {String.fromCharCode(64 + step.party_number)}
                {step.party_side ? ` · ${step.party_side}` : ""}
              </Badge>
            )}
            {step.party_number === null && step.party_side && (
              <Badge
                className={`text-[10px] border ${
                  step.party_side === "ruling"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}
              >
                {step.party_side}
              </Badge>
            )}
            {step.constituency_name && (
              <Badge variant="secondary" className="text-[10px]">
                {step.constituency_name}
              </Badge>
            )}
            {step.committee_number !== null && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                Committee {step.committee_number}
              </Badge>
            )}
          </div>
        )}

        {/* Awards at this round */}
        {awardList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {awardList.map((a, i) => (
              <Badge
                key={i}
                className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]"
              >
                <Sparkles className="size-2.5 mr-0.5" />
                {a}
              </Badge>
            ))}
          </div>
        )}

        {/* Results status */}
        {step.results_published_at && !step.rank && (
          <div className="text-xs text-[#1a1a3e]/50 flex items-center gap-1">
            <CheckCircle2 className="size-3" />
            Results published — no ranked placement
          </div>
        )}
      </div>
    </SectionShell>
  );
}
