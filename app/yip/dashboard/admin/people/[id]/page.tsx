import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerson, getPersonJourney } from "@/app/yip/actions/people";
import { Badge } from "@/components/yip/ui/badge";
import { Card, CardContent } from "@/components/yip/ui/card";
import { ArrowLeft, Trophy, Sparkles, ChevronUp } from "lucide-react";
import { ROLE_LABELS } from "@/lib/yip/constants";

export default async function AdminPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [person, journey] = await Promise.all([
    getPerson(id),
    getPersonJourney(id),
  ]);

  if (!person) notFound();

  const totalRounds = journey.length;
  const awardsList = journey
    .filter((j) => j.awards)
    .flatMap((j) => (j.awards ?? "").split(",").map((a) => a.trim()).filter(Boolean));
  const uniqueAwards = Array.from(new Set(awardsList));

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8 space-y-6">
      <Link
        href="/yip/dashboard/admin/people"
        className="inline-flex items-center gap-1 text-xs text-[#1a1a3e]/60 hover:text-[#1a1a3e]"
      >
        <ArrowLeft className="size-3" /> People directory
      </Link>

      <div className="flex items-start gap-4">
        {person.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.photo_url}
            alt={person.full_name}
            className="size-20 rounded-full object-cover"
          />
        ) : (
          <div className="size-20 rounded-full bg-gradient-to-br from-[#FF9933] to-[#E68A2E] flex items-center justify-center text-white font-bold text-2xl">
            {person.full_name
              .split(" ")
              .slice(0, 2)
              .map((s) => s[0]?.toUpperCase() ?? "")
              .join("")}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-[#1a1a3e]">{person.full_name}</h1>
          <div className="text-sm text-[#1a1a3e]/60 mt-1">
            {person.class && <span>Class {person.class}{person.section ? ` · ${person.section}` : ""}</span>}
            {person.school_name && <span> · {person.school_name}</span>}
            {person.home_state && <span> · {person.home_state}</span>}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {person.phone && (
              <Badge variant="secondary" className="text-xs font-mono">
                {person.phone}
              </Badge>
            )}
            {person.email && (
              <Badge variant="secondary" className="text-xs">
                {person.email}
              </Badge>
            )}
            {!person.is_active && (
              <Badge className="bg-gray-100 text-gray-700 border-gray-200">Archived</Badge>
            )}
          </div>
          {person.bio && (
            <p className="text-sm text-[#1a1a3e]/70 mt-3 leading-relaxed">{person.bio}</p>
          )}
          {person.notes && (
            <p className="text-xs text-[#1a1a3e]/60 italic mt-2">
              Admin note: {person.notes}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-[#1a1a3e] tabular-nums">{totalRounds}</div>
            <div className="text-xs text-[#1a1a3e]/60">Rounds participated</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-[#1a1a3e] tabular-nums">{uniqueAwards.length}</div>
            <div className="text-xs text-[#1a1a3e]/60">Career awards</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="text-2xl font-bold text-[#1a1a3e] tabular-nums">
              {journey.filter((j) => j.qualified_for_next).length}
            </div>
            <div className="text-xs text-[#1a1a3e]/60">Promotions earned</div>
          </CardContent>
        </Card>
      </div>

      {uniqueAwards.length > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="size-4 text-amber-500" />
              <span className="text-sm font-semibold text-[#1a1a3e]">Awards</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {uniqueAwards.map((a) => (
                <Badge
                  key={a}
                  className="bg-amber-50 text-amber-800 border-amber-200 text-xs"
                >
                  <Sparkles className="size-3 mr-1" /> {a}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <h2 className="text-lg font-semibold text-[#1a1a3e]">Journey</h2>
      {journey.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[#1a1a3e]/60">
            This person has no participations yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {journey.map((step) => (
            <Card key={step.participant_id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={`text-[10px] border uppercase ${
                          step.event_level === "chapter"
                            ? "bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20"
                            : step.event_level === "regional"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-[#138808]/10 text-[#138808] border-[#138808]/20"
                        }`}
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
                          <ChevronUp className="size-2.5 mr-0.5" /> Promoted
                        </Badge>
                      )}
                    </div>
                    <Link
                      href={`/yip/dashboard/events/${step.event_id}`}
                      className="block text-base font-semibold text-[#1a1a3e] hover:text-[#FF9933] mt-1"
                    >
                      {step.event_name}
                    </Link>
                    <div className="flex flex-wrap gap-1.5 mt-2">
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
                      {step.serial_no !== null && (
                        <Badge variant="secondary" className="text-[10px] font-mono">
                          S.No {step.serial_no}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {step.rank && (
                    <div className="text-right shrink-0">
                      <div className="text-xl font-bold text-[#1a1a3e]">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
