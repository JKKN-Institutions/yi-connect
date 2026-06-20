"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/yip/utils";
import { ROLE_LABELS, PARTY_COLORS, MINISTRIES, OATH_TEXT } from "@/lib/yip/constants";
import { useRealtimeEvent } from "@/lib/yip/hooks/use-realtime-event";
import { useVoteSession } from "@/lib/yip/hooks/use-vote-session";
import { useTimer } from "@/lib/yip/hooks/use-timer";
import { useLiveBanner } from "@/lib/yip/hooks/use-live-banner";
import { createClient } from "@/lib/yip/supabase/client";
import { eventPrivacyMasked, maskName } from "@/lib/yip/pii";

interface SpeakerInfo {
  id: string;
  full_name: string;
  parliament_role: string | null;
  party_side: string | null;
  constituency_name: string | null;
  constituency_state: string | null;
  school_name: string;
}

interface QuestionDisplayInfo {
  question_text: string;
  directed_to_ministry: string;
  question_type: string | null;
  submitter_name: string;
  submitter_party: string | null;
  submitter_constituency: string | null;
}

function getMinistryLabel(key: string): string {
  const found = MINISTRIES.find((m) => m.key === key);
  return found ? found.label : key;
}

interface VoteCandidateInfo {
  id: string;
  full_name: string;
  school_name: string;
}

interface BillDisplayInfo {
  id: string;
  title: string;
  objective: string | null;
  party_side: string;
  provisions: string[];
  status: string | null;
  presenter_1_name: string | null;
  presenter_2_name: string | null;
}

