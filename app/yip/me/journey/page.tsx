import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/yip/ui/badge";
import { Card, CardContent } from "@/components/yip/ui/card";
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
} from "@/app/actions/yip/people";
import { ROLE_LABELS } from "@/lib/yip/constants";

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
  const cookieStore = await cookies();
  const raw = cookieStore.get("yip_session")?.value;
  const session = parseSession(raw);
  if (!session) redirect("/yip/join");

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
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-[#1a1a3e]/60">
              Your profile is not yet linked to a person record. Check back after
              your organizer completes setup.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [person, journey] = await Promise.all([
    getPerson(personId),
    getPersonJourney(personId),
  ]);

  if (!person) redirect("/yip/me");

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
        <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight">
          Your YIP Journey
        </h1>
        <p className="text-sm text-[#1a1a3e]/60 mt-1">
          Every chapter, regional, and national round you've been part of.
        </p>
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-br from-[#FF9933]/5 via-white to-[#138808]/5 border-[#FF9933]/20">
        <CardContent className="pt-5">
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
              <div className="text-xl font-bold text-[#1a1a3e]">
                {person.full_name}
              </div>
              {person.school_name && (
                <div className="text-sm text-[#1a1a3e]/60">
                  {person.school_name}
                  {person.home_state ? ` · ${person.home_state}` : ""}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#1a1a3e]/5">
            <Stat value={totalEvents} label="Rounds" />
            <Stat value={levelsReached.size} label="Levels" />
            <Stat value={uniqueAwards.length} label="Awards" />
          </div>
        </CardContent>
      </Card>

      {/* Awards aggregate */}
      {uniqueAwards.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="size-4 text-amber-500" />
              <span className="text-sm font-semibold text-[#1a1a3e]">
                Career Awards
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
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
          </CardContent>
        </Card>
      )}

      {/* Journey timeline */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[#1a1a3e]">Timeline</h2>
        {journey.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-[#1a1a3e]/60">
              No events yet.
            </CardContent>
          </Card>
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
      <div className="text-2xl font-bold text-[#1a1a3e] tabular-nums">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-[#1a1a3e]/50">
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

  const awardList = step.awards
    ? step.awards.split(",").map((a) => a.trim()).filter(Boolean)
    : [];

  return (
    <Card className={isFirst ? "border-[#FF9933]/30 shadow-sm" : ""}>
      <CardContent className="pt-4 pb-4 space-y-3">
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
            <div className="text-base font-semibold text-[#1a1a3e] mt-1">
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
              <div className="text-2xl font-bold text-[#1a1a3e] tabular-nums">
                #{step.rank}
              </div>
              {step.avg_score !== null && (
                <div className="text-[11px] text-[#1a1a3e]/60 tabular-nums">
                  {step.avg_score}
                </div>
              )}
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
            {step.party_side && (
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
            {step.party_number !== null && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                Party #{step.party_number}
              </Badge>
            )}
            {step.constituency_name && (
              <Badge variant="secondary" className="text-[10px]">
                {step.constituency_name}
              </Badge>
            )}
            {step.committee_number !== null && (
              <Badge variant="secondary" className="text-[10px] font-mono">
                Com #{step.committee_number}
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
      </CardContent>
    </Card>
  );
}
