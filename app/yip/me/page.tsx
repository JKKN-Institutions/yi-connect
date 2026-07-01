import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clauseTexts } from "@/lib/yip/bill-provisions";
import {
  isGoIndependentClosed,
  BILL_DRAFTING_SESSION_KEY,
} from "@/lib/yip/go-independent";
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
  Users,
  Landmark,
  BookOpen,
  MessageSquare,
  MessageCircleHeart,
  FileText,
  ChevronRight,
  ChevronDown,
  Megaphone,
  Gavel,
  Phone,
  Mail,
  UserRound,
  HeartHandshake,
  Flag,
} from "lucide-react";
import { VoteClient } from "./vote/vote-client";
import { GoIndependentButton } from "./go-independent-button";
import { LiveNowCard } from "./live-now-card";
import { HeroCredential } from "./hero-credential";
import { AnnouncementStrip } from "./announcement-strip";
import { PushToggle } from "@/components/yip/push-toggle";
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
import { SectionShell, SectionHeading, INK, SAFFRON, GREEN, GOLD, SERIF, inkA } from "./credential-ui";

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
  // page) so the dashboard can show "Committee N — topic" + the scheme.
  let committeeTopic: string | null = null;
  let committeeScheme: string | null = null;
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

  // "Go Independent" window: a plain MP may leave their party only until the
  // Committee (Bill Drafting) session ends. Same rule the server action enforces
  // (lib/yip/go-independent). Fetch the drafting session's status and close the
  // button once it's over (or by day 2).
  const { data: draftRows } = await supabase
    .from("agenda")
    .select("status")
    .eq("event_id", event.id)
    .eq("session_key", BILL_DRAFTING_SESSION_KEY);
  const goIndependentClosed = isGoIndependentClosed(
    event.status,
    (draftRows ?? []).map((r) => r.status as string | null)
  );
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
  const partySideColor =
    side === "ruling" ? GREEN : side === "opposition" ? "#9A3324" : SAFFRON;
  const roleLabel = role ? ROLE_LABELS[role] ?? role : null;
  const isPresiding = role === "speaker" || role === "deputy_speaker";
  const isMinistryDesk = role === "cabinet_minister";
  const isPMDesk = role === "prime_minister" || role === "deputy_prime_minister";
  const isShadowDesk = role === "shadow_minister";
  const isOpposition = role === "leader_of_opposition";
  // Masthead stamp for the credential hero — e.g. "ERODE · 2026".
  const stampChapter = (event.name?.split(/\s+/)[0] ?? "").toUpperCase();
  const stampYear = event.day1_date
    ? new Date(event.day1_date).getFullYear()
    : "";
  const sessionStamp = [stampChapter, stampYear].filter(Boolean).join(" · ");

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

      {/* ─── HERO — THE MEMBER'S CREDENTIAL ──────────────────────── */}
      <HeroCredential
        name={participant.full_name}
        roleLabel={roleLabel}
        side={side}
        partyName={partyName}
        partyNumber={participant.party_number}
        schoolDisplay={schoolDisplay}
        constituencyName={participant.constituency_name}
        constituencyState={participant.constituency_state}
        constituencyNumber={participant.constituency_number}
        ministryLabel={
          participant.ministry ? getMinistryLabel(participant.ministry) : null
        }
        committeeName={participant.committee_name}
        committeeNumber={participant.committee_number}
        committeeTopic={committeeTopic}
        committeeScheme={committeeScheme}
        sessionStamp={sessionStamp}
      />

      {/* ─── THE SESSION (event info) ────────────────────────────── */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: "#ffffff", border: "1px solid #1a1a3e14" }}
      >
        <div className="px-5 py-4">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: "#C2691A" }}
          >
            The Session
          </p>
          <h2
            className="mt-1 text-[18px] font-semibold leading-snug"
            style={{
              fontFamily: "var(--font-heading), ui-serif, Georgia, serif",
              color: "#1a1a3e",
            }}
          >
            {event.name}
          </h2>
          <div className="mt-3.5 space-y-2.5 text-[13px]">
            <div className="flex items-center gap-2.5" style={{ color: "#1a1a3eb3" }}>
              <Calendar className="size-4 shrink-0" style={{ color: "#C2691A" }} />
              <span className="font-mono text-[10px] tracking-wide" style={{ color: "#1a1a3e80" }}>
                DAY 1
              </span>
              <span>{formatDate(event.day1_date)}</span>
            </div>
            <div className="flex items-center gap-2.5" style={{ color: "#1a1a3eb3" }}>
              <Calendar className="size-4 shrink-0" style={{ color: "#C2691A" }} />
              <span className="font-mono text-[10px] tracking-wide" style={{ color: "#1a1a3e80" }}>
                DAY 2
              </span>
              <span>{formatDate(event.day2_date)}</span>
            </div>
            {event.venue_name && (
              <div className="flex items-start gap-2.5" style={{ color: "#1a1a3eb3" }}>
                <MapPin className="mt-0.5 size-4 shrink-0" style={{ color: "#C2691A" }} />
                <span>
                  {event.venue_name}
                  {event.venue_address ? `, ${event.venue_address}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

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

      {/* Push opt-in — get pinged when someone @mentions you in chat. */}
      <PushToggle participantId={participant.id} eventId={event.id} />

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
          <SectionShell accent={GOLD} className="transition-shadow hover:shadow-md">
            <div className="px-5 py-4">
              <SectionHeading
                eyebrow="Preside"
                title="Motion Queue"
                icon={Gavel}
                accent={GOLD}
                trailing={<ChevronRight className="size-5" style={{ color: inkA(0.35) }} />}
              />
              <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
                Admit, reject and put motions to the House
              </p>
            </div>
          </SectionShell>
        </Link>
      )}

      {/* ─── MINISTRY DESK (Cabinet minister / PM / Deputy PM / Shadow) ─ */}
      {isMinistryDesk && (
        <Link href="/yip/me/ministry" className="block">
          <SectionShell accent={GREEN} className="transition-shadow hover:shadow-md">
            <div className="px-5 py-4">
              <SectionHeading
                eyebrow="Ministry"
                title="Ministry Desk"
                icon={Landmark}
                accent={GREEN}
                trailing={<ChevronRight className="size-5" style={{ color: inkA(0.35) }} />}
              />
              <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
                Answer questions &amp; motions for your ministry
              </p>
            </div>
          </SectionShell>
        </Link>
      )}

      {/* ─── PRIME MINISTER'S DESK (PM / Deputy PM) ─────────────────── */}
      {isPMDesk && (
        <Link href="/yip/me/pm" className="block">
          <SectionShell accent={GREEN} className="transition-shadow hover:shadow-md">
            <div className="px-5 py-4">
              <SectionHeading
                eyebrow="Executive"
                title="Prime Minister's Desk"
                icon={Flag}
                accent={GREEN}
                trailing={<ChevronRight className="size-5" style={{ color: inkA(0.35) }} />}
              />
              <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
                Present government bills · answer any ministry
              </p>
            </div>
          </SectionShell>
        </Link>
      )}

      {/* ─── SHADOW MINISTER'S DESK (Shadow minister) ───────────────── */}
      {isShadowDesk && (
        <Link href="/yip/me/shadow" className="block">
          <SectionShell accent="#9A3324" className="transition-shadow hover:shadow-md">
            <div className="px-5 py-4">
              <SectionHeading
                eyebrow="Shadow"
                title="Shadow Minister's Desk"
                icon={Landmark}
                accent="#9A3324"
                trailing={<ChevronRight className="size-5" style={{ color: inkA(0.35) }} />}
              />
              <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
                Track your ministry · file a counter
              </p>
            </div>
          </SectionShell>
        </Link>
      )}

      {/* ─── OPPOSITION DESK (Leader of Opposition) ─────────────────── */}
      {isOpposition && (
        <Link href="/yip/me/opposition" className="block">
          <SectionShell accent="#9A3324" className="transition-shadow hover:shadow-md">
            <div className="px-5 py-4">
              <SectionHeading
                eyebrow="Opposition"
                title="Opposition Desk"
                icon={Megaphone}
                accent="#9A3324"
                trailing={<ChevronRight className="size-5" style={{ color: inkA(0.35) }} />}
              />
              <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
                Move a no-confidence motion · review government bills
              </p>
            </div>
          </SectionShell>
        </Link>
      )}

      {/* ─── YOUR YUVA & ORGANISER CONTACT ─────────────────────────── */}
      {(contacts.yuva.length > 0 || contacts.organisers.length > 0) && (
        <SectionShell accent={SAFFRON}>
          <div className="px-5 py-4">
            <SectionHeading
              eyebrow="Support"
              title="Your YUVA & Organiser"
              icon={HeartHandshake}
              accent={SAFFRON}
            />
            <div className="mt-3.5 space-y-2.5">
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
          </div>
        </SectionShell>
      )}

      {/* ─── YOUR PARTY (collapsible roster — name + constituency; no contact PII) */}
      {partyRoster.length > 0 && (
        <SectionShell accent={partySideColor}>
          {/* Native <details> = collapsible with zero client JS. Collapsed by
              default so a full party (25+) doesn't dominate the page. */}
          <details className="roster-details">
            <style>{`.roster-details[open] .roster-chevron{transform:rotate(180deg)}`}</style>
            <summary className="cursor-pointer list-none px-5 py-4 [&::-webkit-details-marker]:hidden">
              <SectionHeading
                eyebrow="Your Party"
                title={`Your Party${side ? ` · ${side === "ruling" ? "Ruling" : "Opposition"}` : ""}`}
                icon={Users}
                accent={partySideColor}
                trailing={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] tracking-wide" style={{ color: inkA(0.45) }}>
                      {partyRoster.length} members
                    </span>
                    <ChevronDown
                      className="roster-chevron size-4 transition-transform"
                      style={{ color: inkA(0.4) }}
                    />
                  </span>
                }
              />
            </summary>

            <div className="px-5 pb-4">
              <div className="divide-y" style={{ borderColor: inkA(0.06) }}>
                {partyRoster.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 py-2"
                    style={m.isSelf ? { background: `${GOLD}14`, borderRadius: "6px", margin: "0 -8px", padding: "6px 8px" } : undefined}
                  >
                    <span
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                      style={{ background: `${partySideColor}18`, color: partySideColor }}
                    >
                      {m.constituency_number != null ? `#${m.constituency_number}` : "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: inkA(0.85) }}>
                        {m.full_name || "Member"}
                      </p>
                      <p className="truncate text-xs" style={{ color: inkA(0.5) }}>
                        {m.constituency_name
                          ? `${m.constituency_name}${m.constituency_state ? `, ${m.constituency_state}` : ""}`
                          : "Constituency not assigned"}
                      </p>
                    </div>
                    {m.isSelf && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: GOLD }}
                      >
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[11px]" style={{ color: inkA(0.4) }}>
                Contact details are private. Reach members through your YUVA.
              </p>
            </div>
          </details>

          {/* Self-service "go Independent" — only a plain MP may leave their
              party themselves; role-holders must ask an organiser. Kept outside
              the collapse so it's always reachable. Closes once Committee (Bill
              Drafting) is over (goIndependentClosed). */}
          {role === "mp" && !goIndependentClosed && (
            <div className="px-5 pb-4">
              <div className="pt-3" style={{ borderTop: `1px solid ${inkA(0.08)}` }}>
                <GoIndependentButton
                  participantId={participant.id}
                  eventId={participant.event_id}
                />
              </div>
            </div>
          )}
          {role === "mp" && goIndependentClosed && (
            <div className="px-5 pb-4">
              <div className="pt-3" style={{ borderTop: `1px solid ${inkA(0.08)}` }}>
                <p className="text-xs" style={{ color: inkA(0.4) }}>
                  Switching to Independent has closed for this event (Committee
                  Bill Drafting is over).
                </p>
              </div>
            </div>
          )}
        </SectionShell>
      )}

      {/* ─── YOUR PARTY MANIFESTO (this student's own party only) ──────
          Symbol + tagline + the 4-point manifesto the chapter set on the
          Parties page. Shown only when the party has any of these filled, and
          only for the viewer's OWN party — no other party's platform leaks. */}
      {partyDetails &&
        (partyDetails.symbol_url ||
          partyDetails.tagline ||
          partyDetails.manifesto.length > 0) && (
          <SectionShell accent={partySideColor}>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3 mb-3.5">
                {partyDetails.symbol_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={partyDetails.symbol_url}
                    alt={partyName ?? "Party symbol"}
                    className="size-11 shrink-0 rounded-lg bg-white object-contain"
                    style={{ border: `1px solid ${inkA(0.1)}` }}
                  />
                ) : (
                  <span
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${partySideColor}18`, color: partySideColor }}
                  >
                    <Flag className="size-5" />
                  </span>
                )}
                <div className="min-w-0">
                  <SectionHeading
                    eyebrow="Platform"
                    title={partyName ?? "Your Party"}
                    accent={partySideColor}
                  />
                  {partyDetails.tagline && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: inkA(0.55) }}>
                      {partyDetails.tagline}
                    </p>
                  )}
                </div>
              </div>

              {partyDetails.manifesto.length > 0 && (
                <>
                  <p
                    className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5"
                    style={{ color: inkA(0.4) }}
                  >
                    Our Manifesto
                  </p>
                  <ol className="space-y-2.5">
                    {partyDetails.manifesto.map((plank, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                          style={{ background: `${partySideColor}18`, color: partySideColor }}
                        >
                          {i + 1}
                        </span>
                        <span className="text-sm whitespace-pre-line" style={{ color: inkA(0.75) }}>
                          {plank}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </SectionShell>
        )}

      {/* ─── QUESTION HOUR ────────────────────────────────────────── */}
      <SectionShell accent={SAFFRON}>
        <div className="px-5 py-4">
          <SectionHeading
            eyebrow="Your Questions"
            title="Question Hour"
            icon={MessageSquare}
            accent={SAFFRON}
            trailing={
              canSubmitQuestions ? (
                <Link
                  href="/yip/me/questions"
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{ background: `${SAFFRON}14`, color: SAFFRON }}
                >
                  {questionCount > 0 ? "View" : "Submit"}
                  <ChevronRight className="size-4" />
                </Link>
              ) : undefined
            }
          />
          <div className="mt-1.5">
            {questionCount > 0 ? (
              <p className="text-xs" style={{ color: inkA(0.55) }}>
                You submitted {questionCount} question
                {questionCount !== 1 ? "s" : ""}
                {myQuestions.some((q) => q.status === "approved") && (
                  <span className="ml-1 font-medium" style={{ color: GREEN }}>
                    ({myQuestions.filter((q) => q.status === "approved").length} approved)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs" style={{ color: inkA(0.55) }}>
                Submit questions for the Cabinet Ministers
              </p>
            )}
          </div>
        </div>
      </SectionShell>

      {/* ─── RAISE A MOTION ─────────────────────────────────────── */}
      <SectionShell accent={SAFFRON}>
        <div className="px-5 py-4">
          <SectionHeading
            eyebrow="Floor Business"
            title="Raise a Motion"
            icon={Megaphone}
            accent={SAFFRON}
            trailing={
              <Link
                href="/yip/me/motion"
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ background: `${SAFFRON}14`, color: SAFFRON }}
              >
                Open
                <ChevronRight className="size-4" />
              </Link>
            }
          />
          <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
            Submit parliamentary motions to the Speaker
          </p>
        </div>
      </SectionShell>

      {/* ─── BILL DRAFTING (committee members) ────────────── */}
      {/* Committee Report card removed 2026-06-30 — per the YIP 2026 handbook the
          committee's deliverable is the BILL, not a report. Committees draft
          their bill directly; the report step no longer exists. */}
      {isCommitteeMember && (
        <SectionShell accent={GOLD}>
          <div className="px-5 py-4">
            <SectionHeading
              eyebrow="Legislation"
              title="Committee Room"
              icon={FileText}
              accent={GOLD}
              trailing={
                <Link
                  href="/yip/me/bill"
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{ background: `${GOLD}18`, color: GOLD }}
                >
                  {myBill ? "View" : "Draft"}
                  <ChevronRight className="size-4" />
                </Link>
              }
            />
            <div className="mt-1.5">
              {myBill ? (
                <p className="text-xs" style={{ color: inkA(0.55) }}>
                  {myBill.title}{" "}
                  <span
                    style={{
                      color:
                        myBill.status === "submitted"
                          ? "#2563eb"
                          : myBill.status === "approved"
                            ? GREEN
                            : myBill.status === "rejected"
                              ? "#9A3324"
                              : myBill.status === "passed"
                                ? GREEN
                                : inkA(0.5),
                    }}
                  >
                    ({myBill.status ?? "drafting"})
                  </span>
                </p>
              ) : (
                <p className="text-xs" style={{ color: inkA(0.55) }}>
                  Draft your committee&apos;s bill
                </p>
              )}
            </div>
          </div>
        </SectionShell>
      )}

      {/* ─── BILLS (read-only for non-committee members) ──────── */}
      {!isCommitteeMember && approvedBills.length > 0 && (
        <SectionShell accent={SAFFRON}>
          <div className="px-5 py-4">
            <SectionHeading eyebrow="Legislation" title="Bills" icon={FileText} accent={SAFFRON} />
            <div className="mt-3.5 space-y-2.5">
              {approvedBills.map((bill) => (
                <div
                  key={bill.id}
                  className="rounded-xl p-3"
                  style={{
                    background:
                      bill.party_side === "ruling"
                        ? `${GREEN}0d`
                        : bill.party_side === "opposition"
                          ? "#9A332412"
                          : `${SAFFRON}0d`,
                    border: `1px solid ${
                      bill.party_side === "ruling"
                        ? `${GREEN}30`
                        : bill.party_side === "opposition"
                          ? "#9A332430"
                          : `${SAFFRON}30`
                    }`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{
                        background:
                          bill.party_side === "ruling"
                            ? GREEN
                            : bill.party_side === "opposition"
                              ? "#9A3324"
                              : SAFFRON,
                      }}
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
                        className="font-mono text-[10px] tracking-wide"
                        style={{
                          color:
                            bill.status === "passed"
                              ? GREEN
                              : bill.status === "rejected"
                                ? "#9A3324"
                                : inkA(0.45),
                        }}
                      >
                        {bill.status}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold" style={{ color: INK }}>
                    {bill.title}
                  </p>
                  {bill.objective && (
                    <p className="text-xs mt-1" style={{ color: inkA(0.65) }}>
                      {bill.objective}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </SectionShell>
      )}

      {/* ─── FEEDBACK (post-event) ────────────────────────────── */}
      {(event.status === "day1_live" ||
        event.status === "day1_complete" ||
        event.status === "day2_live" ||
        event.status === "completed" ||
        event.status === "results_published") && (
        <SectionShell accent={GREEN}>
          <div className="px-5 py-4">
            <SectionHeading
              eyebrow="Feedback"
              title="Share Your Feedback"
              icon={MessageCircleHeart}
              accent={GREEN}
              trailing={
                <Link
                  href="/yip/me/feedback"
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{ background: `${GREEN}14`, color: GREEN }}
                >
                  Open
                  <ChevronRight className="size-4" />
                </Link>
              }
            />
            <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
              How was the YIP experience? Takes ~2 min
            </p>
          </div>
        </SectionShell>
      )}

      {/* ─── MY YIP JOURNEY (cross-round identity) ────────────── */}
      <SectionShell accent={SAFFRON}>
        <div className="px-5 py-4">
          <SectionHeading
            eyebrow="Your Journey"
            title="My YIP Journey"
            icon={Trophy}
            accent={SAFFRON}
            trailing={
              <Link
                href="/yip/me/journey"
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ background: `${SAFFRON}14`, color: SAFFRON }}
              >
                Open
                <ChevronRight className="size-4" />
              </Link>
            }
          />
          <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
            Every round you&apos;ve been part of — chapter to national
          </p>
        </div>
      </SectionShell>

      {/* ─── LEARN YIP (prep resources) ─────────────────────────── */}
      <SectionShell accent={SAFFRON}>
        <div className="px-5 py-4">
          <SectionHeading
            eyebrow="Resources"
            title="Learn YIP"
            icon={BookOpen}
            accent={SAFFRON}
            trailing={
              <Link
                href="/yip/me/learn"
                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                style={{ background: `${SAFFRON}14`, color: SAFFRON }}
              >
                Open
                <ChevronRight className="size-4" />
              </Link>
            }
          />
          <p className="mt-1.5 text-xs" style={{ color: inkA(0.55) }}>
            Oath · FAQs · Sample script · PRS / CPR references
          </p>
        </div>
      </SectionShell>

      {/* ─── SKILL PROFILE (Phase 19/F) ──────────────────────────── */}
      <SkillProfileCard profile={skillProfile} />

      {/* ─── RESULTS (if published) ─────────────────────────────── */}
      {event.results_published_at ? (
        result ? (
          <div className="space-y-4">
            {/* Result Hero */}
            <SectionShell accent={GOLD}>
              <div className="px-5 py-6">
                <SectionHeading eyebrow="Results" title="Your Results" icon={Trophy} accent={GOLD} />

                {/* Rank only — raw scores are intentionally not shown to students */}
                <div className="mt-4">
                  {result.rank != null ? (
                    <div className="flex items-baseline gap-2">
                      <p className="text-5xl font-black" style={{ color: GOLD }}>
                        #{result.rank}
                      </p>
                      <p className="font-mono text-[11px] tracking-wide" style={{ color: inkA(0.5) }}>Your Rank</p>
                    </div>
                  ) : result.award_category?.startsWith("Not ranked") ? (
                    // Day-incomplete: attended only one day of a two-day event.
                    // Excluded from rank + awards, but told clearly why.
                    <p className="text-sm font-medium" style={{ color: "#9A3324" }}>
                      {result.award_category} — please contact your chapter
                      organiser if this is a mistake.
                    </p>
                  ) : (
                    <p className="text-sm" style={{ color: inkA(0.6) }}>
                      Your rank will be announced at the Valedictory Session.
                    </p>
                  )}
                </div>

                {/* Award Badges — never render the "Not ranked" status as an award */}
                {result.award_category &&
                  !result.award_category.startsWith("Not ranked") && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {result.award_category.split(", ").map((award) => (
                        <span
                          key={award}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
                          style={{ background: GOLD }}
                        >
                          <Award className="size-3.5" />
                          {award}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            </SectionShell>
          </div>
        ) : (
          <SectionShell>
            <div className="px-5 py-8 text-center">
              <Trophy className="mx-auto size-10 mb-3" style={{ color: inkA(0.2) }} />
              <p className="text-sm" style={{ color: inkA(0.55) }}>
                Results have been published but no scores were recorded for your role.
              </p>
            </div>
          </SectionShell>
        )
      ) : (
        <SectionShell accent={GOLD}>
          <div className="px-5 py-8 text-center">
            <Clock className="mx-auto size-10 mb-3" style={{ color: `${GOLD}99` }} />
            <p className="font-semibold" style={{ ...SERIF, color: INK }}>
              Results Not Yet Published
            </p>
            <p className="text-sm mt-1" style={{ color: inkA(0.55) }}>
              Results will be announced at the Valedictory Session
            </p>
          </div>
        </SectionShell>
      )}

      {/* ─── EVENT SCHEDULE ─────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `${SAFFRON}1f` }}
          >
            <Clock className="size-4" style={{ color: SAFFRON }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: SAFFRON }}>
              Schedule
            </p>
            <h2 className="text-[16px] font-semibold leading-snug" style={{ ...SERIF, color: INK }}>
              Event Schedule
            </h2>
          </div>
        </div>

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
  const accentColor = accent === "teal" ? GREEN : SAFFRON;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
      style={{ background: inkA(0.03), border: `1px solid ${inkA(0.07)}` }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${accentColor}18`, color: accentColor }}
        >
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: INK }}>{name}</p>
          <p className="text-[11px] truncate" style={{ color: inkA(0.5) }}>{sub}</p>
        </div>
      </div>
      {phone ? (
        <a
          href={`tel:${phone}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ background: `${GREEN}14`, color: GREEN }}
        >
          <Phone className="size-4" />
          Call
        </a>
      ) : email ? (
        <a
          href={`mailto:${email}`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
          style={{ background: `${SAFFRON}14`, color: SAFFRON }}
        >
          <Mail className="size-4" />
          Email
        </a>
      ) : (
        <span className="shrink-0 text-[11px]" style={{ color: inkA(0.4) }}>No contact</span>
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
    <SectionShell>
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <span
            className="font-mono text-[11px] font-bold uppercase tracking-[0.12em]"
            style={{ color: INK }}
          >
            {dayLabel}
          </span>
          <span
            className="font-mono text-[10px] tracking-wide"
            style={{ color: inkA(0.45) }}
          >
            {dateLabel}
          </span>
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
                    <div
                      className="w-px flex-1 min-h-[20px]"
                      style={{ background: inkA(0.1) }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={`pb-3 min-w-0 ${isBreak ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className="text-sm leading-snug"
                      style={{
                        color: isBreak ? inkA(0.35) : inkA(0.8),
                        fontStyle: isBreak ? "italic" : undefined,
                        fontWeight: isBreak ? undefined : 500,
                      }}
                    >
                      {item.title}
                    </p>
                    {item.mode === "committee" && (
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: `${GOLD}20`,
                          color: GOLD,
                          border: `1px solid ${GOLD}40`,
                        }}
                      >
                        Committee
                      </span>
                    )}
                    {item.mode === "party" && !isBreak && item.type !== "inaugural" && item.type !== "valedictory" && (
                      <span
                        className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{
                          background: `${GREEN}14`,
                          color: GREEN,
                          border: `1px solid ${GREEN}35`,
                        }}
                      >
                        Party Mode
                      </span>
                    )}
                  </div>
                  {item.duration > 0 && (
                    <p className="font-mono text-[10px] mt-0.5" style={{ color: inkA(0.4) }}>
                      {item.duration} min
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}