export function ProjectorDisplay({ eventId }: { eventId: string }) {
  const { event, currentAgendaItem, loading } = useRealtimeEvent(eventId);
  const [currentSpeaker, setCurrentSpeaker] = useState<SpeakerInfo | null>(
    null
  );
  const [currentQuestionDisplay, setCurrentQuestionDisplay] =
    useState<QuestionDisplayInfo | null>(null);
  const [voteCandidates, setVoteCandidates] = useState<VoteCandidateInfo[]>([]);
  const [voteBillTitle, setVoteBillTitle] = useState<string | null>(null);
  // Subject of a motion floor vote (No-Confidence / Impeach) — carried in the
  // session config so the projector needs no extra (RLS-gated) motions read.
  const [motionVoteSubject, setMotionVoteSubject] = useState<string | null>(null);
  const [presentedBill, setPresentedBill] = useState<BillDisplayInfo | null>(null);
  const supabase = createClient();

  // DPDP live masking. The projector is PUBLIC, so when the event is in privacy
  // mode we replace participant names with stable pseudonyms before they ever
  // reach React state — no render site can then leak a name. Fail-safe: while
  // `event` is still loading (null) default to masked, so a privacy event never
  // flashes a real name for the split second before it loads. `masked` is a
  // boolean, so adding it to the fetch deps below only re-runs when it flips.
  const masked = event ? eventPrivacyMasked(event) : true;

  // Vote session realtime
  const { session: voteSession, isOpen, isClosed, isRevealed, tallies, totalVotes } =
    useVoteSession(eventId, { trackVotes: true });

  const timer = useTimer(
    event?.live_timer_end ?? null,
    event?.live_timer_running ?? false
  );

  // F5 — live banner (breaking-news strip)
  const liveBanner = useLiveBanner(
    eventId,
    (event?.live_banner_active ?? false) === true,
    event?.live_banner_text ?? null
  );

  // Fetch vote candidates/bill info when vote session changes
  useEffect(() => {
    if (!voteSession) {
      setVoteCandidates([]);
      setVoteBillTitle(null);
      return;
    }

    async function loadVoteData() {
      if (!voteSession) return;

      if (voteSession.vote_type === "speaker_election") {
        const { data } = await supabase
          .from("participants")
          .select("id, full_name, school_name")
          .eq("event_id", eventId)
          .eq("parliament_role", "speaker");
        setVoteCandidates(
          (data ?? []).map((c) => ({
            id: c.id,
            full_name: maskName(masked, c.id, c.full_name),
            school_name: masked ? "" : c.school_name,
          }))
        );
      }

      if (voteSession.vote_type === "bill_vote" && voteSession.bill_id) {
        const { data: bill } = await supabase
          .from("bills")
          .select("title")
          .eq("id", voteSession.bill_id)
          .single();
        setVoteBillTitle(bill?.title ?? null);
      }

      if (
        voteSession.vote_type === "no_confidence" ||
        voteSession.vote_type === "impeach_speaker"
      ) {
        const cfg = (voteSession.config ?? {}) as { motionSubject?: unknown };
        setMotionVoteSubject(
          typeof cfg.motionSubject === "string" ? cfg.motionSubject : null
        );
      }
    }

    loadVoteData();
  }, [voteSession?.id, eventId, supabase, masked]);

  // Fetch current speaker when agenda item changes
  const fetchCurrentSpeaker = useCallback(async () => {
    if (!event?.current_agenda_item_id) {
      setCurrentSpeaker(null);
      return;
    }

    const { data } = await supabase
      .from("agenda_speakers")
      .select(
        `
        participant:participants(
          id,
          full_name,
          parliament_role,
          party_side,
          constituency_name,
          constituency_state,
          school_name
        )
      `
      )
      .eq("agenda_item_id", event.current_agenda_item_id)
      .eq("status", "speaking")
      .limit(1)
      .maybeSingle();

    if (data?.participant && !Array.isArray(data.participant)) {
      const p = data.participant as unknown as SpeakerInfo;
      setCurrentSpeaker({
        ...p,
        full_name: maskName(masked, p.id, p.full_name),
        school_name: masked ? "" : p.school_name,
      });
    } else {
      setCurrentSpeaker(null);
    }
  }, [event?.current_agenda_item_id, supabase, masked]);

  useEffect(() => {
    fetchCurrentSpeaker();
  }, [fetchCurrentSpeaker]);

  // Also subscribe to speaker changes
  useEffect(() => {
    if (!event?.current_agenda_item_id) return;

    const channel = supabase
      .channel(`yip:display-speakers:${event.current_agenda_item_id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "yip",
          table: "agenda_speakers",
          filter: `agenda_item_id=eq.${event.current_agenda_item_id}`,
        },
        () => {
          fetchCurrentSpeaker();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event?.current_agenda_item_id, supabase, fetchCurrentSpeaker]);

  // Fetch current question for Question Hour
  const fetchCurrentQuestion = useCallback(async () => {
    const { data } = await supabase
      .from("questions")
      .select(
        `
        question_text,
        directed_to_ministry,
        question_type,
        submitter:participants!questions_submitted_by_fkey(
          id,
          full_name,
          party_side,
          constituency_name
        )
      `
      )
      .eq("event_id", eventId)
      .eq("status", "asked")
      .limit(1)
      .maybeSingle();

    if (data?.submitter && !Array.isArray(data.submitter)) {
      const sub = data.submitter as unknown as {
        id: string;
        full_name: string;
        party_side: string | null;
        constituency_name: string | null;
      };
      setCurrentQuestionDisplay({
        question_text: data.question_text,
        directed_to_ministry: data.directed_to_ministry,
        question_type: data.question_type,
        submitter_name: maskName(masked, sub.id, sub.full_name),
        submitter_party: sub.party_side,
        submitter_constituency: sub.constituency_name,
      });
    } else {
      setCurrentQuestionDisplay(null);
    }
  }, [eventId, supabase, masked]);

  // Subscribe to question changes for this event
  useEffect(() => {
    if (currentAgendaItem?.agenda_type !== "question_hour") {
      setCurrentQuestionDisplay(null);
      return;
    }

    fetchCurrentQuestion();

    const channel = supabase
      .channel(`yip:display-questions:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "yip",
          table: "questions",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchCurrentQuestion();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAgendaItem?.agenda_type, eventId, supabase, fetchCurrentQuestion]);

  // Fetch presented bill for bill_presentation agenda type
  const fetchPresentedBill = useCallback(async () => {
    const { data } = await supabase
      .from("bills")
      .select(
        `
        id,
        title,
        objective,
        party_side,
        provisions,
        status,
        presenter_1_participant:participants!bills_presenter_1_fkey(id, full_name),
        presenter_2_participant:participants!bills_presenter_2_fkey(id, full_name)
      `
      )
      .eq("event_id", eventId)
      .eq("status", "presented")
      .limit(1)
      .maybeSingle();

    if (data) {
      const p1 = data.presenter_1_participant as unknown as { id: string; full_name: string } | null;
      const p2 = data.presenter_2_participant as unknown as { id: string; full_name: string } | null;
      setPresentedBill({
        id: data.id,
        title: data.title,
        objective: data.objective,
        party_side: data.party_side,
        provisions: (data.provisions as string[]) ?? [],
        status: data.status,
        presenter_1_name: p1 ? maskName(masked, p1.id, p1.full_name) : null,
        presenter_2_name: p2 ? maskName(masked, p2.id, p2.full_name) : null,
      });
    } else {
      setPresentedBill(null);
    }
  }, [eventId, supabase, masked]);

  useEffect(() => {
    if (currentAgendaItem?.agenda_type !== "bill_presentation") {
      setPresentedBill(null);
      return;
    }

    fetchPresentedBill();

    const channel = supabase
      .channel(`yip:display-bills:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "yip",
          table: "bills",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchPresentedBill();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentAgendaItem?.agenda_type, eventId, supabase, fetchPresentedBill]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="animate-pulse text-2xl">Loading...</div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-xl">Event not found</p>
      </div>
    );
  }

  const isLive =
    event.status === "day1_live" || event.status === "day2_live";

  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-white">
      {/* F5 — Live banner (fixed at top, above everything) */}
      {liveBanner.active && liveBanner.text && (
        <div
          className="fixed inset-x-0 top-0 z-50 flex w-full items-center justify-center gap-4 bg-[#dc2626] px-8 py-4 text-3xl font-bold text-white shadow-lg animate-pulse"
          role="status"
          aria-live="polite"
        >
          <span className="inline-block size-4 shrink-0 rounded-full bg-white" />
          <span className="break-words text-center">{liveBanner.text}</span>
        </div>
      )}

      {/* Indian tricolor accent bar */}
      <div className="flex h-2 w-full">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{event.name}</h1>
          {event.chapter_name && (
            <p className="text-sm text-gray-400">
              {event.chapter_name} | Young Indians Parliament
            </p>
          )}
        </div>
        <div className="text-right">
          {isLive && (
            <span className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-1.5 text-sm font-semibold text-white">
              <span className="size-2 animate-pulse rounded-full bg-white" />
              {event.status === "day1_live" ? "DAY 1" : "DAY 2"} LIVE
            </span>
          )}
          {event.status === "completed" && (
            <span className="inline-flex items-center rounded-full bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white">
              COMPLETED
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-8">
        {/* ─── VOTING DISPLAY ─────────────────────────────────── */}
        {voteSession && (isOpen || isClosed || isRevealed) && (
          <div className="w-full max-w-4xl space-y-8 text-center">
            {/* Voting Open */}
            {isOpen && (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 rounded-full border-2 border-green-500 bg-green-500/10 px-8 py-3">
                  <span className="size-3 animate-pulse rounded-full bg-green-400" />
                  <span className="text-3xl font-black uppercase tracking-widest text-green-400">
                    Voting is Open
                  </span>
                </div>
                <p className="text-2xl text-gray-400">
                  Cast your vote on your phone
                </p>
                <p className="text-lg text-gray-500">
                  {voteSession.vote_type === "speaker_election"
                    ? "Speaker Election"
                    : voteSession.vote_type === "impeach_speaker"
                      ? `Impeach the Speaker${
                          motionVoteSubject ? `: ${motionVoteSubject}` : ""
                        }`
                      : voteSession.vote_type === "no_confidence"
                        ? `No-Confidence Motion${
                            motionVoteSubject ? `: ${motionVoteSubject}` : ""
                          }`
                        : voteBillTitle
                          ? `Bill Vote: ${voteBillTitle}`
                          : "Bill Vote"}
                </p>
              </div>
            )}

            {/* Voting Closed */}
            {isClosed && (
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 rounded-full border-2 border-amber-500 bg-amber-500/10 px-8 py-3">
                  <span className="text-3xl font-black uppercase tracking-widest text-amber-400">
                    Voting Closed
                  </span>
                </div>
                <p className="animate-pulse text-2xl text-gray-400">
                  Tallying results...
                </p>
              </div>
            )}

            {/* Results Revealed */}
            {isRevealed && tallies.length > 0 && (
              <div className="space-y-8">
                <h2 className="text-3xl font-black text-white uppercase tracking-wider">
                  {voteSession.vote_type === "speaker_election"
                    ? "Speaker Election Results"
                    : "Bill Vote Results"}
                </h2>

                {/* Result bars */}
                <div className="mx-auto max-w-2xl space-y-4">
                  {tallies.map((tally, idx) => {
                    const maxCount = tallies[0].count;
                    const percentage =
                      totalVotes > 0
                        ? Math.round((tally.count / totalVotes) * 100)
                        : 0;
                    // Only crown an UNAMBIGUOUS single leader. On a tie (top
                    // count shared by >1 option) the outcome is "tie → runoff" —
                    // never crown one tied candidate as winner on the projector.
                    const isWinner =
                      idx === 0 &&
                      maxCount > 0 &&
                      tallies.filter((t) => t.count === maxCount).length === 1;

                    // Determine label and color
                    let label = tally.vote_value;
                    let barColor = "from-gray-500 to-gray-400";

                    if (voteSession.vote_type === "speaker_election") {
                      const candidate = voteCandidates.find(
                        (c) => c.id === tally.vote_value
                      );
                      label = candidate?.full_name ?? tally.vote_value;
                      barColor = isWinner
                        ? "from-amber-500 to-yellow-400"
                        : "from-gray-600 to-gray-500";
                    } else {
                      if (tally.vote_value === "aye") {
                        label = "AYE";
                        barColor = "from-green-500 to-emerald-400";
                      } else if (tally.vote_value === "nay") {
                        label = "NAY";
                        barColor = "from-red-500 to-rose-400";
                      } else if (tally.vote_value === "abstain") {
                        label = "ABSTAIN";
                        barColor = "from-gray-500 to-gray-400";
                      }
                    }

                    return (
                      <div key={tally.vote_value} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "flex items-center gap-2 text-xl font-bold",
                              isWinner &&
                                voteSession.vote_type === "speaker_election"
                                ? "text-amber-400"
                                : "text-white"
                            )}
                          >
                            {isWinner &&
                              voteSession.vote_type === "speaker_election" && (
                                <span className="text-2xl">&#128081;</span>
                              )}
                            {label}
                          </span>
                          <span className="text-xl font-bold tabular-nums text-gray-300">
                            {tally.count} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-8 w-full rounded-lg bg-gray-800 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-lg bg-gradient-to-r transition-all duration-1000",
                              barColor,
                              isWinner &&
                                voteSession.vote_type === "speaker_election" &&
                                "ring-2 ring-amber-400"
                            )}
                            style={{
                              width: `${
                                maxCount > 0
                                  ? (tally.count / maxCount) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Winner / Bill result */}
                <div className="pt-4">
                  {voteSession.vote_type === "speaker_election" &&
                    tallies.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-lg text-gray-500 uppercase tracking-widest">
                          {/* A deputy-seat runoff elects a Deputy Speaker —
                              never relabel its winner as the Speaker. */}
                          {((voteSession.config ?? {}) as {
                            isRunoff?: boolean;
                            runoffSeat?: string;
                          }).runoffSeat === "deputy"
                            ? "Elected Deputy Speaker"
                            : "Elected Speaker"}
                        </p>
                        <p className="text-5xl font-black text-amber-400">
                          {(() => {
                            const candidate = voteCandidates.find(
                              (c) => c.id === tallies[0].vote_value
                            );
                            return candidate?.full_name ?? "Unknown";
                          })()}
                        </p>
                      </div>
                    )}

                  {voteSession.vote_type === "bill_vote" && (
                    <div className="space-y-2">
                      {(() => {
                        const ayes =
                          tallies.find((t) => t.vote_value === "aye")?.count ??
                          0;
                        const nays =
                          tallies.find((t) => t.vote_value === "nay")?.count ??
                          0;
                        const passed = ayes > nays;
                        return (
                          <p
                            className={cn(
                              "text-5xl font-black",
                              passed ? "text-green-400" : "text-red-400"
                            )}
                          >
                            {passed ? "BILL PASSED" : "BILL REJECTED"}
                          </p>
                        );
                      })()}
                    </div>
                  )}

                  <p className="mt-4 text-sm text-gray-500">
                    Total votes: {totalVotes}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Current agenda item (only show when no active vote display) */}
        {(!voteSession || (!isOpen && !isClosed && !isRevealed)) && currentAgendaItem ? (
          <div className="w-full max-w-4xl space-y-8 text-center">
            {/* Agenda item title */}
            <div>
              {currentAgendaItem.agenda_type && (
                <p className="mb-2 text-sm uppercase tracking-widest text-gray-500">
                  {currentAgendaItem.agenda_type.replace(/_/g, " ")}
                </p>
              )}
              <h2 className="text-4xl font-bold leading-tight text-white lg:text-5xl">
                {currentAgendaItem.title}
              </h2>
            </div>

            {/* Timer */}
            {(timer.isActive || timer.isExpired) && (
              <div className="flex flex-col items-center gap-2">
                <div
                  className={cn(
                    "font-mono font-bold tabular-nums tracking-tight",
                    timer.isExpired
                      ? "animate-pulse text-red-500"
                      : timer.seconds <= 10
                        ? "text-yellow-400"
                        : "text-green-400",
                    "text-[8rem] leading-none lg:text-[10rem]"
                  )}
                >
                  {timer.display}
                </div>
                {timer.isExpired && (
                  <p className="animate-pulse text-3xl font-bold text-red-500">
                    TIME
                  </p>
                )}
                {event.live_timer_label && !timer.isExpired && (
                  <p className="text-lg text-gray-400">
                    {event.live_timer_label}
                  </p>
                )}
              </div>
            )}

            {/* Question Hour display */}
            {currentAgendaItem.agenda_type === "question_hour" &&
              currentQuestionDisplay && (
                <div className="mx-auto max-w-3xl space-y-6">
                  {/* Ministry label */}
                  <p className="text-lg text-cyan-400">
                    Directed to: Minister of{" "}
                    {getMinistryLabel(
                      currentQuestionDisplay.directed_to_ministry
                    )}
                  </p>

                  {/* Question text (large, readable) */}
                  <p className="text-3xl font-bold leading-snug text-white lg:text-4xl">
                    &ldquo;{currentQuestionDisplay.question_text}&rdquo;
                  </p>

                  {/* Submitter info */}
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <span className="text-xl text-gray-300">
                      {currentQuestionDisplay.submitter_name}
                    </span>
                    {currentQuestionDisplay.submitter_party && (
                      <span
                        className={cn(
                          "rounded-full px-4 py-1 text-sm font-medium",
                          currentQuestionDisplay.submitter_party === "ruling"
                            ? "bg-blue-600 text-white"
                            : "bg-red-600 text-white"
                        )}
                      >
                        {currentQuestionDisplay.submitter_party === "ruling"
                          ? "Ruling Party"
                          : "Opposition"}
                      </span>
                    )}
                    {currentQuestionDisplay.submitter_constituency && (
                      <span className="text-sm text-gray-400">
                        {currentQuestionDisplay.submitter_constituency}
                      </span>
                    )}
                  </div>

                  {/* Star badge */}
                  {currentQuestionDisplay.question_type === "starred" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-4 py-1 text-sm font-semibold text-white">
                      &#9733; Starred Question
                    </span>
                  )}
                </div>
              )}

            {/* Question Hour - no active question */}
            {currentAgendaItem.agenda_type === "question_hour" &&
              !currentQuestionDisplay && (
                <p className="text-2xl text-gray-500">
                  Awaiting next question...
                </p>
              )}

            {/* Bill Presentation display */}
            {currentAgendaItem.agenda_type === "bill_presentation" &&
              presentedBill && (
                <div className="mx-auto max-w-3xl space-y-6">
                  {/* Party badge */}
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-5 py-1.5 text-sm font-semibold",
                      presentedBill.party_side === "ruling"
                        ? "bg-blue-600 text-white"
                        : "bg-red-600 text-white"
                    )}
                  >
                    {presentedBill.party_side === "ruling"
                      ? "Ruling Party Bill"
                      : "Opposition Bill"}
                  </span>

                  {/* Bill title */}
                  <h3 className="text-3xl font-black text-white lg:text-4xl">
                    {presentedBill.title}
                  </h3>

                  {/* Objective */}
                  {presentedBill.objective && (
                    <p className="text-xl text-gray-300 italic">
                      {presentedBill.objective}
                    </p>
                  )}

                  {/* Key provisions */}
                  {presentedBill.provisions.length > 0 && (
                    <div className="space-y-3 text-left">
                      <p className="text-sm uppercase tracking-widest text-gray-500 text-center">
                        Key Provisions
                      </p>
                      {presentedBill.provisions.map((provision, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 rounded-lg border border-gray-800 bg-gray-900/50 px-5 py-3"
                        >
                          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#FF9933] text-sm font-bold text-white">
                            {idx + 1}
                          </span>
                          <p className="text-lg text-gray-200">{provision}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Presenters */}
                  {(presentedBill.presenter_1_name ||
                    presentedBill.presenter_2_name) && (
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
                      {presentedBill.presenter_1_name && (
                        <div className="text-center">
                          <p className="text-xs uppercase tracking-widest text-gray-500">
                            Presenter 1
                          </p>
                          <p className="text-lg font-semibold text-white">
                            {presentedBill.presenter_1_name}
                          </p>
                        </div>
                      )}
                      {presentedBill.presenter_2_name && (
                        <div className="text-center">
                          <p className="text-xs uppercase tracking-widest text-gray-500">
                            Presenter 2
                          </p>
                          <p className="text-lg font-semibold text-white">
                            {presentedBill.presenter_2_name}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Bill Presentation - no bill presented yet */}
            {currentAgendaItem.agenda_type === "bill_presentation" &&
              !presentedBill && (
                <p className="text-2xl text-gray-500">
                  Awaiting bill presentation...
                </p>
              )}

            {/* ── Oath Taking Ceremony (Handbook page 44) ─────────────── */}
            {currentAgendaItem.agenda_type === "oath_taking" &&
              currentAgendaItem.title.toLowerCase().includes("oath") && (
                <div className="mx-auto max-w-4xl rounded-3xl border-2 border-[#FF9933]/40 bg-gradient-to-br from-[#FF9933]/5 via-white/5 to-[#138808]/5 p-10 shadow-2xl">
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <div className="h-px w-12 bg-[#FF9933]/60" />
                    <p className="text-xs uppercase tracking-[0.3em] text-[#FF9933] font-semibold">
                      Oath of Office
                    </p>
                    <div className="h-px w-12 bg-[#FF9933]/60" />
                  </div>
                  <p
                    className="font-serif text-2xl leading-relaxed italic text-white lg:text-3xl"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {(event.oath_text && event.oath_text.trim().length > 0)
                      ? event.oath_text
                      : OATH_TEXT}
                  </p>
                  <div className="flex items-center justify-center gap-3 mt-8">
                    <div className="h-px w-16 bg-white/20" />
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">
                      Constitution of India
                    </p>
                    <div className="h-px w-16 bg-white/20" />
                  </div>
                </div>
              )}

            {/* Current speaker (only for non-question-hour items) */}
            {currentAgendaItem.agenda_type !== "question_hour" && currentSpeaker && (
              <div className="mx-auto max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-6">
                <p className="mb-1 text-xs uppercase tracking-widest text-gray-500">
                  Now Speaking
                </p>
                <p className="text-3xl font-bold text-white lg:text-4xl">
                  {currentSpeaker.full_name}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
                  {currentSpeaker.parliament_role && (
                    <span className="rounded-full bg-gray-800 px-4 py-1 text-sm text-gray-200">
                      {ROLE_LABELS[currentSpeaker.parliament_role] ??
                        currentSpeaker.parliament_role}
                    </span>
                  )}
                  {currentSpeaker.party_side && (
                    <span
                      className={cn(
                        "rounded-full px-4 py-1 text-sm font-medium",
                        currentSpeaker.party_side === "ruling"
                          ? "bg-blue-600 text-white"
                          : "bg-red-600 text-white"
                      )}
                    >
                      {currentSpeaker.party_side === "ruling"
                        ? "Ruling Party"
                        : "Opposition"}
                    </span>
                  )}
                </div>
                {currentSpeaker.constituency_name && (
                  <p className="mt-2 text-sm text-gray-400">
                    {currentSpeaker.constituency_name}
                    {currentSpeaker.constituency_state
                      ? `, ${currentSpeaker.constituency_state}`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* No active item and no active vote — show event info */
          !voteSession || (!isOpen && !isClosed && !isRevealed) ? (
            <div className="text-center">
              <h2 className="text-4xl font-bold text-gray-500 lg:text-5xl">
                {isLive
                  ? "Session in Progress"
                  : event.status === "completed"
                    ? "Parliament Session Concluded"
                    : "Young Indians Parliament"}
              </h2>
              {!isLive && event.status !== "completed" && (
                <p className="mt-4 text-xl text-gray-600">
                  Session will begin shortly
                </p>
              )}
            </div>
          ) : null
        )}
      </main>

      {/* Footer tricolor bar */}
      <div className="flex h-2 w-full">
        <div className="flex-1 bg-[#FF9933]" />
        <div className="flex-1 bg-white" />
        <div className="flex-1 bg-[#138808]" />
      </div>
    </div>
  );
}
