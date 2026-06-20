import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { PushSubscribe } from "@/components/yi-future/pwa/PushSubscribe";
import { NudgeButton } from "./whatsapp-outreach/SendButton";
import { NextStepWidget } from "@/components/yi-future/guide";
import { GUIDES } from "@/lib/yi-future/guide/content";
import { getCompletedSteps, logGuideEvent } from "@/lib/yi-future/guide/actions";

type ChapterRow = {
  id: string;
  name: string;
  region: string | null;
  is_active: boolean | null;
  chair_name: string | null;
  chair_email: string | null;
  chair_mobile: string | null;
};

type DelegateRow = {
  id: string;
  chapter_id: string;
  registered_at: string | null;
};

type EditionRow = {
  id: string;
  name: string;
  slug: string;
  current_stage: string | null;
};

const REGIONS = ["ER", "NER", "NR", "SRTKKA", "SRTN", "WR"] as const;
const REGION_LABELS: Record<string, string> = {
  ER: "East",
  NER: "North-East",
  NR: "North",
  SRTKKA: "South (TN/KKA)",
  SRTN: "South (TN)",
  WR: "West",
};

async function getActiveEdition(): Promise<EditionRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, slug, current_stage")
    .eq("is_active", true)
    .maybeSingle();
  return (data as EditionRow | null) ?? null;
}

async function getAllChapters(): Promise<ChapterRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region, is_active, chair_name, chair_email, chair_mobile")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data as unknown as ChapterRow[]) ?? [];
}

async function getDelegates(editionId: string): Promise<DelegateRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("delegates")
    .select("id, chapter_id, registered_at")
    .eq("edition_id", editionId);
  return (data as unknown as DelegateRow[]) ?? [];
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function pushMessage(opts: {
  chairFirstName: string;
  chapter: string;
  count: number;
  editionName: string;
}): string {
  const { chairFirstName, chapter, count, editionName } = opts;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app";
  return `Hi ${chairFirstName}, this is a quick nudge from Yi National.\n\n${chapter} chapter currently has ${count} delegate${count === 1 ? "" : "s"} registered for ${editionName}.\n\nIf you need help recruiting from your colleges, reply here. Your chapter dashboard: ${appUrl}/yi-future/chapter\n\n— Yi National`;
}

