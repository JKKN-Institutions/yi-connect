import Link from "next/link";
import { getZoneSummary, listOrganizerProfiles } from "@/app/actions/yip/hierarchy";
import { Badge } from "@/components/yip/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { MapPin, Users, Trophy, ArrowUpRight, Globe, Crown } from "lucide-react";

export default async function ZonesNationalPage() {
  const [summary, national] = await Promise.all([
    getZoneSummary(),
    listOrganizerProfiles({ role: "national" }),
  ]);

  const totalEvents = summary.reduce((s, z) => s + z.events_count, 0);
  const totalParticipants = summary.reduce((s, z) => s + z.participants_count, 0);
  const totalResults = summary.reduce((s, z) => s + z.results_published_count, 0);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight">
            National Overview
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            YIP 2026 · 6 regions · Yi + CII · Thalir
          </p>
        </div>
      </div>

      {/* National team */}
      {national.length > 0 && (
        <Card className="bg-gradient-to-br from-[#FF9933]/5 via-white to-[#138808]/5 border-[#FF9933]/15">
          <CardHeader>
            <CardTitle className="text-sm text-[#1a1a3e]/70 flex items-center gap-2">
              <Crown className="size-4 text-[#FF9933]" />
              National Team 2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {national.map((n) => (
                <div key={n.id} className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-gradient-to-br from-[#FF9933] to-[#E68A2E] flex items-center justify-center text-white font-bold text-sm">
                    {n.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join("")}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#1a1a3e]">{n.full_name}</div>
                    <div className="text-xs text-[#1a1a3e]/60">{n.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* National totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <RollupCard icon={Globe} label="Active Zones" value={summary.filter((z) => z.events_count > 0).length} accent="orange" />
        <RollupCard icon={Trophy} label="Total Events" value={totalEvents} accent="indigo" />
        <RollupCard icon={Users} label="Total Participants" value={totalParticipants} accent="green" />
        <RollupCard icon={MapPin} label="Results Published" value={totalResults} accent="blue" />
      </div>

      {/* Zone cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {summary.map((z) => (
          <Link key={z.zone} href={`/dashboard/zones/${z.zone.toLowerCase()}`}>
            <Card className="hover:border-[#FF9933]/40 hover:shadow-md transition-all cursor-pointer h-full">
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]/70 border border-[#1a1a3e]/10 font-mono text-[10px]">
                      {z.zone}
                    </Badge>
                    <h3 className="text-lg font-semibold text-[#1a1a3e] mt-1">{z.label}</h3>
                    {z.rm_name && (
                      <p className="text-xs text-[#1a1a3e]/60 mt-0.5">RM: {z.rm_name}</p>
                    )}
                  </div>
                  <ArrowUpRight className="size-4 text-[#1a1a3e]/30" />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#1a1a3e]/5">
                  <MiniStat label="Events" value={z.events_count} />
                  <MiniStat label="Chapters" value={z.chapters_count} />
                  <MiniStat label="Students" value={z.participants_count} />
                </div>
                <div className="text-[11px] text-[#1a1a3e]/60">
                  {z.results_published_count} of {z.events_count} events with results published
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function RollupCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: "orange" | "blue" | "green" | "indigo";
}) {
  const map = {
    orange: { bg: "bg-[#FF9933]/10", text: "text-[#FF9933]" },
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    green: { bg: "bg-[#138808]/10", text: "text-[#138808]" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  }[accent];

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-3">
          <div className={`size-9 rounded-lg ${map.bg} flex items-center justify-center`}>
            <Icon className={`size-5 ${map.text}`} />
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1a1a3e]">{value}</div>
            <div className="text-xs text-[#1a1a3e]/60">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm font-bold text-[#1a1a3e]">{value}</div>
      <div className="text-[10px] text-[#1a1a3e]/60 uppercase tracking-wider">{label}</div>
    </div>
  );
}
