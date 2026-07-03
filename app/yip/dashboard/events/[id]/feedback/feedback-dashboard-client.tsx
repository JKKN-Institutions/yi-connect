"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/yip/ui/table";
import {
  Download,
  Star,
  MessageSquare,
  TrendingUp,
  Users,
  Gauge,
  ThumbsUp,
  Inbox,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportFeedbackCSV,
  type FeedbackStats,
} from "@/app/yip/actions/feedback";
import {
  RESPONDENT_LABELS,
  RESPONDENT_COLORS,
  NPS_BUCKET_LABELS,
  NPS_BUCKET_COLORS,
  type FeedbackRespondentType,
  type FeedbackResponseRow,
} from "@/lib/yip/feedback";

type Props = {
  eventId: string;
  eventName: string;
  stats: FeedbackStats;
  responses: FeedbackResponseRow[];
};

const TYPES: ("all" | FeedbackRespondentType)[] = [
  "all",
  "participant",
  "organizer",
  "volunteer",
  "jury",
];

export function FeedbackDashboardClient({
  eventId,
  eventName,
  stats,
  responses,
}: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TYPES)[number]>("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (activeTab === "all") return responses;
    return responses.filter((r) => r.respondent_type === activeTab);
  }, [activeTab, responses]);

  // Copy-paste link to the public organizer form for easy distribution
  const orgFormUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/dashboard/events/${eventId}/feedback/organizer`
      : "";

  function handleExport() {
    startTransition(async () => {
      const res = await exportFeedbackCSV(eventId);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.data.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    });
  }

  function copyLink() {
    navigator.clipboard.writeText(orgFormUrl).then(
      () => toast.success("Link copied"),
      () => toast.error("Couldn't copy")
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a3e]">
            Feedback
          </h2>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            Post-event feedback from participants and stakeholders for{" "}
            <span className="font-medium">{eventName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={copyLink}
            className="border-[#1a1a3e]/20"
          >
            <Copy className="size-3.5 mr-1.5" />
            Copy organizer link
          </Button>
          <Button
            onClick={handleExport}
            disabled={isPending || responses.length === 0}
            className="bg-[#FF9933] hover:bg-[#E68A2E] text-white"
            size="sm"
          >
            <Download className="size-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Stats cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Responses"
          value={stats.total.toString()}
          icon={Inbox}
          accent="from-[#1a1a3e] to-[#2d2d5f]"
          sublabel={breakdownLine(stats.byType)}
        />
        <StatCard
          label="Avg Overall"
          value={stats.avgOverall !== null ? stats.avgOverall.toFixed(1) : "—"}
          icon={Star}
          accent="from-[#FF9933] to-[#E68A2E]"
          sublabel="out of 5"
        />
        <StatCard
          label="Avg Organization"
          value={
            stats.avgOrganization !== null
              ? stats.avgOrganization.toFixed(1)
              : "—"
          }
          icon={Gauge}
          accent="from-[#138808] to-[#0f7006]"
          sublabel="out of 5"
        />
        <StatCard
          label="Avg Content"
          value={
            stats.avgContent !== null ? stats.avgContent.toFixed(1) : "—"
          }
          icon={MessageSquare}
          accent="from-purple-600 to-violet-500"
          sublabel="out of 5"
        />
      </div>

      {/* ── NPS card (dedicated, because breakdown matters) ── */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-[#FF9933]" />
              <h3 className="text-sm font-bold text-[#1a1a3e]">
                Net Promoter Score
              </h3>
            </div>
            <div className="text-3xl font-black text-[#1a1a3e]">
              {stats.nps !== null ? (
                <span className={npsColor(stats.nps)}>{stats.nps}</span>
              ) : (
                <span className="text-gray-300">—</span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <NpsBucketCard
              bucket="detractor"
              count={stats.npsBreakdown.detractor}
              total={
                stats.npsBreakdown.detractor +
                stats.npsBreakdown.passive +
                stats.npsBreakdown.promoter
              }
            />
            <NpsBucketCard
              bucket="passive"
              count={stats.npsBreakdown.passive}
              total={
                stats.npsBreakdown.detractor +
                stats.npsBreakdown.passive +
                stats.npsBreakdown.promoter
              }
            />
            <NpsBucketCard
              bucket="promoter"
              count={stats.npsBreakdown.promoter}
              total={
                stats.npsBreakdown.detractor +
                stats.npsBreakdown.passive +
                stats.npsBreakdown.promoter
              }
            />
          </div>
          {stats.recommendRate !== null && (
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-600">
              <ThumbsUp className="size-3.5" />
              {Math.round(stats.recommendRate * 100)}% would recommend YIP
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tabs by respondent type ────────────────────── */}
      <div className="flex gap-1 border-b border-[#1a1a3e]/10 overflow-x-auto">
        {TYPES.map((t) => {
          const count =
            t === "all" ? stats.total : stats.byType[t as FeedbackRespondentType];
          const active = activeTab === t;
          return (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={
                "flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap " +
                (active
                  ? "border-[#FF9933] text-[#FF9933]"
                  : "border-transparent text-[#1a1a3e]/50 hover:text-[#1a1a3e]")
              }
            >
              {t === "all" ? "All" : RESPONDENT_LABELS[t]}
              <span
                className={
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold " +
                  (active
                    ? "bg-[#FF9933]/15 text-[#FF9933]"
                    : "bg-[#1a1a3e]/5 text-[#1a1a3e]/50")
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Responses table ────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto size-10 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-700">
              No responses yet
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Share the organizer link above with your team and ask participants
              to visit{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">
                /me/feedback
              </code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">When</TableHead>
                <TableHead>Who</TableHead>
                <TableHead className="text-center w-[60px]">Overall</TableHead>
                <TableHead className="text-center w-[50px]">NPS</TableHead>
                <TableHead>Biggest takeaway</TableHead>
                <TableHead>What to improve</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-gray-500">
                    {formatShortDate(r.submitted_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          "text-[10px] " +
                          RESPONDENT_COLORS[r.respondent_type]
                        }
                      >
                        {RESPONDENT_LABELS[r.respondent_type]}
                      </Badge>
                      <span className="text-sm font-medium text-gray-800">
                        {r.respondent_name ?? "—"}
                      </span>
                    </div>
                    {r.respondent_email && (
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {r.respondent_email}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.overall_rating !== null ? (
                      <span className="inline-flex items-center gap-0.5 text-sm font-semibold text-[#FF9933]">
                        {r.overall_rating}
                        <Star className="size-3 fill-[#FF9933] text-[#FF9933]" />
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {r.nps_score !== null ? (
                      <span
                        className={
                          "text-sm font-bold " + npsColor(r.nps_score * 10 - 50)
                        }
                      >
                        {r.nps_score}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-xs text-gray-700 line-clamp-2">
                      {r.biggest_takeaway ?? (
                        <span className="text-gray-300">—</span>
                      )}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="text-xs text-gray-700 line-clamp-2">
                      {/* Only the ORGANIZER form collects what_didnt_work; the
                          participant form's improvement text lands in
                          `suggestions`. Coalesce so participant rows aren't a
                          permanently blank column (Erode 2026). */}
                      {r.what_didnt_work?.trim() || r.suggestions?.trim() || (
                        <span className="text-gray-300">—</span>
                      )}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  sublabel,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  sublabel?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${accent}`} />
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
              {label}
            </p>
            <p className="mt-1 text-2xl font-black text-[#1a1a3e]">{value}</p>
            {sublabel && (
              <p className="text-[11px] text-gray-500 mt-0.5">{sublabel}</p>
            )}
          </div>
          <Icon className="size-4 text-gray-300" />
        </div>
      </CardContent>
    </Card>
  );
}

function NpsBucketCard({
  bucket,
  count,
  total,
}: {
  bucket: keyof typeof NPS_BUCKET_LABELS;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <span
          className={
            "text-[10px] px-1.5 py-0.5 rounded-full font-medium " +
            NPS_BUCKET_COLORS[bucket]
          }
        >
          {NPS_BUCKET_LABELS[bucket]}
        </span>
        <span className="text-xs font-semibold text-gray-700">{pct}%</span>
      </div>
      <p className="text-xl font-black text-[#1a1a3e]">{count}</p>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function breakdownLine(byType: FeedbackStats["byType"]) {
  const parts: string[] = [];
  if (byType.participant) parts.push(`${byType.participant} students`);
  if (byType.organizer) parts.push(`${byType.organizer} orgs`);
  if (byType.volunteer) parts.push(`${byType.volunteer} vols`);
  if (byType.jury) parts.push(`${byType.jury} jury`);
  return parts.join(" · ") || "awaiting input";
}

function npsColor(nps: number) {
  if (nps >= 50) return "text-emerald-600";
  if (nps >= 0) return "text-amber-600";
  return "text-red-600";
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
