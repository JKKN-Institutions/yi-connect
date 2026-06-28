import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clauseTexts } from "@/lib/yip/bill-provisions";
import { getYipSession } from "@/lib/yip/auth/yip-session";
import { createServiceClient } from "@/lib/yip/supabase/server";
import {
  getEventSchoolNumbers,
  schoolNumberOf,
} from "@/lib/yip/school-numbers";
import {
  ROLE_LABELS,
  ROLE_COLORS,
  PARTY_COLORS,
  MINISTRIES,
  DEFAULT_AGENDA_TEMPLATE,
} from "@/lib/yip/constants";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import Link from "next/link";
import {
  Trophy,
  Award,
  Clock,
  MapPin,
  Calendar,
  GraduationCap,
  Users,
  Landmark,
  BookOpen,
  MessageSquare,
  MessageCircleHeart,
  FileText,
  ChevronRight,
  Megaphone,
  Gavel,
  Phone,
  Mail,
  UserRound,
  HeartHandshake,
  Flag,
  ClipboardList,
  Lock,
} from "lucide-react";
import { VoteClient } from "./vote/vote-client";
import { GoIndependentButton } from "./go-independent-button";
import { LiveNowCard } from "./live-now-card";
import { AnnouncementStrip } from "./announcement-strip";
import { ModuleWelcome } from "@/components/yip/guide/module-welcome";
import { logGuideEvent } from "@/lib/yip/guide/actions";
import { OfflineStaleNote } from "./offline-stale-note";
import { SkillProfileCard } from "@/components/yip/skill-profile-card";
import { getSkillProfile } from "@/app/yip/actions/skill-profile";
import {
  getMeContacts,
  getMyPartyRoster,
  type MeContactInfo,
  type MeRosterMember,
} from "@/app/yip/actions/me-dashboard";
import { YourDayInTheHouseCard } from "./your-day-card";
import { YourGrowthCard } from "./your-growth-card";

// ─── Session parsing ─────────────────────────────────────────────

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
    if (
      parsed.type === "participant" &&
      parsed.id &&
      parsed.name &&
      parsed.eventId
    ) {
      return parsed as ParticipantSession;
    }
    return null;
  } catch {
    return null;
  }
}

