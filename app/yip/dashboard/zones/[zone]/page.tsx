import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { listOrganizerProfiles } from "@/app/yip/actions/hierarchy";
import { YI_ZONES, type YiZone } from "@/lib/yip/hierarchy";
import { Badge } from "@/components/yip/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import { MapPin, Users, Trophy, CheckCircle2, ArrowLeft } from "lucide-react";

export default async function ZoneDashboardPage({
  params,
}: {
  params: Promise<{ zone: string }>;
}) {
  const { zone: rawZone } = await params;
  const zoneCode = rawZone.toUpperCase() as YiZone;
  const zoneMeta = YI_ZONES.find((z) => z.code === zoneCode);
  if (!zoneMeta) notFound();

  const supabase = await createServiceClient();

  const [events, rms] = await Promise.all([
    supabase
      .from("events")
      .select("id, name, level, status, chapter_name, city, state, day1_date, results_published_at, created_by")
      .eq("zone", zoneCode)
      .order("day1_date", { ascending: false }),
    listOrganizerProfiles({ role: "rm", zone: zoneCode }),
  ]);

  const eventList = events.data ?? [];
  const rm = rms[0];

  const eventIds = eventList.map((e) => e.id);
  const { data: participants } = await supabase
    .from("participants")
    .select("event_id, school_name")
    .in("event_id", eventIds.length > 0 ? eventIds : ["00000000-0000-0000-0000-000000000000"]);

  const pList = participants ?? [];
  const totalParticipants = pList.length;
  const uniqueSchools = new Set(pList.map((p) => p.school_name).filter(Boolean)).size;
  const resultsPublished = eventList.filter((e) => e.results_published_at !== null).length;

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      <div>
        <Link
          href="/yip/dashboard/admin"
          className="inline-flex items-center gap-1 text-xs text-[#1a1a3e]/60 hover:text-[#1a1a3e] mb-2"
        >
          <ArrowLeft className="size-3" /> National dashboard
        </Link>
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-[#1a1a3e] tracking-tight">
              {zoneMeta.label} Region
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-[#1a1a3e]/5 text-[#1a1a3e]/70 border border-[#1a1a3e]/10 font-mono text-[10px]">
                {zoneCode}
              </Badge>
              {rm && (
                <span className="text-sm text-[#1a1a3e]/70">
                  Regional Manager: <strong>{rm.full_name}</strong>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Events" value={eventList.length} color="orange" />
        <StatCard icon={MapPin} label="Schools" value={uniqueSchools} color="blue" />
        <StatCard
          icon={Users}
          label="Participants"
          value={totalParticipants}
          color="green"
        />
        <StatCard
          icon={CheckCircle2}
          label="Results Published"
          value={resultsPublished}
          color="indigo"
        />
      </div>

      {/* States covered */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-[#1a1a3e]/70">States in this zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {zoneMeta.states.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Events list */}
      <Card>
        <CardHeader>
          <CardTitle>Chapter &amp; Regional Events</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>City · State</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eventList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-[#1a1a3e]/50 py-12">
                    No events in this zone yet.
                  </TableCell>
                </TableRow>
              )}
              {eventList.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {e.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-[#1a1a3e]/70">
                    {[e.city, e.state].filter(Boolean).join(", ") || e.chapter_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(e.day1_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {e.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/events/${e.id}`}
                      className="text-xs text-[#FF9933] hover:underline"
                    >
                      Open →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: "orange" | "blue" | "green" | "indigo";
}) {
  const map = {
    orange: { bg: "bg-[#FF9933]/10", text: "text-[#FF9933]" },
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    green: { bg: "bg-[#138808]/10", text: "text-[#138808]" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  }[color];
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