export default async function NationalDashboard({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const sortHigh = sort === "high";
  const edition = await getActiveEdition();
  const chapters = await getAllChapters();
  const delegates = edition ? await getDelegates(edition.id) : [];

  const countsByChapter = new Map<string, number>();
  const lastRegByChapter = new Map<string, string>();
  for (const d of delegates) {
    countsByChapter.set(
      d.chapter_id,
      (countsByChapter.get(d.chapter_id) ?? 0) + 1
    );
    const cur = lastRegByChapter.get(d.chapter_id);
    if (d.registered_at && (!cur || d.registered_at > cur)) {
      lastRegByChapter.set(d.chapter_id, d.registered_at);
    }
  }

  const regionStats = REGIONS.map((r) => {
    const inRegion = chapters.filter((c) => c.region === r);
    const delegatesInRegion = inRegion.reduce(
      (acc, c) => acc + (countsByChapter.get(c.id) ?? 0),
      0
    );
    const activeChapters = inRegion.filter(
      (c) => (countsByChapter.get(c.id) ?? 0) > 0
    ).length;
    return {
      region: r,
      label: REGION_LABELS[r],
      chapters: inRegion.length,
      activeChapters,
      delegates: delegatesInRegion,
    };
  });

  const rows = chapters.map((c) => ({
    ...c,
    count: countsByChapter.get(c.id) ?? 0,
    lastReg: lastRegByChapter.get(c.id) ?? null,
  }));
  rows.sort((a, b) => {
    if (a.count !== b.count) {
      return sortHigh ? b.count - a.count : a.count - b.count;
    }
    return a.name.localeCompare(b.name);
  });

  const totalDelegates = delegates.length;
  const activeChaptersCount = rows.filter((r) => r.count > 0).length;
  const zeroChapters = rows.filter((r) => r.count === 0).length;
  const guideCompleted = await getCompletedSteps("national");

  return (
    <div className="space-y-6">
      <NextStepWidget
        guide={GUIDES.lanes.national}
        basePath="/yi-future/guide"
        completed={guideCompleted}
        onEvent={logGuideEvent}
      />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">National Dashboard</h2>
          <p className="mt-1 text-sm text-navy/60">
            {edition ? (
              <>
                {edition.name}{" "}
                <span className="text-xs px-1.5 py-0.5 rounded bg-yi-gold/10 text-yi-gold ml-1">
                  {edition.current_stage ?? "—"}
                </span>
              </>
            ) : (
              "No active edition"
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <PushSubscribe />
          <Link
            href="/yi-future/national/admin/editions"
            className="text-xs font-semibold text-navy hover:text-yi-gold"
          >
            Manage edition →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Delegates" value={totalDelegates} sub="across all chapters" />
        <KPI
          label="Chapters with registrations"
          value={`${activeChaptersCount}/${chapters.length}`}
          sub={`${zeroChapters} still at 0`}
        />
        <KPI label="Total chapters" value={chapters.length} sub="active in Yi" />
        <KPI
          label="Avg per active chapter"
          value={
            activeChaptersCount > 0
              ? Math.round((totalDelegates / activeChaptersCount) * 10) / 10
              : 0
          }
          sub="delegates"
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
          By Region
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {regionStats.map((r) => (
            <div
              key={r.region}
              className="bg-white border border-navy/10 rounded-lg p-4"
            >
              <div className="text-[10px] font-bold uppercase tracking-widest text-yi-gold">
                {r.region}
              </div>
              <div className="text-[10px] text-navy/50">{r.label}</div>
              <div className="mt-2 text-2xl font-bold text-navy">
                {r.delegates}
              </div>
              <div className="text-[11px] text-navy/60">
                {r.activeChapters}/{r.chapters} chapters active
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-end justify-between mb-3 gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50">
              All chapters · sorted by {sortHigh ? "highest" : "lowest"} first
            </h3>
            <div className="flex items-center gap-1 text-[11px] font-semibold">
              <Link
                href="/yi-future/national/admin"
                className={`px-2 py-0.5 rounded ${
                  !sortHigh
                    ? "bg-navy text-ivory"
                    : "text-navy/60 hover:bg-navy/5 border border-navy/15"
                }`}
              >
                Lowest first
              </Link>
              <Link
                href="/yi-future/national/admin?sort=high"
                className={`px-2 py-0.5 rounded ${
                  sortHigh
                    ? "bg-navy text-ivory"
                    : "text-navy/60 hover:bg-navy/5 border border-navy/15"
                }`}
              >
                Highest first
              </Link>
            </div>
          </div>
          <p className="text-[11px] text-navy/40">
            Push opens an Email or WhatsApp draft to the chair. You review
            before sending.
          </p>
        </div>

        <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Chapter</th>
                <th className="text-left px-3 py-2 font-semibold">Region</th>
                <th className="text-right px-3 py-2 font-semibold">Delegates</th>
                <th className="text-left px-3 py-2 font-semibold">Last reg.</th>
                <th className="text-left px-3 py-2 font-semibold">Chair</th>
                <th className="text-right px-3 py-2 font-semibold">Push</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const chairFirst =
                  r.chair_name?.split(/\s+/)[0] ?? "Chair";
                const message = pushMessage({
                  chairFirstName: chairFirst,
                  chapter: r.name,
                  count: r.count,
                  editionName: edition?.name ?? "Future 6.0",
                });
                const subject = `Future 6.0 · ${r.name} registration update`;
                const mailto = r.chair_email
                  ? `mailto:${encodeURIComponent(
                      r.chair_email
                    )}?subject=${encodeURIComponent(
                      subject
                    )}&body=${encodeURIComponent(message)}`
                  : null;
                const waNumber = r.chair_mobile
                  ? r.chair_mobile.replace(/[^\d]/g, "").replace(/^0+/, "")
                  : null;
                const wa = waNumber
                  ? `https://wa.me/91${waNumber}?text=${encodeURIComponent(
                      message
                    )}`
                  : null;
                const tone =
                  r.count === 0
                    ? "text-red-600"
                    : r.count < 5
                    ? "text-yi-saffron"
                    : "text-yi-green";

                return (
                  <tr
                    key={r.id}
                    className="border-t border-navy/5 hover:bg-navy/[0.015]"
                  >
                    <td className="px-3 py-2.5 font-semibold text-navy">
                      {r.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-navy/50">
                        {r.region ?? "—"}
                      </span>
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-bold ${tone}`}
                    >
                      {r.count}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-navy/60">
                      {timeAgo(r.lastReg)}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {r.chair_name ? (
                        <>
                          <div className="text-navy font-medium">
                            {r.chair_name}
                          </div>
                          <div className="text-navy/40">
                            {r.chair_email ?? "no email"}
                          </div>
                        </>
                      ) : (
                        <span className="text-navy/30">no chair</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        {mailto ? (
                          <a
                            href={mailto}
                            className="inline-flex items-center px-2 py-1 rounded border border-navy/20 text-[11px] font-semibold text-navy hover:bg-navy/5"
                            title="Opens your email app with a pre-filled draft"
                          >
                            ✉ Email
                          </a>
                        ) : (
                          <span className="text-[11px] text-navy/30">
                            no email
                          </span>
                        )}
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center px-2 py-1 rounded border border-yi-green/30 bg-yi-green/5 text-[11px] font-semibold text-yi-green hover:bg-yi-green/10"
                            title="Opens WhatsApp with a pre-filled draft"
                          >
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-[11px] text-navy/30">
                            no mobile
                          </span>
                        )}
                        <NudgeButton
                          chapterId={r.id}
                          mobile={r.chair_mobile}
                          name={r.chair_name ?? "Chair"}
                          message={message}
                          label="Send via WhatsApp"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold text-navy">{value}</div>
      <div className="mt-0.5 text-[11px] text-navy/50">{sub}</div>
    </div>
  );
}