function getMinistryLabel(key: string | null): string {
  if (!key) return "";
  const found = MINISTRIES.find((m) => m.key === key);
  return found ? found.label : key;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ─── Role badge gradient ─────────────────────────────────────────

const ROLE_GRADIENTS: Record<string, string> = {
  speaker: "from-amber-500 to-yellow-400",
  deputy_speaker: "from-amber-400 to-orange-300",
  prime_minister: "from-blue-600 to-blue-400",
  deputy_prime_minister: "from-blue-500 to-sky-300",
  leader_of_opposition: "from-red-600 to-red-400",
  cabinet_minister: "from-blue-500 to-sky-400",
  shadow_minister: "from-red-500 to-rose-400",
  party_leader: "from-indigo-600 to-indigo-400",
  bill_committee: "from-purple-500 to-violet-400",
  mp: "from-gray-600 to-gray-400",
  independent_mp: "from-emerald-600 to-emerald-400",
};

const PARTY_GRADIENTS = {
  ruling: "from-blue-600 via-blue-500 to-blue-400",
  opposition: "from-red-600 via-red-500 to-red-400",
} as const;

// ─── Page Component ──────────────────────────────────────────────

export default async function ParticipantPage() {
  const session = await getYipSession();

  if (!session || session.type !== "participant") {
    redirect("/yip/join");
  }

  const supabase = await createServiceClient();

  // Fetch full participant details
  const { data: participant } = await supabase
    .from("participants")
    .select("*")
    .eq("id", session.id)
    .single();

  if (!participant) {
    redirect("/yip/join");
  }

  // Fetch event details
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", participant.event_id)
    .single();

  if (!event) {
    redirect("/yip/join");
  }

  // Participants see their school as an anonymised per-event NUMBER, never the
  // name (director decision 2026-06-27). school_name stays an opaque seating key.
  const schoolNumbers = await getEventSchoolNumbers(event.id);
  const schoolNum = schoolNumberOf(schoolNumbers, participant.school_name);
  const schoolDisplay: string = participant.school_name
    ? schoolNum != null
      ? `#${schoolNum}`
      : "#—"
    : "";

  // The student's actual party NAME (e.g. "Bharat Progressive Front"), not just
  // the bench. party_id is the primary key; fall back to (event, party_number)
  // since some participants carry only party_number. We also pull the party's
  // own identity (symbol, tagline, 4-point manifesto) so the dashboard can show
  // it — scoped to THIS student's party only.
  let partyName: string | null = null;
  let partyDetails: {
    symbol_url: string | null;
    tagline: string | null;
    manifesto: string[];
  } | null = null;
  {
    let partyRow:
      | {
          name: string | null;
          symbol_url: string | null;
          tagline: string | null;
          manifesto: unknown;
        }
      | null = null;
    if (participant.party_id) {
      const { data } = await supabase
        .from("parties")
        .select("name, symbol_url, tagline, manifesto")
        .eq("id", participant.party_id)
        .maybeSingle();
      partyRow = data ?? null;
    }
    if (!partyRow && participant.party_number != null) {
      const { data } = await supabase
        .from("parties")
        .select("name, symbol_url, tagline, manifesto")
        .eq("event_id", event.id)
        .eq("party_number", participant.party_number)
        .maybeSingle();
      partyRow = data ?? null;
    }
    if (partyRow) {
      partyName = partyRow.name ?? null;
      // manifesto is a jsonb string[] of planks; each plank may carry newlines.
      const planks = Array.isArray(partyRow.manifesto)
        ? (partyRow.manifesto as unknown[]).filter(
            (m): m is string => typeof m === "string" && m.trim().length > 0
          )
        : [];
      partyDetails = {
        symbol_url: partyRow.symbol_url ?? null,
        tagline: partyRow.tagline ?? null,
        manifesto: planks,
      };
    }
  }

  // Fetch results if published. Students see their RANK + any awards only —
  // never raw scores (avg /100 or the per-criterion breakdown).
  let result: {
    rank: number | null;
    award_category: string | null;
  } | null = null;

  if (event.results_published_at) {
    const { data: resultData } = await supabase
      .from("results")
      .select("rank, award_category")
      .eq("event_id", event.id)
      .eq("participant_id", participant.id)
      .maybeSingle();

    result = resultData ?? null;
  }

  // Fetch agenda items (mode aligned with handbook page 19 — party vs committee)
  const { data: agendaItems } = await supabase
    .from("agenda")
    .select("day, sequence_order, title, duration_minutes, agenda_type, mode")
    .eq("event_id", event.id)
    .order("day")
    .order("sequence_order");

  // Fetch question count for this participant
  const { data: questionData } = await supabase
    .from("questions")
    .select("id, status")
    .eq("event_id", event.id)
    .eq("submitted_by", participant.id);

  const myQuestions = questionData ?? [];
  const questionCount = myQuestions.length;

  // Fetch bill data for committee members. A committee member is anyone with a
  // committee_name — committees include everyone except the Speaker Panel (the
  // assignCommittees engine + a DB trigger clear committee_name for presiding
  // officers), so committee_name presence is the single source of truth.
  const isCommitteeMember = !!participant.committee_name;
  let myBill: { id: string; title: string; status: string | null } | null = null;

  if (participant.committee_name) {
    const { data: billData } = await supabase
      .from("bills")
      .select("id, title, status")
      .eq("event_id", event.id)
      .eq("committee_name" as never, participant.committee_name as never)
      .maybeSingle();

    myBill = billData;
  }

  // Committee topic + linked scheme (yip.topics catalog, same lookup as the bill
  // page) so the dashboard can show "Committee N — topic" + the scheme, and the
  // committee-report status to drive the Report card + bill lock.
  let committeeTopic: string | null = null;
  let committeeScheme: string | null = null;
  let reportSubmitted = false;
  if (participant.committee_name) {
    const { data: ct } = await supabase
      .from("topics")
      .select("description, linked_scheme")
      .eq("category", "committee")
      .eq("title", participant.committee_name)
      .eq("is_active", true)
      .maybeSingle();
    committeeTopic = ct?.description ?? null;
    committeeScheme = ct?.linked_scheme ?? null;

    const { data: rep } = await supabase
      .from("committee_reports")
      .select("status")
      .eq("event_id", event.id)
      .eq("committee_name", participant.committee_name)
      .maybeSingle();
    reportSubmitted = rep?.status === "submitted";
  }

  // For non-committee members: fetch approved/presented bills for read-only view
  let approvedBills: Array<{
    id: string;
    title: string;
    party_side: string | null;
    committee_name: string | null;
    objective: string | null;
    provisions: string[] | null;
    status: string | null;
  }> = [];

  if (!isCommitteeMember) {
    const { data: billsData } = await supabase
      .from("bills")
      .select("id, title, party_side, committee_name, objective, provisions, status")
      .eq("event_id", event.id)
      .in("status", ["approved", "presented", "passed", "rejected"]);

    approvedBills = (billsData ?? []).map((b) => ({
      ...b,
      provisions: clauseTexts(b.provisions),
    }));
  }

  // Check if question submission is allowed
  const canSubmitQuestions =
    event.status === "registration_open" ||
    event.status === "registration_closed" ||
    event.status === "day1_live" ||
    event.status === "day1_complete" ||
    event.status === "day2_live";

  const day1Items = (agendaItems ?? []).filter((a) => a.day === 1);
  const day2Items = (agendaItems ?? []).filter((a) => a.day === 2);

  // Phase 19 / F — Skill profile derived from sub-criteria scores across
  // this person's YIP journey (all events they've participated in).
  const skillProfile = await getSkillProfile(participant.id);

  // Change Request §3 — student dashboard contacts + privacy-safe roster.
  const [contacts, partyRoster]: [MeContactInfo, MeRosterMember[]] =
    await Promise.all([
      getMeContacts(participant.id),
      getMyPartyRoster(participant.id),
    ]);

  const role = participant.parliament_role;
  const side = participant.party_side as "ruling" | "opposition" | null;
  // Party identity must show even when there is no bench. Benchless allocation
  // (the current default) leaves party_side null — Ruling/Opposition is decided
  // live on event day — so party display can NOT key off `side`, or every party
  // chip + roster disappears. Neutral (saffron) accent when there is no side;
  // the Ruling/Opposition tint is kept only when a side actually exists.
  const partyAccent =
    side === "ruling"
      ? {
          border: "border-blue-200/50",
          bar: "from-blue-500 to-sky-400",
          text: "text-blue-600",
          chip: "bg-blue-100 text-blue-700",
          badge: PARTY_COLORS.ruling.badge,
        }
      : side === "opposition"
        ? {
            border: "border-red-200/50",
            bar: "from-red-500 to-rose-400",
            text: "text-red-600",
            chip: "bg-red-100 text-red-700",
            badge: PARTY_COLORS.opposition.badge,
          }
        : {
            border: "border-[#FF9933]/30",
            bar: "from-[#FF9933] to-amber-400",
            text: "text-[#b56a1f]",
            chip: "bg-[#FF9933]/15 text-[#9a5212]",
            badge: "bg-[#FF9933]/12 text-[#9a5212]",
          };
  const roleLabel = role ? ROLE_LABELS[role] ?? role : null;
  const roleGradient = role ? ROLE_GRADIENTS[role] ?? "from-gray-500 to-gray-400" : "";
  const isPresiding = role === "speaker" || role === "deputy_speaker";
  const isMinistryDesk = role === "cabinet_minister";
  const isPMDesk = role === "prime_minister" || role === "deputy_prime_minister";
  const isShadowDesk = role === "shadow_minister";
  const isOpposition = role === "leader_of_opposition";
  const partyGradient = side ? PARTY_GRADIENTS[side] : "";

  return (
    <div className="space-y-5">
      {/* First-entry welcome — students have no Supabase progress (access-code
          cookie session), so this uses the once-per-browser localStorage
          fallback (no seen/onSeen). Dismissible card, never blocks the page. */}
      <ModuleWelcome
        moduleKey="me-dashboard"
        persona="student"
        title="Welcome to your Parliament dashboard"
        body="This is your home base for the two days — your **role**, **party** and what the house is doing **right now**. Tap below for a 1-minute tour."
        cta={{ label: "Show me how", href: "/yip/guide?persona=student#your-dashboard" }}
        onEvent={logGuideEvent}
      />

      {/* ─── HERO ROLE CARD ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg ring-1 ring-gray-200/60">
        {/* Decorative top bar */}
        {side && (
          <div
            className={`h-1.5 w-full bg-gradient-to-r ${partyGradient}`}
          />
        )}

        <div className="px-5 pb-6 pt-5 landscape-compact">
          {/* Landscape: name + badges side by side. Portrait: stacked */}
          <div className="landscape-2col">
            <div>
              {/* Name */}
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                {participant.full_name}
              </h1>

              {/* Role + Party badges */}
              <div className="mt-3 flex flex-wrap gap-2">
                {roleLabel && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${roleGradient} px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm`}
                  >
                    <Landmark className="size-3.5" />
                    {roleLabel}
                  </span>
                )}
                {(partyName || participant.party_number != null || side) && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${partyAccent.badge} shadow-sm`}
                  >
                    <Flag className="size-3.5" />
                    {partyName ??
                      (participant.party_number != null
                        ? `Party ${participant.party_number}`
                        : side === "ruling"
                          ? "Ruling Party"
                          : "Opposition Party")}
                    {side && (
                      <span className="font-normal opacity-80">
                        · {side === "ruling" ? "Ruling" : "Opposition"}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Details grid */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <DetailItem
                icon={GraduationCap}
                label="School"
                value={schoolDisplay}
                fullWidth
              />
              {participant.constituency_name && (
                <DetailItem
                  icon={MapPin}
                  label="Constituency"
                  value={`${participant.constituency_name}${participant.constituency_state ? `, ${participant.constituency_state}` : ""}`}
                />
              )}
              {participant.ministry && (
                <DetailItem
                  icon={Landmark}
                  label="Ministry"
                  value={getMinistryLabel(participant.ministry)}
                />
              )}
              {participant.committee_name && (
                <div className="col-span-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
                    Committee
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <Users className="size-3.5 text-gray-400 shrink-0" />
                    <span className="text-sm font-semibold text-gray-800">
                      Committee {participant.committee_number ?? "—"}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-medium text-purple-700">
                      {participant.committee_name}
                    </span>
                  </div>
                  {committeeTopic && (
                    <p className="text-sm text-gray-700 mt-1 ml-5">
                      {committeeTopic}
                    </p>
                  )}
                  {committeeScheme && (
                    <p className="text-[11px] text-gray-400 mt-0.5 ml-5">
                      Linked scheme: {committeeScheme}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Subtle watermark */}
        <div className="absolute -right-6 -bottom-6 opacity-[0.04] landscape-hide">
          <Landmark className="size-40" />
        </div>
      </div>

      {/* ─── EVENT INFO ─────────────────────────────────────────── */}
      <Card className="border-[#FF9933]/20">
        <CardContent className="pt-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">
            {event.name}
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-[#FF9933]" />
              <span>Day 1: {formatDate(event.day1_date)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-[#FF9933]" />
              <span>Day 2: {formatDate(event.day2_date)}</span>
            </div>
            {event.venue_name && (
              <div className="flex items-start gap-2">
                <MapPin className="size-4 text-[#FF9933] mt-0.5" />
                <span>
                  {event.venue_name}
                  {event.venue_address ? `, ${event.venue_address}` : ""}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── YOUR DAY IN THE HOUSE (AI recap — Day 2 morning) ──────────
          Dispute-proof: renders ONLY this participant's own factual
          participation + a warm AI recap. No scores, no rank, no comparison.
          Self-gates on events.ai_enabled + a ready draft — renders a soft
          placeholder otherwise. */}
      <YourDayInTheHouseCard
        eventId={event.id}
        participantId={participant.id}
      />

      {/* ─── YOUR GROWTH (per-session AI coaching journey) ─────────────
          The self-improving loop's participant surface: an encouraging
          per-session timeline of coaching notes + the latest "focus for
          next time" pulled to the top. ZERO numbers, never reads scores,
          never comparative. Self-gates on events.ai_enabled; renders a soft
          placeholder until the first note is ready. */}
      <YourGrowthCard
        eventId={event.id}
        participantId={participant.id}
      />

      {/* Offline staleness stamp — only renders when the student is offline */}
      <OfflineStaleNote renderedAt={new Date().toISOString()} />

      {/* ─── ANNOUNCEMENTS (scrolling feed — sits above LIVE NOW) ─────
          Fully defensive: self-fetches the announcement channel, renders
          NOTHING on empty/error, and is wrapped in an error boundary so it
          can never take down the live ballot below it. */}
      <AnnouncementStrip eventId={event.id} participantId={participant.id} />

      {/* ─── LIVE NOW (realtime agenda + timer) ────────────────────── */}
      <LiveNowCard eventId={event.id} />

      {/* ─── VOTE NOW (live ballot, inline — no navigation to /me/vote) ─ */}
      <VoteClient initialSession={session} embedded />

      {/* ─── PRESIDING OFFICER — MOTION QUEUE (Speaker / Deputy Speaker) ─ */}
      {isPresiding && (
        <Link href="/yip/me/speaker" className="block">
          <Card className="border-amber-300/60 overflow-hidden transition-shadow hover:shadow-md">
            <div className="h-1 w-full bg-gradient-to-r from-amber-500 to-yellow-400" />
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <Gavel className="size-5 text-amber-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-gray-900">Preside — Motion Queue</h2>
                <p className="text-xs text-gray-500">
                  Admit, reject and put motions to the House
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ─── MINISTRY DESK (Cabinet minister / PM / Deputy PM / Shadow) ─ */}
      {isMinistryDesk && (
        <Link href="/yip/me/ministry" className="block">
          <Card className="border-blue-300/60 overflow-hidden transition-shadow hover:shadow-md">
            <div className="h-1 w-full bg-gradient-to-r from-blue-600 to-blue-400" />
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100">
                <Landmark className="size-5 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-gray-900">Ministry Desk</h2>
                <p className="text-xs text-gray-500">
                  Answer questions &amp; motions for your ministry
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ─── PRIME MINISTER'S DESK (PM / Deputy PM) ─────────────────── */}
      {isPMDesk && (
        <Link href="/yip/me/pm" className="block">
          <Card className="border-indigo-300/60 overflow-hidden transition-shadow hover:shadow-md">
            <div className="h-1 w-full bg-gradient-to-r from-indigo-600 to-violet-400" />
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                <Flag className="size-5 text-indigo-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-gray-900">Prime Minister&apos;s Desk</h2>
                <p className="text-xs text-gray-500">
                  Present government bills · answer any ministry
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ─── SHADOW MINISTER'S DESK (Shadow minister) ───────────────── */}
      {isShadowDesk && (
        <Link href="/yip/me/shadow" className="block">
          <Card className="border-slate-300/60 overflow-hidden transition-shadow hover:shadow-md">
            <div className="h-1 w-full bg-gradient-to-r from-slate-600 to-slate-400" />
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <Landmark className="size-5 text-slate-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-gray-900">Shadow Minister&apos;s Desk</h2>
                <p className="text-xs text-gray-500">
                  Track your ministry · file a counter
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ─── OPPOSITION DESK (Leader of Opposition) ─────────────────── */}
      {isOpposition && (
        <Link href="/yip/me/opposition" className="block">
          <Card className="border-red-300/60 overflow-hidden transition-shadow hover:shadow-md">
            <div className="h-1 w-full bg-gradient-to-r from-red-600 to-red-400" />
            <CardContent className="flex items-center gap-3 pt-4 pb-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100">
                <Megaphone className="size-5 text-red-700" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-gray-900">Opposition Desk</h2>
                <p className="text-xs text-gray-500">
                  Move a no-confidence motion · review government bills
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-gray-400" />
            </CardContent>
          </Card>
        </Link>
      )}

      {/* ─── YOUR YUVA & ORGANISER CONTACT ─────────────────────────── */}
      {(contacts.yuva.length > 0 || contacts.organisers.length > 0) && (
        <Card className="border-teal-200/50 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-teal-400 to-emerald-400" />
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <HeartHandshake className="size-5 text-teal-600" />
              <h2 className="text-sm font-bold text-gray-900">
                Your YUVA &amp; Organiser Contact
              </h2>
            </div>

            <div className="space-y-2.5">
              {contacts.yuva.map((y, idx) => (
                <ContactRow
                  key={`yuva-${idx}`}
                  name={y.volunteer_name}
                  sub={`YUVA · ${y.scope === "party" ? "Your Party" : y.scopeName}`}
                  phone={y.volunteer_phone}
                  accent="teal"
                />
              ))}

              {contacts.organisers.map((o, idx) => (
                <ContactRow
                  key={`org-${idx}`}
                  name={o.organiser_name}
                  sub={`Chapter Organiser${o.chapter_name ? ` · ${o.chapter_name}` : ""}`}
                  phone={o.organiser_phone}
                  email={o.organiser_email}
                  accent="orange"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── YOUR PARTY (privacy-safe roster — seat (constituency) number + constituency only) */}
      {partyRoster.length > 0 && (
        <Card className={partyAccent.border}>
          <div className={`h-1 w-full bg-gradient-to-r ${partyAccent.bar}`} />
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users className={`size-5 ${partyAccent.text}`} />
                <h2 className="text-sm font-bold text-gray-900">
                  Your Party
                  {side ? ` · ${side === "ruling" ? "Ruling" : "Opposition"}` : ""}
                </h2>
              </div>
              <span className="text-xs text-gray-400">
                {partyRoster.length} members
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {partyRoster.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 py-2 ${m.isSelf ? "rounded-md bg-amber-50 px-2 -mx-2" : ""}`}
                >
                  <span
                    className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${partyAccent.chip}`}
                  >
                    {m.constituency_number != null ? `#${m.constituency_number}` : "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 truncate">
                      {m.constituency_name
                        ? `${m.constituency_name}${m.constituency_state ? `, ${m.constituency_state}` : ""}`
                        : "Constituency not assigned"}
                    </p>
                  </div>
                  {m.isSelf && (
                    <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-white">
                      You
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 text-[11px] text-gray-400">
              Contact details are private. Reach members through your YUVA.
            </p>

            {/* Self-service "go Independent" — only a plain MP may leave their
                party themselves; role-holders must ask an organiser. */}
            {role === "mp" && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <GoIndependentButton
                  participantId={participant.id}
                  eventId={participant.event_id}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── YOUR PARTY MANIFESTO (this student's own party only) ──────
          Symbol + tagline + the 4-point manifesto the chapter set on the
          Parties page. Shown only when the party has any of these filled, and
          only for the viewer's OWN party — no other party's platform leaks. */}
      {partyDetails &&
        (partyDetails.symbol_url ||
          partyDetails.tagline ||
          partyDetails.manifesto.length > 0) && (
          <Card className={partyAccent.border}>
            <div className={`h-1 w-full bg-gradient-to-r ${partyAccent.bar}`} />
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 mb-3">
                {partyDetails.symbol_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={partyDetails.symbol_url}
                    alt={partyName ?? "Party symbol"}
                    className="size-11 shrink-0 rounded-lg border bg-white object-contain"
                  />
                ) : (
                  <span
                    className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg ${partyAccent.chip}`}
                  >
                    <Flag className="size-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 truncate">
                    {partyName ?? "Your Party"}
                  </h2>
                  {partyDetails.tagline && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {partyDetails.tagline}
                    </p>
                  )}
                </div>
              </div>

              {partyDetails.manifesto.length > 0 && (
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Our Manifesto
                  </p>
                  <ol className="space-y-2">
                    {partyDetails.manifesto.map((plank, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span
                          className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${partyAccent.chip}`}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-700 whitespace-pre-line">
                          {plank}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </CardContent>
          </Card>
        )}

      {/* ─── QUESTION HOUR ────────────────────────────────────────── */}
      <Card className="border-cyan-200/50 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 to-blue-400" />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-cyan-600" />
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Question Hour
                </h2>
                {questionCount > 0 ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    You submitted {questionCount} question
                    {questionCount !== 1 ? "s" : ""}
                    {myQuestions.some((q) => q.status === "approved") && (
                      <span className="text-green-600 ml-1">
                        ({myQuestions.filter((q) => q.status === "approved").length} approved)
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Submit questions for the Cabinet Ministers
                  </p>
                )}
              </div>
            </div>
            {canSubmitQuestions && (
              <Link
                href="/yip/me/questions"
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-3 py-1.5 text-sm font-medium text-cyan-700 hover:bg-cyan-100 transition-colors"
              >
                {questionCount > 0 ? "View" : "Submit"}
                <ChevronRight className="size-4" />
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── RAISE A MOTION ─────────────────────────────────────── */}
      <Card className="border-orange-200/50 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-orange-400 to-amber-400" />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="size-5 text-orange-600" />
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  Raise a Motion
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Submit parliamentary motions to the Speaker
                </p>
              </div>
            </div>
            <Link
              href="/yip/me/motion"
              className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
            >
              Open
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ─── BILL DRAFTING (committee members) ────────────── */}
      {/* ─── COMMITTEE REPORT (the step before the bill) ──────── */}
      {isCommitteeMember && (
        <Card className="border-amber-200/50 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-orange-400" />
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="size-5 text-amber-600" />
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Committee Report
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {reportSubmitted
                      ? "Submitted — your bill is unlocked"
                      : "Agree your findings + recommendations first"}
                  </p>
                </div>
              </div>
              <Link
                href="/yip/me/report"
                className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors"
              >
                {reportSubmitted ? "View" : "Write"}
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {isCommitteeMember && (
        <Card className="border-purple-200/50 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-purple-400 to-violet-400" />
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-purple-600" />
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Committee Room
                  </h2>
                  {myBill ? (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {myBill.title}{" "}
                      <span
                        className={
                          myBill.status === "submitted"
                            ? "text-blue-600"
                            : myBill.status === "approved"
                              ? "text-green-600"
                              : myBill.status === "rejected"
                                ? "text-red-600"
                                : myBill.status === "passed"
                                  ? "text-emerald-600"
                                  : "text-gray-500"
                        }
                      >
                        ({myBill.status ?? "drafting"})
                      </span>
                    </p>
                  ) : !reportSubmitted ? (
                    <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                      <Lock className="size-3" />
                      Locked until your report is submitted
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Draft your committee&apos;s bill
                    </p>
                  )}
                </div>
              </div>
              <Link
                href="/yip/me/bill"
                className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-100 transition-colors"
              >
                {myBill ? "View" : "Draft"}
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── BILLS (read-only for non-committee members) ──────── */}
      {!isCommitteeMember && approvedBills.length > 0 && (
        <Card className="border-purple-200/50 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-purple-400 to-violet-400" />
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="size-5 text-purple-600" />
              <h2 className="text-sm font-bold text-gray-900">
                Bills
              </h2>
            </div>
            <div className="space-y-3">
              {approvedBills.map((bill) => (
                <div
                  key={bill.id}
                  className={`rounded-lg border p-3 ${
                    bill.party_side === "ruling"
                      ? "border-blue-200 bg-blue-50/50"
                      : bill.party_side === "opposition"
                        ? "border-red-200 bg-red-50/50"
                        : "border-[#FF9933]/30 bg-[#FF9933]/5"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        bill.party_side === "ruling"
                          ? "bg-blue-600 text-white"
                          : bill.party_side === "opposition"
                            ? "bg-red-600 text-white"
                            : "bg-[#FF9933]/15 text-[#9a5212]"
                      }`}
                    >
                      {bill.committee_name ??
                        (bill.party_side === "ruling"
                          ? "Ruling"
                          : bill.party_side === "opposition"
                            ? "Opposition"
                            : "Committee Bill")}
                    </span>
                    {bill.status && (
                      <span
                        className={`text-[10px] font-medium ${
                          bill.status === "passed"
                            ? "text-emerald-600"
                            : bill.status === "rejected"
                              ? "text-red-600"
                              : "text-gray-500"
                        }`}
                      >
                        {bill.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">
                    {bill.title}
                  </p>
                  {bill.objective && (
                    <p className="text-xs text-gray-600 mt-1">
                      {bill.objective}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── FEEDBACK (post-event) ────────────────────────────── */}
      {(event.status === "day1_live" ||
        event.status === "day1_complete" ||
        event.status === "day2_live" ||
        event.status === "completed" ||
        event.status === "results_published") && (
        <Card className="border-emerald-200/50 overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-teal-400" />
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircleHeart className="size-5 text-emerald-600" />
                <div>
                  <h2 className="text-sm font-bold text-gray-900">
                    Share Your Feedback
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    How was the YIP experience? Takes ~2 min
                  </p>
                </div>
              </div>
              <Link
                href="/yip/me/feedback"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                Open
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── MY YIP JOURNEY (cross-round identity) ────────────── */}
      <Card className="border-indigo-200/50 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-400 to-blue-400" />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-indigo-600" />
              <div>
                <h2 className="text-sm font-bold text-gray-900">My YIP Journey</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Every round you've been part of — chapter to national
                </p>
              </div>
            </div>
            <Link
              href="/yip/me/journey"
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
            >
              Open
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ─── LEARN YIP (prep resources) ─────────────────────────── */}
      <Card className="border-[#FF9933]/20 bg-gradient-to-br from-[#FF9933]/5 via-white to-[#138808]/5 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-[#FF9933] via-white to-[#138808]" />
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-[#FF9933]" />
              <div>
                <h2 className="text-sm font-bold text-gray-900">Learn YIP</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Oath · FAQs · Sample script · PRS / CPR references
                </p>
              </div>
            </div>
            <Link
              href="/yip/me/learn"
              className="inline-flex items-center gap-1 rounded-lg bg-[#FF9933]/10 px-3 py-1.5 text-sm font-medium text-[#FF9933] hover:bg-[#FF9933]/20 transition-colors"
            >
              Open
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* ─── SKILL PROFILE (Phase 19/F) ──────────────────────────── */}
      <SkillProfileCard profile={skillProfile} />

      {/* ─── RESULTS (if published) ─────────────────────────────── */}
      {event.results_published_at ? (
        result ? (
          <div className="space-y-4">
            {/* Result Hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 shadow-lg ring-1 ring-amber-200/60">
              <div className="px-5 py-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="size-5 text-amber-600" />
                  <h2 className="text-base font-bold text-gray-900">
                    Your Results
                  </h2>
                </div>

                {/* Rank only — raw scores are intentionally not shown to students */}
                {result.rank != null ? (
                  <div className="flex items-baseline gap-2">
                    <p className="text-5xl font-black text-amber-600">
                      #{result.rank}
                    </p>
                    <p className="text-sm text-gray-500">Your Rank</p>
                  </div>
                ) : result.award_category?.startsWith("Not ranked") ? (
                  // Day-incomplete: attended only one day of a two-day event.
                  // Excluded from rank + awards, but told clearly why.
                  <p className="text-sm font-medium text-red-600">
                    {result.award_category} — please contact your chapter
                    organiser if this is a mistake.
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    Your rank will be announced at the Valedictory Session.
                  </p>
                )}

                {/* Award Badges — never render the "Not ranked" status as an award */}
                {result.award_category &&
                  !result.award_category.startsWith("Not ranked") && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.award_category.split(", ").map((award) => (
                        <span
                          key={award}
                          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                        >
                          <Award className="size-3.5" />
                          {award}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>
        ) : (
          <Card className="border-gray-200">
            <CardContent className="pt-5 text-center py-8">
              <Trophy className="mx-auto size-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">
                Results have been published but no scores were recorded for your role.
              </p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card className="border-amber-200/50 bg-amber-50/30">
          <CardContent className="pt-5 text-center py-8">
            <Clock className="mx-auto size-10 text-amber-400 mb-3" />
            <p className="font-medium text-gray-700">
              Results Not Yet Published
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Results will be announced at the Valedictory Session
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── EVENT SCHEDULE ─────────────────────────────────────── */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
          <Clock className="size-4 text-[#FF9933]" />
          Event Schedule
        </h2>

        {/* Day 1 */}
        <AgendaTimeline
          dayLabel="Day 1"
          dateLabel={formatDate(event.day1_date)}
          items={
            day1Items.length > 0
              ? day1Items.map((a) => ({
                  title: a.title,
                  duration: a.duration_minutes ?? 0,
                  type: a.agenda_type ?? "",
                  mode: (a.mode as "party" | "committee" | "mixed" | null) ?? null,
                }))
              : DEFAULT_AGENDA_TEMPLATE.day1.map((a) => ({
                  title: a.title,
                  duration: a.duration,
                  type: a.type,
                  mode: a.mode,
                }))
          }
        />

        {/* Day 2 */}
        <AgendaTimeline
          dayLabel="Day 2"
          dateLabel={formatDate(event.day2_date)}
          items={
            day2Items.length > 0
              ? day2Items.map((a) => ({
                  title: a.title,
                  duration: a.duration_minutes ?? 0,
                  type: a.agenda_type ?? "",
                  mode: (a.mode as "party" | "committee" | "mixed" | null) ?? null,
                }))
              : DEFAULT_AGENDA_TEMPLATE.day2.map((a) => ({
                  title: a.title,
                  duration: a.duration,
                  type: a.type,
                  mode: a.mode,
                }))
          }
        />
      </div>
    </div>
  );
}

// ─── Detail Item ─────────────────────────────────────────────────

function DetailItem({
  icon: Icon,
  label,
  value,
  fullWidth,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-2" : ""}>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">
        {label}
      </p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <Icon className="size-3.5 text-gray-400 shrink-0" />
        <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
      </div>
    </div>
  );
}

// ─── Contact Row (YUVA / organiser, tap-to-call or email) ────────

function ContactRow({
  name,
  sub,
  phone,
  email,
  accent,
}: {
  name: string;
  sub: string;
  phone?: string | null;
  email?: string | null;
  accent: "teal" | "orange";
}) {
  const ring =
    accent === "teal"
      ? "bg-teal-100 text-teal-700"
      : "bg-[#FF9933]/15 text-[#E68A2E]";

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${ring}`}
        >
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
          <p className="text-[11px] text-gray-500 truncate">{sub}</p>
        </div>
      </div>
      {phone ? (
        <a
          href={`tel:${phone}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
        >
          <Phone className="size-4" />
          Call
        </a>
      ) : email ? (
        <a
          href={`mailto:${email}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <Mail className="size-4" />
          Email
        </a>
      ) : (
        <span className="shrink-0 text-[11px] text-gray-400">No contact</span>
      )}
    </div>
  );
}

// ─── Agenda Timeline ─────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  registration: "bg-blue-400",
  inaugural: "bg-purple-400",
  speaker_election: "bg-amber-400",
  party_formation: "bg-indigo-400",
  oath_taking: "bg-emerald-400",
  cabinet_intro: "bg-teal-400",
  break: "bg-gray-300",
  opening_speech: "bg-[#FF9933]",
  debate: "bg-red-400",
  committee_discussion: "bg-violet-400",
  question_hour: "bg-cyan-400",
  zero_hour: "bg-orange-400",
  bill_presentation: "bg-green-500",
  valedictory: "bg-amber-500",
  adjournment: "bg-slate-400",
};

function AgendaTimeline({
  dayLabel,
  dateLabel,
  items,
}: {
  dayLabel: string;
  dateLabel: string;
  items: Array<{
    title: string;
    duration: number;
    type: string;
    mode?: "party" | "committee" | "mixed" | null;
  }>;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-800">{dayLabel}</h3>
          <span className="text-xs text-gray-500">{dateLabel}</span>
        </div>
        <div className="relative space-y-0">
          {items.map((item, idx) => {
            const dotColor = TYPE_COLORS[item.type] ?? "bg-gray-400";
            const isLast = idx === items.length - 1;
            const isBreak = item.type === "break";

            return (
              <div key={idx} className="flex gap-3">
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`size-2.5 rounded-full ${dotColor} shrink-0 mt-1.5`}
                  />
                  {!isLast && (
                    <div className="w-px flex-1 bg-gray-200 min-h-[20px]" />
                  )}
                </div>

                {/* Content */}
                <div className={`pb-3 min-w-0 ${isBreak ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={`text-sm leading-snug ${
                        isBreak
                          ? "text-gray-400 italic"
                          : "text-gray-800 font-medium"
                      }`}
                    >
                      {item.title}
                    </p>
                    {item.mode === "committee" && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200">
                        Committee
                      </span>
                    )}
                    {item.mode === "party" && !isBreak && item.type !== "inaugural" && item.type !== "valedictory" && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
                        Party Mode
                      </span>
                    )}
                  </div>
                  {item.duration > 0 && (
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {item.duration} min
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
