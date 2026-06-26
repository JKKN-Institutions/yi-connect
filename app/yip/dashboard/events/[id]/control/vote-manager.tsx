"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Button } from "@/components/yip/ui/button";
import { Badge } from "@/components/yip/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/yip/ui/dialog";
import {
  Vote,
  CheckCircle2,
  XCircle,
  Eye,
  StopCircle,
  Users,
  BarChart3,
  Crown,
  Landmark,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Search,
  Pencil,
  Loader2,
  Check,
} from "lucide-react";
import { Input } from "@/components/yip/ui/input";
import { Textarea } from "@/components/yip/ui/textarea";
import { Label } from "@/components/yip/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/yip/ui/select";
import { cn } from "@/lib/yip/utils";
import { toast } from "sonner";
import { useVoteSession } from "@/lib/yip/hooks/use-vote-session";
import {
  openVote,
  closeVote,
  revealResults,
  openRunoff,
  getSpeakerCandidates,
  getVoteCandidates,
  getEventBills,
  getEventParties,
  getPartyMembers,
  type VoteCandidate,
  type PartyLite,
} from "@/app/yip/actions/voting";
import {
  computeElectionOutcome,
  computeDeputyRunoffOutcome,
  computeMultiSeatOutcome,
  distributeSeats,
} from "@/lib/yip/election-outcome";
import { MINISTRIES } from "@/lib/yip/constants";
import {
  getFloorPanel,
  castFloorVote,
  castBulkFloorVotes,
  setAllowBulkFloorVotes,
  correctFloorVote,
  type FloorPanel,
  type FloorPendingParticipant,
  type FloorManualEntry,
} from "@/app/yip/actions/vote-floor";
import type { Tables } from "@/types/yip/database";

// ─── Types ──────────────────────────────────────────────────────

type AgendaItem = Tables<{ schema: "yip" }, "agenda">;

interface VoteManagerProps {
  eventId: string;
  currentAgendaItem: AgendaItem | null;
  totalParticipants: number;
}

interface BillOption {
  id: string;
  title: string;
  objective: string | null;
  party_side: string | null;
  committee_name: string | null;
  status: string | null;
}

// ─── Component ──────────────────────────────────────────────────

export function VoteManager({
  eventId,
  currentAgendaItem,
  totalParticipants,
}: VoteManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState<VoteCandidate[]>([]);
  const [bills, setBills] = useState<BillOption[]>([]);
  const [parties, setParties] = useState<PartyLite[]>([]);
  // Party-leader nomination dialog: the party being elected for, its members,
  // and the organiser's 3–5 chosen nominees.
  const [leaderDialog, setLeaderDialog] = useState<{
    open: boolean;
    party: PartyLite | null;
    members: VoteCandidate[];
    selectedIds: string[];
    loading: boolean;
  }>({ open: false, party: null, members: [], selectedIds: [], loading: false });
  // Leadership-election nomination dialog (PM / Deputy PM / Leader of Opposition).
  // Mirrors leaderDialog, but the candidate pool is a whole bench (party_side),
  // not one party. `voteType` is the seat being filled; `side` is its bench.
  const [leadershipDialog, setLeadershipDialog] = useState<{
    open: boolean;
    voteType:
      | "prime_minister"
      | "deputy_prime_minister"
      | "leader_of_opposition"
      | null;
    side: "ruling" | "opposition" | null;
    label: string;
    members: VoteCandidate[];
    selectedIds: string[];
    loading: boolean;
  }>({
    open: false,
    voteType: null,
    side: null,
    label: "",
    members: [],
    selectedIds: [],
    loading: false,
  });
  // Cabinet / Shadow minister nomination dialog (a coalition party elects its
  // OWN quota of ministers). Mirrors leaderDialog, but `voteType` distinguishes
  // cabinet (ruling) from shadow (opposition) and `seats` is the party's quota
  // (the organiser must pick at least `seats` of the party's members).
  const [ministerDialog, setMinisterDialog] = useState<{
    open: boolean;
    voteType: "cabinet_minister" | "shadow_minister" | null;
    party: PartyLite | null;
    seats: number;
    members: VoteCandidate[];
    selectedIds: string[];
    loading: boolean;
  }>({
    open: false,
    voteType: null,
    party: null,
    seats: 0,
    members: [],
    selectedIds: [],
    loading: false,
  });
  // Speaker nomination dialog — like leadershipDialog but the candidate pool is
  // the WHOLE House (both benches), grouped by party. Equity rule: each party
  // puts forward min 1, max 2 nominees. `selectedByParty` keys the picks by
  // party so the per-party cap + the open-gate are both easy to evaluate.
  const [speakerDialog, setSpeakerDialog] = useState<{
    open: boolean;
    groups: { party: PartyLite; members: VoteCandidate[] }[];
    selectedByParty: Record<string, string[]>;
    loading: boolean;
  }>({ open: false, groups: [], selectedByParty: {}, loading: false });
  // Shared search query for every nominee picker (only one dialog is open at a
  // time, so a single string suffices). Reset on each dialog open.
  const [nomineeSearch, setNomineeSearch] = useState("");

  // Editable TOTAL cabinet / shadow seats — the organiser can change each and the
  // per-party quota re-derives live. Defaults to MINISTRIES.length (8).
  // Cabinet (ruling) and Shadow (opposition) keep INDEPENDENT totals: the
  // opposition is usually smaller, so a shared count would leave the Shadow side
  // stuck (a default of 8 exceeds the seats a 2-member opposition party can fill).
  const [totalCabinetSeats, setTotalCabinetSeats] = useState<number>(
    MINISTRIES.length
  );
  const [totalShadowSeats, setTotalShadowSeats] = useState<number>(
    MINISTRIES.length
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: "", description: "", action: () => {} });
  // When a prior ballot for the current item is already revealed, the organiser
  // can choose to start a fresh one. This flag swaps the revealed result card
  // for the "open voting" controls so a new session can be opened. It is reset
  // once a genuinely new session surfaces (see effect below).
  const [startingNew, setStartingNew] = useState(false);
  // The party/government election launchers (party-leader, PM/Deputy/LoP,
  // cabinet, shadow) are available on ANY voting item — collapsed behind one
  // "Run an election" menu so the panel isn't cluttered with every election at
  // once. Closed by default; the agenda-pinned Speaker/Bill votes stay inline.
  const [electionsMenuOpen, setElectionsMenuOpen] = useState(false);

  // Get realtime vote session state with live counts
  const {
    session: voteSession,
    isOpen,
    isClosed,
    isRevealed,
    tallies,
    totalVotes,
  } = useVoteSession(eventId, { trackVotes: true });

  // Clear the "start new vote" override as soon as a non-revealed session is
  // surfaced — i.e. the new ballot was actually opened (or the old one reverted
  // to open/closed). The hook orders by opened_at DESC, so a freshly opened
  // session naturally replaces the old revealed one here.
  useEffect(() => {
    if (voteSession && voteSession.status !== "revealed") {
      setStartingNew(false);
    }
  }, [voteSession?.id, voteSession?.status]);

  // Voting is gated by the per-agenda-item "use for voting?" flag (Maria's
  // restructuring). Speaker election, party/government formation, cabinet, and
  // the Bill vote are flagged use_for_voting=true by default; non-voting items
  // (anthem, MuPI, breaks…) hide the vote controls entirely. Older agenda rows
  // predating the flag fall back to their agenda_type so existing live events
  // never lose their Speaker/Bill vote.
  const agendaType = currentAgendaItem?.agenda_type;
  const itemUsesVoting =
    currentAgendaItem?.use_for_voting === true ||
    agendaType === "speaker_election" ||
    agendaType === "bill_presentation";
  const showVoteControls = Boolean(currentAgendaItem) && itemUsesVoting;

  // The active party-leader session's party id (config.partyId), used to label
  // its tally with member names and to name the party in the result block.
  const activeLeaderPartyId =
    voteSession?.vote_type === "party_leader"
      ? ((voteSession.config ?? {}) as { partyId?: string }).partyId ?? null
      : null;

  // Single-winner bench seats (PM / Deputy PM / Leader of Opposition) reuse the
  // candidate-ballot machinery. The active session's config.candidateIds is the
  // authoritative ballot — load those nominees by id (like speaker/party-leader)
  // so the live tally + result block can resolve candidate names.
  const isBenchVoteType =
    voteSession?.vote_type === "prime_minister" ||
    voteSession?.vote_type === "deputy_prime_minister" ||
    voteSession?.vote_type === "leader_of_opposition";

  // Cabinet / Shadow elections are multi-seat, per-party (config.candidateIds +
  // config.partyId + config.seats). Their ballots resolve candidate names just
  // like the party-leader / bench candidate grid.
  const isMinisterVoteType =
    voteSession?.vote_type === "cabinet_minister" ||
    voteSession?.vote_type === "shadow_minister";

  // The active minister session's party id + seats (config), used to label the
  // result block and resolve the multi-seat winners.
  const activeMinisterPartyId =
    isMinisterVoteType && voteSession
      ? ((voteSession.config ?? {}) as { partyId?: string }).partyId ?? null
      : null;
  const activeMinisterSeats =
    isMinisterVoteType && voteSession
      ? Math.max(1, ((voteSession.config ?? {}) as { seats?: number }).seats ?? 1)
      : 1;

  // Human title for the bench seats (and a passthrough for others).
  function seatTitle(voteType: string): string {
    if (voteType === "prime_minister") return "Prime Minister Election";
    if (voteType === "deputy_prime_minister") return "Deputy PM Election";
    if (voteType === "leader_of_opposition")
      return "Leader of Opposition Election";
    if (voteType === "cabinet_minister") return "Cabinet Election";
    if (voteType === "shadow_minister") return "Shadow Cabinet Election";
    return voteType;
  }

  // Fetch candidates or bills when agenda type warrants it.
  // For speaker elections the ACTIVE session's config.candidateIds is the
  // authoritative ballot — after a round-1 reveal a deputy runoff's tied pair
  // have parliament_role reset to mp, so the role-based lookup would render
  // the wrong roll-call list and leave result names unresolved. Prefer the
  // session config; fall back to roles when no session carries one.
  useEffect(() => {
    if (agendaType === "speaker_election") {
      const cfg =
        voteSession?.vote_type === "speaker_election"
          ? ((voteSession.config ?? {}) as { candidateIds?: unknown })
          : {};
      const ids = Array.isArray(cfg.candidateIds)
        ? cfg.candidateIds.filter((x): x is string => typeof x === "string")
        : [];
      if (ids.length > 0) {
        getVoteCandidates(ids).then(setCandidates);
      } else {
        getSpeakerCandidates(eventId).then(setCandidates);
      }
    }
    if (agendaType === "bill_presentation") {
      getEventBills(eventId).then(setBills);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaType, eventId, voteSession?.id]);

  // Auto-open the "Run a vote" menu when the current item has its OWN vote
  // (Speaker / Bill) so that primary action needs no extra tap. Stays collapsed
  // on other items. Re-runs only when the item changes, so a manual collapse
  // sticks until the organiser moves to the next item.
  useEffect(() => {
    if (
      agendaType === "speaker_election" ||
      agendaType === "bill_presentation"
    ) {
      setElectionsMenuOpen(true);
    }
  }, [agendaType, currentAgendaItem?.id]);

  // Parties are always available to the organiser (party-leader elections can be
  // held during any agenda item).
  useEffect(() => {
    if (currentAgendaItem) {
      getEventParties(eventId).then(setParties);
    }
  }, [currentAgendaItem?.id, eventId]);

  // When a party-leader session is active, load that party's members so the live
  // tally and result block can render candidate names (reuses `candidates`).
  useEffect(() => {
    if (activeLeaderPartyId) {
      getPartyMembers(eventId, activeLeaderPartyId).then(setCandidates);
    }
  }, [activeLeaderPartyId, eventId]);

  // When a bench-seat session (PM / Deputy PM / LoP) is active, load its nominees
  // by id (config.candidateIds) so the tally + result block resolve names.
  useEffect(() => {
    if (!isBenchVoteType || !voteSession) return;
    const cfg = (voteSession.config ?? {}) as { candidateIds?: unknown };
    const ids = Array.isArray(cfg.candidateIds)
      ? cfg.candidateIds.filter((x): x is string => typeof x === "string")
      : [];
    if (ids.length > 0) {
      getVoteCandidates(ids).then(setCandidates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBenchVoteType, voteSession?.id]);

  // When a cabinet/shadow minister session is active, load its nominees by id
  // (config.candidateIds) so the tally + result block resolve names. Same
  // storage as the bench seats — the ballot is the party members the organiser
  // nominated.
  useEffect(() => {
    if (!isMinisterVoteType || !voteSession) return;
    const cfg = (voteSession.config ?? {}) as { candidateIds?: unknown };
    const ids = Array.isArray(cfg.candidateIds)
      ? cfg.candidateIds.filter((x): x is string => typeof x === "string")
      : [];
    if (ids.length > 0) {
      getVoteCandidates(ids).then(setCandidates);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMinisterVoteType, voteSession?.id]);

  // ─── Action handlers ──────────────────────────────────────────

  // Case-insensitive filter shared by every nominee picker. Search by ANY of:
  // name, constituency name, constituency number, or school.
  function filterNominees(members: VoteCandidate[]) {
    const q = nomineeSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        (m.constituency_name ?? "").toLowerCase().includes(q) ||
        (m.constituency_number != null &&
          String(m.constituency_number).includes(q)) ||
        (m.school_name ?? "").toLowerCase().includes(q)
    );
  }

  // Subtitle under each nominee — prefer their constituency (the field
  // organisers search by); fall back to school before allocation assigns one.
  function candidateSubtitle(m: VoteCandidate): string {
    if (m.constituency_name) {
      return m.constituency_number != null
        ? `#${m.constituency_number} · ${m.constituency_name}`
        : m.constituency_name;
    }
    return m.school_name ?? "";
  }

  // Speaker: open the nomination dialog and load EVERY party's members (both
  // benches), grouped by party. The Speaker is elected by the whole House, so
  // the pool spans all parties — reuses getPartyMembers like leadershipDialog.
  function handleHoldSpeakerNomination() {
    setNomineeSearch("");
    setSpeakerDialog({
      open: true,
      groups: [],
      selectedByParty: {},
      loading: true,
    });
    const allParties = parties;
    Promise.all(allParties.map((p) => getPartyMembers(eventId, p.id))).then(
      (lists) => {
        const groups = allParties
          .map((party, i) => ({ party, members: lists[i] ?? [] }))
          .filter((g) => g.members.length > 0);
        setSpeakerDialog((prev) =>
          prev.open ? { ...prev, groups, loading: false } : prev
        );
      }
    );
  }

  // Open nomination: NO per-party cap — nominate anyone, any number, from any
  // party. Equal representation is decided at the vote (every member casts one
  // vote), not restricted at the nomination stage.
  function toggleSpeakerNominee(partyId: string, id: string) {
    setSpeakerDialog((prev) => {
      const cur = prev.selectedByParty[partyId] ?? [];
      const has = cur.includes(id);
      const next = has ? cur.filter((x) => x !== id) : [...cur, id];
      return {
        ...prev,
        selectedByParty: { ...prev.selectedByParty, [partyId]: next },
      };
    });
  }

  function handleOpenSpeakerElection() {
    if (!currentAgendaItem) return;
    const candidateIds = Object.values(speakerDialog.selectedByParty).flat();
    startTransition(async () => {
      const result = await openVote(
        eventId,
        currentAgendaItem.id,
        "speaker_election",
        { candidateIds }
      );
      if (result.success) {
        toast.success("Speaker election is now open!");
        setSpeakerDialog({
          open: false,
          groups: [],
          selectedByParty: {},
          loading: false,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleOpenBillVote(bill: BillOption) {
    if (!currentAgendaItem) return;

    setConfirmDialog({
      open: true,
      title: "Open Bill Vote",
      description: `Open voting on "${bill.title}"? Participants will vote Aye, Nay, or Abstain.`,
      action: () => {
        startTransition(async () => {
          const result = await openVote(
            eventId,
            currentAgendaItem.id,
            "bill_vote",
            { billId: bill.id }
          );
          if (result.success) {
            toast.success("Bill voting is now open!");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  // Party-leader: open the nomination dialog and load the party's members.
  function handleHoldLeaderElection(party: PartyLite) {
    setNomineeSearch("");
    setLeaderDialog({
      open: true,
      party,
      members: [],
      selectedIds: [],
      loading: true,
    });
    getPartyMembers(eventId, party.id).then((members) => {
      setLeaderDialog((prev) =>
        prev.party?.id === party.id
          ? { ...prev, members, loading: false }
          : prev
      );
    });
  }

  function toggleLeaderNominee(id: string) {
    setLeaderDialog((prev) => {
      const has = prev.selectedIds.includes(id);
      // Cap at 5 nominees; ignore further picks once full.
      if (!has && prev.selectedIds.length >= 5) return prev;
      return {
        ...prev,
        selectedIds: has
          ? prev.selectedIds.filter((x) => x !== id)
          : [...prev.selectedIds, id],
      };
    });
  }

  function handleOpenLeaderElection() {
    if (!currentAgendaItem || !leaderDialog.party) return;
    const party = leaderDialog.party;
    const candidateIds = leaderDialog.selectedIds;
    startTransition(async () => {
      const result = await openVote(
        eventId,
        currentAgendaItem.id,
        "party_leader",
        { candidateIds, partyId: party.id }
      );
      if (result.success) {
        toast.success(`${party.name} leader election is now open!`);
        setLeaderDialog({
          open: false,
          party: null,
          members: [],
          selectedIds: [],
          loading: false,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  // Leadership: open the nomination dialog and load the bench's members. The
  // candidate pool is the whole bench (every participant with the target
  // party_side), gathered by concatenating the members of each party on that
  // side — reuses getEventParties (which carries `side`) + getPartyMembers, so
  // no new server action is needed.
  function handleHoldLeadershipElection(
    voteType:
      | "prime_minister"
      | "deputy_prime_minister"
      | "leader_of_opposition",
    side: "ruling" | "opposition",
    label: string
  ) {
    setNomineeSearch("");
    setLeadershipDialog({
      open: true,
      voteType,
      side,
      label,
      members: [],
      selectedIds: [],
      loading: true,
    });
    const benchParties = parties.filter((p) => p.side === side);
    Promise.all(
      benchParties.map((p) => getPartyMembers(eventId, p.id))
    ).then((lists) => {
      // De-dupe by id and sort by name (each party's members are disjoint, but
      // guard anyway), then surface only if the dialog is still on this seat.
      const seen = new Set<string>();
      const members: VoteCandidate[] = [];
      for (const list of lists) {
        for (const m of list) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            members.push(m);
          }
        }
      }
      members.sort((a, b) => a.full_name.localeCompare(b.full_name));
      setLeadershipDialog((prev) =>
        prev.open && prev.voteType === voteType
          ? { ...prev, members, loading: false }
          : prev
      );
    });
  }

  function toggleLeadershipNominee(id: string) {
    setLeadershipDialog((prev) => {
      const has = prev.selectedIds.includes(id);
      // Cap at 5 nominees; ignore further picks once full.
      if (!has && prev.selectedIds.length >= 5) return prev;
      return {
        ...prev,
        selectedIds: has
          ? prev.selectedIds.filter((x) => x !== id)
          : [...prev.selectedIds, id],
      };
    });
  }

  function handleOpenLeadershipElection() {
    if (
      !currentAgendaItem ||
      !leadershipDialog.voteType ||
      !leadershipDialog.side
    )
      return;
    const voteType = leadershipDialog.voteType;
    const side = leadershipDialog.side;
    const label = leadershipDialog.label;
    const candidateIds = leadershipDialog.selectedIds;
    startTransition(async () => {
      const result = await openVote(eventId, currentAgendaItem.id, voteType, {
        side,
        candidateIds,
      });
      if (result.success) {
        toast.success(`${label} election is now open!`);
        setLeadershipDialog({
          open: false,
          voteType: null,
          side: null,
          label: "",
          members: [],
          selectedIds: [],
          loading: false,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  // Cabinet / Shadow: open the nomination dialog for ONE coalition party and
  // load that party's members. `seats` is the party's quota (caller passes the
  // distributeSeats-derived value); the organiser must pick at least that many.
  function handleHoldMinisterElection(
    voteType: "cabinet_minister" | "shadow_minister",
    party: PartyLite,
    seats: number
  ) {
    setNomineeSearch("");
    setMinisterDialog({
      open: true,
      voteType,
      party,
      seats,
      members: [],
      selectedIds: [],
      loading: true,
    });
    getPartyMembers(eventId, party.id).then((members) => {
      setMinisterDialog((prev) =>
        prev.open && prev.party?.id === party.id && prev.voteType === voteType
          ? { ...prev, members, loading: false }
          : prev
      );
    });
  }

  function toggleMinisterNominee(id: string) {
    setMinisterDialog((prev) => {
      const has = prev.selectedIds.includes(id);
      return {
        ...prev,
        selectedIds: has
          ? prev.selectedIds.filter((x) => x !== id)
          : [...prev.selectedIds, id],
      };
    });
  }

  function handleOpenMinisterElection() {
    if (
      !currentAgendaItem ||
      !ministerDialog.voteType ||
      !ministerDialog.party
    )
      return;
    const voteType = ministerDialog.voteType;
    const party = ministerDialog.party;
    const seats = ministerDialog.seats;
    const candidateIds = ministerDialog.selectedIds;
    startTransition(async () => {
      const result = await openVote(eventId, currentAgendaItem.id, voteType, {
        partyId: party.id,
        seats,
        candidateIds,
      });
      if (result.success) {
        const title =
          voteType === "cabinet_minister" ? "Cabinet" : "Shadow Cabinet";
        toast.success(`${party.name} ${title} election is now open!`);
        setMinisterDialog({
          open: false,
          voteType: null,
          party: null,
          seats: 0,
          members: [],
          selectedIds: [],
          loading: false,
        });
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleCloseVoting() {
    if (!voteSession) return;

    setConfirmDialog({
      open: true,
      title: "Close Voting",
      description:
        "Stop accepting votes? Participants who haven't voted yet will not be able to vote.",
      action: () => {
        startTransition(async () => {
          const result = await closeVote(voteSession.id);
          if (result.success) {
            toast.success("Voting closed");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  function handleRevealResults() {
    if (!voteSession) return;

    setConfirmDialog({
      open: true,
      title: "Reveal Results",
      description:
        "Reveal vote results to everyone? This will show results on the projector and participant phones.",
      action: () => {
        startTransition(async () => {
          const result = await revealResults(voteSession.id);
          if (result.success) {
            toast.success("Results revealed!");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  // Start a fresh ballot for the current agenda item even though a prior
  // session for it was already revealed. We don't touch the old session — the
  // open-voting controls reappear, and opening a new vote creates a newer
  // session that supersedes it (openVote only blocks while an open/closed
  // session exists, never a revealed one).
  function handleStartNewVote() {
    if (!currentAgendaItem) return;
    setConfirmDialog({
      open: true,
      title: "Start a new vote",
      description:
        "Open a fresh ballot for the current item? The previous result stays on record but will be superseded by the new vote.",
      action: () => {
        setStartingNew(true);
        setConfirmDialog((prev) => ({ ...prev, open: false }));
      },
    });
  }

  function handleRunoff() {
    if (!voteSession) return;
    setConfirmDialog({
      open: true,
      title: "Open 60-second runoff",
      description:
        "Open a fresh 60-second vote between only the tied candidates to break the tie. Start the timer for 60 seconds once it opens.",
      action: () => {
        startTransition(async () => {
          const result = await openRunoff(voteSession.id);
          if (result.success) {
            toast.success("Runoff opened — only the tied candidates are on the ballot.");
          } else {
            toast.error(result.error);
          }
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        });
      },
    });
  }

  // ─── Reusable party-leader elements (shared by both render branches) ──

  // The list of parties with a "Hold Election" action. Rendered in the
  // no-session branch and (as "hold the next party's") after a revealed
  // party-leader result, so the organiser can run each party in sequence.
  const partyLeaderList =
    parties.length > 0 ? (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Crown className="size-4 text-[#FF9933]" />
          Party Leader Elections
        </div>
        <p className="text-xs text-gray-500">
          Each party elects its own leader — only that party&apos;s members can
          vote. Hold one election at a time.
        </p>
        <div className="space-y-2">
          {parties.map((party) => (
            <div
              key={party.id}
              className="flex items-center justify-between rounded-lg border bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {party.name}
                </p>
                <p className="text-xs text-gray-500">
                  {party.member_count} member
                  {party.member_count === 1 ? "" : "s"}
                  {party.party_leader_id && (
                    <span className="ml-1 inline-flex items-center gap-1 text-amber-700">
                      · <Crown className="size-3 text-amber-500" />
                      Leader elected
                    </span>
                  )}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || party.member_count < 2}
                onClick={() => handleHoldLeaderElection(party)}
              >
                <Vote className="size-3.5 mr-1" />
                {party.party_leader_id ? "Re-elect" : "Hold Election"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  // The nomination dialog (pick 3–5 nominees → open the vote).
  const partyLeaderDialog = (
    <Dialog
      open={leaderDialog.open}
      onOpenChange={(open) =>
        setLeaderDialog((prev) =>
          open
            ? { ...prev, open }
            : {
                open: false,
                party: null,
                members: [],
                selectedIds: [],
                loading: false,
              }
        )
      }
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {leaderDialog.party
              ? `Hold ${leaderDialog.party.name} Leader Election`
              : "Hold Party Leader Election"}
          </DialogTitle>
          <DialogDescription>
            Choose 3–5 nominees from this party. Only this party&apos;s members
            will be able to vote.
          </DialogDescription>
        </DialogHeader>

        {leaderDialog.members.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={nomineeSearch}
              onChange={(e) => setNomineeSearch(e.target.value)}
              placeholder="Search by name, constituency or No."
              className="h-8 pl-8 text-sm"
            />
          </div>
        )}

        {leaderDialog.loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading members...
          </div>
        ) : leaderDialog.members.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This party has no members to nominate.
          </p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {filterNominees(leaderDialog.members).map((m) => {
              const checked = leaderDialog.selectedIds.includes(m.id);
              const atCap = !checked && leaderDialog.selectedIds.length >= 5;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={atCap}
                  onClick={() => toggleLeaderNominee(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all",
                    checked
                      ? "border-[#FF9933] bg-[#FF9933]/5"
                      : "border-gray-200 bg-white hover:border-gray-300",
                    atCap && "opacity-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {m.full_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {candidateSubtitle(m)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "ml-2 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      checked
                        ? "border-[#FF9933] bg-[#FF9933]"
                        : "border-gray-300 bg-white"
                    )}
                  >
                    {checked && <CheckCircle2 className="size-3.5 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {leaderDialog.selectedIds.length} selected
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setLeaderDialog({
                open: false,
                party: null,
                members: [],
                selectedIds: [],
                loading: false,
              })
            }
          >
            Cancel
          </Button>
          <Button
            disabled={
              isPending ||
              leaderDialog.selectedIds.length < 3 ||
              leaderDialog.selectedIds.length > 5
            }
            onClick={handleOpenLeaderElection}
          >
            {isPending ? "Opening..." : "Open Election"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── Reusable leadership-election elements ────────────────────
  //
  // Three launch actions: PM + Deputy PM (nominate from the RULING bench) and
  // Leader of Opposition (nominate from the OPPOSITION bench). Rendered in the
  // no-session branch and after a revealed result, alongside the party-leader
  // list, so the organiser can run them whenever an agenda item is live.
  const benchHasMembers = (side: "ruling" | "opposition") =>
    parties.some((p) => p.side === side && p.member_count > 0);

  const leadershipSeats: Array<{
    voteType: "prime_minister" | "deputy_prime_minister" | "leader_of_opposition";
    side: "ruling" | "opposition";
    label: string;
  }> = [
    { voteType: "prime_minister", side: "ruling", label: "Prime Minister" },
    {
      voteType: "deputy_prime_minister",
      side: "ruling",
      label: "Deputy Prime Minister",
    },
    {
      voteType: "leader_of_opposition",
      side: "opposition",
      label: "Leader of Opposition",
    },
  ];

  const leadershipList =
    parties.length > 0 ? (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Landmark className="size-4 text-[#138808]" />
          Leadership Elections
        </div>
        <p className="text-xs text-gray-500">
          The whole governing coalition elects the Prime Minister and Deputy PM;
          the whole opposition elects the Leader of Opposition. Only that
          bench&apos;s members can vote.
        </p>
        <div className="space-y-2">
          {leadershipSeats.map((seat) => {
            const hasMembers = benchHasMembers(seat.side);
            return (
              <div
                key={seat.voteType}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {seat.label}
                  </p>
                  <p className="text-xs text-gray-500">
                    {seat.side === "ruling" ? "Ruling bench" : "Opposition bench"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending || !hasMembers}
                  onClick={() =>
                    handleHoldLeadershipElection(
                      seat.voteType,
                      seat.side,
                      seat.label
                    )
                  }
                >
                  <Vote className="size-3.5 mr-1" />
                  Elect {seat.label}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  // The leadership nomination dialog (pick 2–5 nominees from the bench → open).
  const leadershipNominationDialog = (
    <Dialog
      open={leadershipDialog.open}
      onOpenChange={(open) =>
        setLeadershipDialog((prev) =>
          open
            ? { ...prev, open }
            : {
                open: false,
                voteType: null,
                side: null,
                label: "",
                members: [],
                selectedIds: [],
                loading: false,
              }
        )
      }
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {leadershipDialog.label
              ? `Elect ${leadershipDialog.label}`
              : "Leadership Election"}
          </DialogTitle>
          <DialogDescription>
            Choose 2–5 nominees from the{" "}
            {leadershipDialog.side === "ruling" ? "ruling" : "opposition"} bench.
            Only that bench&apos;s members will be able to vote.
          </DialogDescription>
        </DialogHeader>

        {leadershipDialog.members.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={nomineeSearch}
              onChange={(e) => setNomineeSearch(e.target.value)}
              placeholder="Search by name, constituency or No."
              className="h-8 pl-8 text-sm"
            />
          </div>
        )}

        {leadershipDialog.loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading members...
          </div>
        ) : leadershipDialog.members.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This bench has no members to nominate.
          </p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {filterNominees(leadershipDialog.members).map((m) => {
              const checked = leadershipDialog.selectedIds.includes(m.id);
              const atCap =
                !checked && leadershipDialog.selectedIds.length >= 5;
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={atCap}
                  onClick={() => toggleLeadershipNominee(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all",
                    checked
                      ? "border-[#FF9933] bg-[#FF9933]/5"
                      : "border-gray-200 bg-white hover:border-gray-300",
                    atCap && "opacity-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {m.full_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {candidateSubtitle(m)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "ml-2 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      checked
                        ? "border-[#FF9933] bg-[#FF9933]"
                        : "border-gray-300 bg-white"
                    )}
                  >
                    {checked && <CheckCircle2 className="size-3.5 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {leadershipDialog.selectedIds.length} selected
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setLeadershipDialog({
                open: false,
                voteType: null,
                side: null,
                label: "",
                members: [],
                selectedIds: [],
                loading: false,
              })
            }
          >
            Cancel
          </Button>
          <Button
            disabled={
              isPending ||
              leadershipDialog.selectedIds.length < 2 ||
              leadershipDialog.selectedIds.length > 5
            }
            onClick={handleOpenLeadershipElection}
          >
            {isPending ? "Opening..." : "Open Election"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── Reusable Cabinet / Shadow Cabinet elections ──────────────
  //
  // A coalition feature: each governing party elects its OWN quota of ministers
  // from its own members (top-k win, party-scoped voting). Cabinet = the RULING
  // parties; Shadow Cabinet = the OPPOSITION parties. The total seats is
  // editable (defaults to MINISTRIES.length = 8) and the per-party quota
  // re-derives live via distributeSeats(). Rendered in the no-session branch and
  // after a revealed minister result so the organiser can run each party in turn.

  // Per-side quota: distribute totalCabinetSeats across that side's parties.
  // distributeSeats is fed each party's member_count (already sourced by
  // getEventParties). Returns a partyId → seats lookup.
  function quotaForSide(side: "ruling" | "opposition"): Record<string, number> {
    const sideParties = parties.filter((p) => p.side === side);
    if (sideParties.length === 0) return {};
    const totalSeats = side === "ruling" ? totalCabinetSeats : totalShadowSeats;
    const dist = distributeSeats(
      sideParties.map((p) => ({ partyId: p.id, members: p.member_count })),
      totalSeats
    );
    const map: Record<string, number> = {};
    dist.forEach((d) => {
      map[d.partyId] = d.seats;
    });
    return map;
  }

  // One coalition section (Cabinet or Shadow Cabinet). Lists each side's parties
  // with their quota + a "Hold … Election" button.
  function ministerSection(
    voteType: "cabinet_minister" | "shadow_minister",
    side: "ruling" | "opposition"
  ) {
    const sideParties = parties.filter((p) => p.side === side);
    if (sideParties.length === 0) return null;
    const quota = quotaForSide(side);
    const isCabinet = voteType === "cabinet_minister";
    // Cabinet and Shadow each bind to their own total-seats state.
    const totalSeats = isCabinet ? totalCabinetSeats : totalShadowSeats;
    const setTotalSeats = isCabinet ? setTotalCabinetSeats : setTotalShadowSeats;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Landmark
            className={cn(
              "size-4",
              isCabinet ? "text-[#138808]" : "text-[#FF9933]"
            )}
          />
          {isCabinet ? "Cabinet" : "Shadow Cabinet"}
        </div>
        <p className="text-xs text-gray-500">
          Each {isCabinet ? "governing" : "opposition"} party elects its own
          ministers — only that party&apos;s members vote, and the top vote-getters
          win the party&apos;s seats. Hold one election at a time.
        </p>
        {/* Editable total seats — quotas re-derive live */}
        <div className="flex items-center gap-2 rounded-lg border bg-gray-50/60 p-2.5">
          <Label
            htmlFor={`total-seats-${voteType}`}
            className="text-xs text-gray-600"
          >
            Total {isCabinet ? "cabinet" : "shadow"} seats
          </Label>
          <Input
            id={`total-seats-${voteType}`}
            type="number"
            min={1}
            value={totalSeats}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setTotalSeats(Number.isFinite(n) && n >= 1 ? n : 1);
            }}
            className="h-8 w-20 text-sm"
          />
          <span className="text-xs text-gray-400">across {sideParties.length} {sideParties.length === 1 ? "party" : "parties"}</span>
        </div>
        <div className="space-y-2">
          {sideParties.map((party) => {
            const seats = quota[party.id] ?? 0;
            const tooFew = party.member_count < seats;
            return (
              <div
                key={party.id}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {party.name} — {seats} seat{seats === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {party.member_count} member
                    {party.member_count === 1 ? "" : "s"}
                    {tooFew && (
                      <span className="ml-1 text-red-600">
                        · too few members for {seats} seats
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    isPending ||
                    seats < 1 ||
                    party.member_count < seats ||
                    !currentAgendaItem
                  }
                  onClick={() =>
                    handleHoldMinisterElection(voteType, party, seats)
                  }
                >
                  <Vote className="size-3.5 mr-1" />
                  Hold {isCabinet ? "Cabinet" : "Shadow"} Election
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const cabinetSection = ministerSection("cabinet_minister", "ruling");
  const shadowSection = ministerSection("shadow_minister", "opposition");

  // Speaker launcher — agenda-pinned (only on the Speaker Election item), folded
  // into the same "Run an election" menu as the run-anytime launchers.
  const speakerLauncher =
    agendaType === "speaker_election" ? (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Nominate Speaker candidates — pick anyone, any number, from any party
          (at least 2). The whole House elects the Speaker; the runner-up
          becomes Deputy Speaker.
        </p>
        <Button
          size="sm"
          disabled={isPending}
          onClick={handleHoldSpeakerNomination}
          className="w-full"
        >
          <Crown className="size-3.5 mr-1.5" />
          Nominate Speakers
        </Button>
      </div>
    ) : null;

  // Bill vote launcher — agenda-pinned (only on the Bill Presentation item).
  const billLauncher =
    agendaType === "bill_presentation" ? (
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Select a bill to open for voting. Participants will vote Aye, Nay, or
          Abstain.
        </p>
        {bills.length > 0 ? (
          <div className="space-y-2">
            {bills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between rounded-lg border bg-white p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {bill.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {bill.committee_name ??
                      `${
                        bill.party_side === "ruling"
                          ? "Ruling Party"
                          : bill.party_side === "opposition"
                            ? "Opposition"
                            : "Committee"
                      } Bill`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleOpenBillVote(bill)}
                >
                  <Landmark className="size-3.5 mr-1" />
                  Vote
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-4 text-sm text-muted-foreground">
            No bills available for voting. Bills need to be submitted first.
          </p>
        )}
      </div>
    ) : null;

  // Every vote launcher (Speaker, Bill, and the run-anytime elections) behind one
  // menu so the panel isn't cluttered with all of them. The menu AUTO-OPENS (see
  // effect below) when the current agenda item has its OWN vote (Speaker / Bill),
  // so that primary action is visible without a tap; otherwise it's collapsed.
  const hasElectionLaunchers =
    !!speakerLauncher ||
    !!billLauncher ||
    !!partyLeaderList ||
    !!leadershipList ||
    !!cabinetSection ||
    !!shadowSection;
  const electionLaunchers = hasElectionLaunchers ? (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setElectionsMenuOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          <Crown className="size-4 text-[#FF9933]" />
          Run a vote
          <span className="hidden text-xs font-normal text-muted-foreground sm:inline">
            speaker · bill · party leader · PM / Deputy / LoP · cabinet · shadow
          </span>
        </span>
        {electionsMenuOpen ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {electionsMenuOpen && (
        <div className="space-y-4 border-t p-3">
          {speakerLauncher}
          {billLauncher}
          {partyLeaderList}
          {leadershipList}
          {cabinetSection}
          {shadowSection}
        </div>
      )}
    </div>
  ) : null;

  // The Cabinet/Shadow nomination dialog (pick at least `seats` party members →
  // open the multi-seat vote).
  const ministerNominationDialog = (
    <Dialog
      open={ministerDialog.open}
      onOpenChange={(open) =>
        setMinisterDialog((prev) =>
          open
            ? { ...prev, open }
            : {
                open: false,
                voteType: null,
                party: null,
                seats: 0,
                members: [],
                selectedIds: [],
                loading: false,
              }
        )
      }
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {ministerDialog.party
              ? `${ministerDialog.party.name} — ${
                  ministerDialog.voteType === "cabinet_minister"
                    ? "Cabinet"
                    : "Shadow Cabinet"
                } Election`
              : "Cabinet Election"}
          </DialogTitle>
          <DialogDescription>
            This party elects {ministerDialog.seats} minister
            {ministerDialog.seats === 1 ? "" : "s"}. Choose the candidates (at
            least {ministerDialog.seats}). Only this party&apos;s members can
            vote, and the top {ministerDialog.seats} vote-getter
            {ministerDialog.seats === 1 ? "" : "s"} win.
          </DialogDescription>
        </DialogHeader>

        {ministerDialog.members.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={nomineeSearch}
              onChange={(e) => setNomineeSearch(e.target.value)}
              placeholder="Search by name, constituency or No."
              className="h-8 pl-8 text-sm"
            />
          </div>
        )}

        {ministerDialog.loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading members...
          </div>
        ) : ministerDialog.members.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            This party has no members to nominate.
          </p>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {filterNominees(ministerDialog.members).map((m) => {
              const checked = ministerDialog.selectedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMinisterNominee(m.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all",
                    checked
                      ? "border-[#FF9933] bg-[#FF9933]/5"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {m.full_name}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {candidateSubtitle(m)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "ml-2 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                      checked
                        ? "border-[#FF9933] bg-[#FF9933]"
                        : "border-gray-300 bg-white"
                    )}
                  >
                    {checked && <CheckCircle2 className="size-3.5 text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {ministerDialog.selectedIds.length} selected · need{" "}
            {ministerDialog.seats}
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setMinisterDialog({
                open: false,
                voteType: null,
                party: null,
                seats: 0,
                members: [],
                selectedIds: [],
                loading: false,
              })
            }
          >
            Cancel
          </Button>
          <Button
            disabled={
              isPending ||
              ministerDialog.selectedIds.length < ministerDialog.seats ||
              ministerDialog.selectedIds.length < 2
            }
            onClick={handleOpenMinisterElection}
          >
            {isPending ? "Opening..." : "Open Election"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // The Speaker nomination dialog — whole-House pool grouped by party for easy
  // browsing, but nomination is OPEN: pick anyone, any number, from any party.
  // The only floor is 2 candidates total (a real vote needs at least two
  // names). Equal representation is decided at the vote, not at nomination.
  const speakerSelectedIds = Object.values(speakerDialog.selectedByParty).flat();
  const speakerValid = speakerSelectedIds.length >= 2;
  const speakerNominationDialog = (
    <Dialog
      open={speakerDialog.open}
      onOpenChange={(open) =>
        setSpeakerDialog((prev) =>
          open
            ? { ...prev, open }
            : { open: false, groups: [], selectedByParty: {}, loading: false }
        )
      }
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nominate Speakers</DialogTitle>
          <DialogDescription>
            Pick any members as Speaker nominees — any number, from any party
            (at least 2). The whole House then elects the Speaker; the runner-up
            becomes Deputy Speaker.
          </DialogDescription>
        </DialogHeader>

        {speakerDialog.groups.length > 0 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={nomineeSearch}
              onChange={(e) => setNomineeSearch(e.target.value)}
              placeholder="Search by name, constituency or No."
              className="h-8 pl-8 text-sm"
            />
          </div>
        )}

        {speakerDialog.loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading members...
          </div>
        ) : speakerDialog.groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No party members available to nominate.
          </p>
        ) : (
          <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {speakerDialog.groups.map((g) => {
              const picks = speakerDialog.selectedByParty[g.party.id] ?? [];
              const visible = filterNominees(g.members);
              if (visible.length === 0) return null;
              return (
                <div key={g.party.id} className="space-y-1.5">
                  <p className="flex items-center justify-between px-0.5 text-xs font-semibold text-gray-600">
                    <span>{g.party.name}</span>
                    <span className="text-gray-400">
                      {picks.length > 0 ? `${picks.length} selected` : ""}
                    </span>
                  </p>
                  {visible.map((m) => {
                    const checked = picks.includes(m.id);
                    const atCap = false; // open nomination — no per-party cap
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={atCap}
                        onClick={() => toggleSpeakerNominee(g.party.id, m.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border-2 p-3 text-left transition-all",
                          checked
                            ? "border-[#FF9933] bg-[#FF9933]/5"
                            : "border-gray-200 bg-white hover:border-gray-300",
                          atCap && "opacity-50"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">
                            {m.full_name}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {candidateSubtitle(m)}
                          </p>
                        </div>
                        <div
                          className={cn(
                            "ml-2 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                            checked
                              ? "border-[#FF9933] bg-[#FF9933]"
                              : "border-gray-300 bg-white"
                          )}
                        >
                          {checked && (
                            <CheckCircle2 className="size-3.5 text-white" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <span className="mr-auto self-center text-xs text-muted-foreground">
            {speakerSelectedIds.length} selected · pick at least 2
          </span>
          <Button
            variant="outline"
            onClick={() =>
              setSpeakerDialog({
                open: false,
                groups: [],
                selectedByParty: {},
                loading: false,
              })
            }
          >
            Cancel
          </Button>
          <Button
            disabled={isPending || !speakerValid}
            onClick={handleOpenSpeakerElection}
          >
            {isPending ? "Opening..." : "Open Election"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ─── If not a voting agenda type and no active session, don't render ─

  if (!showVoteControls && !voteSession) return null;

  // ─── Active vote session ──────────────────────────────────────
  // While `startingNew` is set (organiser chose to re-vote a revealed item),
  // fall through to the open-voting controls instead of the result card. The
  // flag is only ever true for a revealed session and clears the moment a new
  // session is opened (effect above), so open/closed sessions are unaffected.

  if (voteSession && (isOpen || isClosed || (isRevealed && !startingNew))) {
    const maxVotes = Math.max(...tallies.map((t) => t.count), 1);

    return (
      <>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
                <Vote className="size-4" />
                {voteSession.vote_type === "speaker_election"
                  ? "Speaker Election"
                  : voteSession.vote_type === "party_leader"
                  ? `${
                      parties.find((p) => p.id === activeLeaderPartyId)?.name ??
                      "Party"
                    } Leader Election`
                  : isMinisterVoteType
                  ? `${seatTitle(voteSession.vote_type)} — ${
                      parties.find((p) => p.id === activeMinisterPartyId)?.name ??
                      "Party"
                    }`
                  : isBenchVoteType
                  ? seatTitle(voteSession.vote_type)
                  : "Bill Vote"}
              </CardTitle>
              <Badge
                variant="secondary"
                className={cn(
                  isOpen && "bg-green-100 text-green-700 animate-pulse",
                  isClosed && "bg-amber-100 text-amber-700",
                  isRevealed && "bg-blue-100 text-blue-700"
                )}
              >
                {isOpen ? "Voting Open" : isClosed ? "Closed" : "Results Revealed"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Vote count header */}
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-3.5" />
                Votes Cast
              </span>
              <span className="font-semibold">
                {totalVotes}{" "}
                <span className="font-normal text-muted-foreground">
                  / {totalParticipants}
                </span>
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF9933] to-[#E68A2E] transition-all duration-500"
                style={{
                  width: `${
                    totalParticipants > 0
                      ? Math.min((totalVotes / totalParticipants) * 100, 100)
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Live Tally Bars */}
            {tallies.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <BarChart3 className="size-3.5" />
                  {isRevealed ? "Final Results" : "Live Tally (Organizer Only)"}
                </div>
                {tallies.map((tally) => {
                  const percentage =
                    totalVotes > 0
                      ? Math.round((tally.count / totalVotes) * 100)
                      : 0;
                  // Only crown an UNAMBIGUOUS single leader. On a tie (top count
                  // shared by >1 option) the outcome is "tie → runoff", so
                  // highlighting one tied candidate as the winner is wrong.
                  const topCount = tallies[0]?.count ?? 0;
                  const isWinner =
                    isRevealed &&
                    topCount > 0 &&
                    tally.count === topCount &&
                    tallies.filter((t) => t.count === topCount).length === 1;

                  // Determine label and color
                  let label = tally.vote_value;
                  let barColor = "bg-gray-400";

                  if (
                    voteSession.vote_type === "speaker_election" ||
                    voteSession.vote_type === "party_leader" ||
                    isBenchVoteType ||
                    isMinisterVoteType
                  ) {
                    const candidate = candidates.find(
                      (c) => c.id === tally.vote_value
                    );
                    label = candidate?.full_name ?? tally.vote_value;
                    barColor = "bg-[#FF9933]";
                  } else {
                    // Bill vote
                    if (tally.vote_value === "aye") {
                      label = "AYE";
                      barColor = "bg-green-500";
                    } else if (tally.vote_value === "nay") {
                      label = "NAY";
                      barColor = "bg-red-500";
                    } else if (tally.vote_value === "abstain") {
                      label = "ABSTAIN";
                      barColor = "bg-gray-400";
                    }
                  }

                  return (
                    <div key={tally.vote_value} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span
                          className={cn(
                            "flex items-center gap-1.5 font-medium",
                            isWinner
                              ? "text-amber-700"
                              : "text-gray-700"
                          )}
                        >
                          {isWinner && (
                            <Crown className="size-3.5 text-amber-500" />
                          )}
                          {label}
                        </span>
                        <span className="text-sm tabular-nums text-gray-600">
                          {tally.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            barColor,
                            isWinner && "ring-2 ring-amber-300"
                          )}
                          style={{
                            width: `${
                              maxVotes > 0
                                ? (tally.count / maxVotes) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Bill result summary */}
                {isRevealed && voteSession.vote_type === "bill_vote" && (
                  <div className="mt-3 rounded-lg border p-3 text-center">
                    {(() => {
                      const ayes =
                        tallies.find((t) => t.vote_value === "aye")?.count ?? 0;
                      const nays =
                        tallies.find((t) => t.vote_value === "nay")?.count ?? 0;
                      const passed = ayes > nays;
                      return (
                        <div
                          className={cn(
                            "flex items-center justify-center gap-2 text-lg font-bold",
                            passed ? "text-green-700" : "text-red-700"
                          )}
                        >
                          {passed ? (
                            <CheckCircle2 className="size-5" />
                          ) : (
                            <XCircle className="size-5" />
                          )}
                          {passed ? "BILL PASSED" : "BILL REJECTED"}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Speaker election result: Speaker (#1) + Deputy Speakers (#2,#3).
                    A DEPUTY-seat runoff must not be read as a Speaker election —
                    its winner takes the open deputy seat (the server reveal writes
                    the authoritative roles; this block mirrors that reading). */}
                {isRevealed &&
                  voteSession.vote_type === "speaker_election" &&
                  (() => {
                    const nameOf = (id: string) =>
                      candidates.find((c) => c.id === id)?.full_name ?? id;
                    const cfg = (voteSession.config ?? {}) as {
                      isRunoff?: boolean;
                      runoffSeat?: string;
                      openDeputySeats?: number;
                    };
                    const outcome =
                      cfg.isRunoff && cfg.runoffSeat === "deputy"
                        ? (() => {
                            const dep = computeDeputyRunoffOutcome(
                              tallies,
                              cfg.openDeputySeats ?? 1
                            );
                            return {
                              speakerId: null,
                              deputyIds: dep.deputyIds,
                              partyLeaderId: null,
                              tie: dep.tie,
                            };
                          })()
                        : computeElectionOutcome("speaker_election", tallies);
                    return (
                      <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm">
                        {outcome.speakerId && (
                          <div className="flex items-center gap-2 font-semibold text-amber-700">
                            <Crown className="size-4 text-amber-500" />
                            Speaker: {nameOf(outcome.speakerId)}
                          </div>
                        )}
                        {outcome.deputyIds.length > 0 && (
                          <div className="text-gray-700">
                            Deputy Speaker
                            {outcome.deputyIds.length > 1 ? "s" : ""}:{" "}
                            {outcome.deputyIds.map(nameOf).join(", ")}
                          </div>
                        )}
                        {outcome.tie && (
                          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                            <div className="font-medium text-amber-800">
                              Tie for the{" "}
                              {outcome.tie.seat === "speaker"
                                ? "Speaker seat"
                                : "2nd Deputy Speaker seat"}{" "}
                              ({outcome.tie.tiedCount} votes each):{" "}
                              {outcome.tie.tiedCandidateIds.map(nameOf).join(", ")}
                            </div>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={handleRunoff}
                              className="w-full"
                            >
                              Open 60-second runoff
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Party-leader election result: elected leader + tie runoff */}
                {isRevealed &&
                  voteSession.vote_type === "party_leader" &&
                  (() => {
                    const nameOf = (id: string) =>
                      candidates.find((c) => c.id === id)?.full_name ?? id;
                    const outcome = computeElectionOutcome("party_leader", tallies);
                    const partyName =
                      parties.find((p) => p.id === activeLeaderPartyId)?.name ??
                      "Party";
                    return (
                      <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm">
                        {outcome.partyLeaderId && (
                          <div className="flex items-center gap-2 font-semibold text-amber-700">
                            <Crown className="size-4 text-amber-500" />
                            {partyName} Leader: {nameOf(outcome.partyLeaderId)}
                          </div>
                        )}
                        {outcome.tie && (
                          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                            <div className="font-medium text-amber-800">
                              Tie for {partyName} Leader (
                              {outcome.tie.tiedCount} votes each):{" "}
                              {outcome.tie.tiedCandidateIds.map(nameOf).join(", ")}
                            </div>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={handleRunoff}
                              className="w-full"
                            >
                              Open 60-second runoff
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Bench-seat election result (PM / Deputy PM / LoP): elected
                    winner via outcome.winnerId + tie runoff (same reading as
                    party_leader — top-1 wins, top-count tie → runoff). */}
                {isRevealed &&
                  isBenchVoteType &&
                  (() => {
                    const nameOf = (id: string) =>
                      candidates.find((c) => c.id === id)?.full_name ?? id;
                    const outcome = computeElectionOutcome(
                      voteSession.vote_type,
                      tallies
                    );
                    const title = seatTitle(voteSession.vote_type).replace(
                      " Election",
                      ""
                    );
                    return (
                      <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm">
                        {outcome.winnerId && (
                          <div className="flex items-center gap-2 font-semibold text-amber-700">
                            <Crown className="size-4 text-amber-500" />
                            {title}: {nameOf(outcome.winnerId)}
                          </div>
                        )}
                        {outcome.tie && (
                          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                            <div className="font-medium text-amber-800">
                              Tie for {title} ({outcome.tie.tiedCount} votes
                              each):{" "}
                              {outcome.tie.tiedCandidateIds
                                .map(nameOf)
                                .join(", ")}
                            </div>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={handleRunoff}
                              className="w-full"
                            >
                              Open 60-second runoff
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Cabinet / Shadow minister result (multi-seat, per-party):
                    the top-k elected ministers via computeMultiSeatOutcome +
                    cutline tie runoff. The session config.seats is the seats
                    contested THIS round (full quota on round 1, remaining open
                    seats on a runoff). */}
                {isRevealed &&
                  isMinisterVoteType &&
                  voteSession.vote_type !== "speaker_election" &&
                  (() => {
                    const nameOf = (id: string) =>
                      candidates.find((c) => c.id === id)?.full_name ?? id;
                    const seatType = voteSession.vote_type as
                      | "cabinet_minister"
                      | "shadow_minister";
                    const ms = computeMultiSeatOutcome(
                      tallies,
                      activeMinisterSeats,
                      seatType
                    );
                    const partyName =
                      parties.find((p) => p.id === activeMinisterPartyId)
                        ?.name ?? "Party";
                    const roleWord =
                      seatType === "cabinet_minister"
                        ? "Cabinet Minister"
                        : "Shadow Minister";
                    return (
                      <div className="mt-3 space-y-2 rounded-lg border p-3 text-sm">
                        {ms.winnerIds.length > 0 && (
                          <div className="space-y-1">
                            <div className="font-semibold text-amber-700">
                              {partyName} {roleWord}
                              {ms.winnerIds.length === 1 ? "" : "s"} elected:
                            </div>
                            <ul className="space-y-0.5">
                              {ms.winnerIds.map((id) => (
                                <li
                                  key={id}
                                  className="flex items-center gap-2 text-gray-700"
                                >
                                  <Crown className="size-3.5 text-amber-500" />
                                  {nameOf(id)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {ms.tie && (
                          <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-2">
                            <div className="font-medium text-amber-800">
                              Tie for the last {roleWord} seat (
                              {ms.tie.tiedCount} votes each):{" "}
                              {ms.tie.tiedCandidateIds.map(nameOf).join(", ")}
                            </div>
                            <Button
                              size="sm"
                              disabled={isPending}
                              onClick={handleRunoff}
                              className="w-full"
                            >
                              Open 60-second runoff
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {isOpen && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={handleCloseVoting}
                  className="flex-1"
                >
                  <StopCircle className="size-3.5 mr-1" />
                  Close Voting
                </Button>
              )}
              {isClosed && (
                <Button
                  size="sm"
                  disabled={isPending}
                  onClick={handleRevealResults}
                  className="flex-1"
                >
                  <Eye className="size-3.5 mr-1" />
                  Reveal Results
                </Button>
              )}
              {/* Once results are revealed, let the organiser open a fresh
                  ballot for the same item without deleting the old session in
                  the DB. Party-leader and leadership elections use their own
                  launch flows below, so this is only for speaker/bill votes. */}
              {isRevealed &&
                voteSession.vote_type !== "party_leader" &&
                !isBenchVoteType &&
                !isMinisterVoteType &&
                currentAgendaItem && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={handleStartNewVote}
                    className="flex-1"
                  >
                    <Vote className="size-3.5 mr-1" />
                    Start new vote
                  </Button>
                )}
            </div>

            {/* Floor capture — manual roll-call entry, only while open */}
            {isOpen && (
              <FloorCapture
                eventId={eventId}
                sessionId={voteSession.id}
                voteType={voteSession.vote_type}
                candidates={candidates}
              />
            )}

            {/* After ANY result is revealed, surface EVERY launch list again so
                the organiser can run the next election in any category — the next
                bench seat (PM → Deputy PM → LoP), the next party's Cabinet/Shadow
                quota, or a party-leader election — without leaving this screen.
                Previously each reveal only re-surfaced its OWN category, which
                stranded the organiser when moving from the bench elections to
                Cabinet/Shadow: the bench reveal hid "Start new vote" and showed
                only the leadership/party-leader lists, with no control to reach
                the coalition sections. Showing all of them keeps the live
                event-day sequence (Speaker → PM/Deputy/LoP → Cabinet/Shadow)
                navigable end to end. */}
            {isRevealed && electionLaunchers && (
              <div className="border-t pt-4">{electionLaunchers}</div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog
          open={confirmDialog.open}
          onOpenChange={(open) =>
            setConfirmDialog((prev) => ({ ...prev, open }))
          }
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirmDialog.title}</DialogTitle>
              <DialogDescription>
                {confirmDialog.description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  setConfirmDialog((prev) => ({ ...prev, open: false }))
                }
              >
                Cancel
              </Button>
              <Button disabled={isPending} onClick={confirmDialog.action}>
                {isPending ? "Processing..." : "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Party-Leader nomination dialog (re-elect / next party after reveal) */}
        {partyLeaderDialog}

        {/* Leadership nomination dialog (next seat after a revealed result) */}
        {leadershipNominationDialog}

        {/* Cabinet/Shadow nomination dialog (next party after a revealed result) */}
        {ministerNominationDialog}

        {/* Speaker nomination dialog (next Speaker election after a reveal) */}
        {speakerNominationDialog}
      </>
    );
  }

  // ─── No active session — Show open voting buttons ─────────────

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Vote className="size-4" />
            Digital Voting
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* All vote launchers — Speaker, Bill, and the run-anytime elections
              — live inside the one "Run a vote" menu below (electionLaunchers).
              It auto-opens (effect above) when the current item has its OWN vote
              (Speaker / Bill). Live vote controls (tally, Close, Reveal) stay in
              their own branch above. */}
          {electionLaunchers}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmDialog((prev) => ({ ...prev, open: false }))
              }
            >
              Cancel
            </Button>
            <Button disabled={isPending} onClick={confirmDialog.action}>
              {isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Party-Leader nomination dialog: pick 3–5 nominees, then open the vote */}
      {partyLeaderDialog}

      {/* Leadership nomination dialog: pick 2–5 bench nominees, then open the vote */}
      {leadershipNominationDialog}

      {/* Cabinet/Shadow nomination dialog: pick the party's nominees, then open */}
      {ministerNominationDialog}

      {/* Speaker nomination dialog: each party picks 1–2, then open the vote */}
      {speakerNominationDialog}
    </>
  );
}

// ─── Floor Capture (manual roll-call + corrections, organiser-only) ──

interface FloorCaptureProps {
  eventId: string;
  sessionId: string;
  voteType: string;
  candidates: VoteCandidate[];
}

const BILL_CHOICES: Array<{ value: string; label: string; cls: string }> = [
  { value: "aye", label: "AYE", cls: "bg-green-600 hover:bg-green-700 text-white" },
  { value: "nay", label: "NO", cls: "bg-red-600 hover:bg-red-700 text-white" },
  {
    value: "abstain",
    label: "ABSTAIN",
    cls: "bg-gray-500 hover:bg-gray-600 text-white",
  },
];

function FloorCapture({ eventId, sessionId, voteType, candidates }: FloorCaptureProps) {
  const [panel, setPanel] = useState<FloorPanel | null>(null);
  const [rollOpen, setRollOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Bulk "show of hands" (BUG-394): gated by the per-event allowBulk switch.
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [allowBulkBusy, setAllowBulkBusy] = useState(false);

  // Pending row currently awaiting one-tap confirm: participantId + chosen value.
  const [confirming, setConfirming] = useState<{
    participantId: string;
    value: string;
  } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Edit dialog state for corrections.
  const [editEntry, setEditEntry] = useState<FloorManualEntry | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const candidateName = useCallback(
    (value: string) =>
      candidates.find((c) => c.id === value)?.full_name ?? value,
    [candidates]
  );

  // Candidate ballots (speaker + party-leader + the bench seats PM / Deputy PM /
  // Leader of Opposition) resolve a participant name; bills resolve a fixed
  // aye/nay/abstain label.
  const isCandidateBallot =
    voteType === "speaker_election" ||
    voteType === "party_leader" ||
    voteType === "prime_minister" ||
    voteType === "deputy_prime_minister" ||
    voteType === "leader_of_opposition" ||
    voteType === "cabinet_minister" ||
    voteType === "shadow_minister";

  const labelForValue = useCallback(
    (value: string) => {
      if (isCandidateBallot) return candidateName(value);
      if (value === "aye") return "AYE";
      if (value === "nay") return "NO";
      if (value === "abstain") return "ABSTAIN";
      return value;
    },
    [isCandidateBallot, candidateName]
  );

  const refresh = useCallback(async () => {
    const result = await getFloorPanel(sessionId);
    if (result.success) setPanel(result.data);
  }, [sessionId]);

  // Poll every 5s while the session is open; stop on close/unmount.
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await getFloorPanel(sessionId);
      if (active && result.success) setPanel(result.data);
    })();

    const id = setInterval(() => {
      void (async () => {
        const result = await getFloorPanel(sessionId);
        if (!active) return;
        if (result.success) {
          setPanel(result.data);
          // Stop polling once the organiser closes the session elsewhere.
          if (result.data.status !== "open") clearInterval(id);
        }
      })();
    }, 5000);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, [sessionId]);

  async function handleRecord(participantId: string, value: string) {
    setSavingId(participantId);
    const result = await castFloorVote(sessionId, participantId, value);
    setSavingId(null);
    setConfirming(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    if (result.data.status === "success") {
      toast.success("Vote recorded");
      void refresh();
    } else if (result.data.status === "already_voted") {
      toast.info("This participant has already voted");
      void refresh();
    } else {
      toast.error("Voting is closed");
    }
  }

  // ── Bulk "show of hands" handlers (BUG-394) ──
  async function handleToggleAllowBulk(next: boolean) {
    setAllowBulkBusy(true);
    const res = await setAllowBulkFloorVotes(eventId, next);
    setAllowBulkBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    if (!next) {
      setBulkMode(false);
      setBulkSelected(new Set());
    }
    toast.success(
      next ? "Bulk show-of-hands enabled" : "Bulk show-of-hands disabled"
    );
    void refresh();
  }

  function toggleBulkSelect(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApplyBulk(value: string) {
    const ids = [...bulkSelected];
    if (ids.length === 0) {
      toast.error("Select at least one student first");
      return;
    }
    setBulkBusy(true);
    const res = await castBulkFloorVotes(sessionId, ids, value);
    setBulkBusy(false);
    if (!res.success) {
      toast.error(res.error);
      return;
    }
    const { recorded, skippedAlreadyVoted, skippedNotCheckedIn } = res.data;
    const skips: string[] = [];
    if (skippedAlreadyVoted) skips.push(`${skippedAlreadyVoted} already voted`);
    if (skippedNotCheckedIn)
      skips.push(`${skippedNotCheckedIn} not checked in`);
    toast.success(
      `Recorded ${recorded} ${labelForValue(value)} vote${
        recorded === 1 ? "" : "s"
      }` + (skips.length ? ` · skipped ${skips.join(", ")}` : "")
    );
    setBulkSelected(new Set());
    void refresh();
  }

  function openEdit(entry: FloorManualEntry) {
    setEditEntry(entry);
    setEditValue(entry.voteValue);
    setEditReason("");
  }

  async function handleCorrect() {
    if (!editEntry) return;
    if (!editReason.trim()) {
      toast.error("A reason is required to correct a vote");
      return;
    }
    setEditSaving(true);
    const result = await correctFloorVote(
      editEntry.voteId,
      editValue,
      editReason.trim()
    );
    setEditSaving(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Vote corrected");
    setEditEntry(null);
    void refresh();
  }

  if (!panel) return null;

  const { turnout, channels, volunteers, pending, manualEntries, allowBulk } =
    panel;
  // Bulk picker options: candidate buttons for candidate ballots, else aye/nay/abstain.
  const bulkChoices = isCandidateBallot
    ? candidates.map((c) => ({
        value: c.id,
        label: c.full_name,
        cls: "bg-[#FF9933] hover:bg-[#e88a2e] text-white",
      }))
    : BILL_CHOICES;
  const pct =
    turnout.eligible > 0
      ? Math.min((turnout.cast / turnout.eligible) * 100, 100)
      : 0;

  const filteredPending = pending.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.fullName.toLowerCase().includes(q) ||
      (p.serialNo != null && String(p.serialNo).includes(q))
    );
  });

  return (
    <div className="mt-4 space-y-3 rounded-lg border bg-gray-50/60 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
        <ClipboardList className="size-3.5 text-[#FF9933]" />
        Floor Capture
      </div>

      {/* Turnout bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Turnout</span>
          <span className="font-semibold tabular-nums">
            {turnout.cast}{" "}
            <span className="font-normal text-muted-foreground">
              / {turnout.eligible}
            </span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF9933] to-[#E68A2E] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        {/* Channel chips */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
            Self {channels.self}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
            Kiosk {channels.kiosk}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
            Organizer {channels.organizer}
          </span>
        </div>
      </div>

      {/* Volunteer chips */}
      {volunteers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {volunteers.map((v) => (
            <span
              key={v.volunteerId}
              className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
            >
              {v.name} · {v.count}
            </span>
          ))}
        </div>
      )}

      {/* Roll call (collapsible) */}
      <div className="rounded-md border bg-white">
        <button
          type="button"
          onClick={() => setRollOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-1.5">
            {rollOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Roll call — {pending.length} pending
          </span>
        </button>

        {rollOpen && (
          <div className="space-y-2 border-t px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by serial or name"
                className="h-8 pl-8 text-sm"
              />
            </div>

            {/* Bulk "show of hands" controls (BUG-394) — per-event gated */}
            {!allowBulk ? (
              <button
                type="button"
                onClick={() => handleToggleAllowBulk(true)}
                disabled={allowBulkBusy}
                className="text-xs font-medium text-blue-600 underline hover:text-blue-700 disabled:opacity-50"
              >
                Enable bulk &ldquo;show of hands&rdquo; entry
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBulkMode((m) => !m);
                    setBulkSelected(new Set());
                  }}
                  className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                    bulkMode
                      ? "border-[#FF9933] bg-[#FF9933]/10 text-[#994d00]"
                      : "border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {bulkMode ? "Bulk select: ON" : "Bulk select"}
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllowBulk(false)}
                  disabled={allowBulkBusy}
                  className="text-xs text-gray-400 underline hover:text-gray-600 disabled:opacity-50"
                >
                  Turn off bulk
                </button>
              </div>
            )}

            {filteredPending.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                {pending.length === 0
                  ? "Everyone has voted."
                  : "No matches."}
              </p>
            ) : bulkMode && allowBulk ? (
              <>
                <div className="flex items-center justify-between px-1 text-xs text-gray-500">
                  <span>{bulkSelected.size} selected</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="underline hover:text-gray-700"
                      onClick={() =>
                        setBulkSelected(
                          new Set(filteredPending.map((p) => p.participantId))
                        )
                      }
                    >
                      Select all ({filteredPending.length})
                    </button>
                    <button
                      type="button"
                      className="underline hover:text-gray-700"
                      onClick={() => setBulkSelected(new Set())}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="max-h-60 space-y-1 overflow-y-auto">
                  {filteredPending.map((p) => {
                    const checked = bulkSelected.has(p.participantId);
                    return (
                      <button
                        key={p.participantId}
                        type="button"
                        onClick={() => toggleBulkSelect(p.participantId)}
                        className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm ${
                          checked
                            ? "border-[#138808] bg-[#138808]/10"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                            checked
                              ? "border-[#138808] bg-[#138808] text-white"
                              : "border-gray-300"
                          }`}
                        >
                          {checked && <Check className="size-3" />}
                        </span>
                        <span className="text-gray-400">
                          {p.serialNo ?? "—"}
                        </span>
                        <span className="truncate text-gray-900">
                          {p.fullName}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {/* Apply bar */}
                <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t bg-white pt-2">
                  <span className="text-xs text-gray-500">
                    Apply to {bulkSelected.size}:
                  </span>
                  {bulkChoices.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      disabled={bulkBusy || bulkSelected.size === 0}
                      onClick={() => handleApplyBulk(c.value)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-40 ${c.cls}`}
                    >
                      {c.label}
                    </button>
                  ))}
                  {bulkBusy && (
                    <Loader2 className="size-3.5 animate-spin text-gray-400" />
                  )}
                </div>
              </>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {filteredPending.map((p) => (
                  <RollCallRow
                    key={p.participantId}
                    participant={p}
                    voteType={voteType}
                    candidates={candidates}
                    confirming={
                      confirming?.participantId === p.participantId
                        ? confirming.value
                        : null
                    }
                    saving={savingId === p.participantId}
                    labelForValue={labelForValue}
                    onPick={(value) =>
                      setConfirming({ participantId: p.participantId, value })
                    }
                    onCancel={() => setConfirming(null)}
                    onConfirm={(value) => handleRecord(p.participantId, value)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual entries (collapsible) */}
      <div className="rounded-md border bg-white">
        <button
          type="button"
          onClick={() => setManualOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-1.5">
            {manualOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Manual entries ({manualEntries.length})
          </span>
        </button>

        {manualOpen && (
          <div className="border-t px-3 py-2">
            {manualEntries.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No manual or kiosk entries yet.
              </p>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {manualEntries.map((e) => (
                  <div
                    key={e.voteId}
                    className="flex items-center justify-between gap-2 rounded-md border bg-gray-50/60 px-2.5 py-1.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">
                        {e.serialNo != null && (
                          <span className="text-gray-400">#{e.serialNo} </span>
                        )}
                        {e.fullName}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {labelForValue(e.voteValue)} ·{" "}
                        {e.entryMethod === "volunteer_kiosk"
                          ? `Kiosk: ${e.recordedBy ?? "Volunteer"}`
                          : "Organizer"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 shrink-0 p-0"
                      onClick={() => openEdit(e)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Correction dialog */}
      <Dialog
        open={!!editEntry}
        onOpenChange={(open) => {
          if (!open) setEditEntry(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct Vote</DialogTitle>
            <DialogDescription>
              {editEntry
                ? `Update the recorded vote for ${
                    editEntry.serialNo != null ? `#${editEntry.serialNo} ` : ""
                  }${editEntry.fullName}. This is logged in the audit trail.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="floor-correct-value">New value</Label>
              {isCandidateBallot ? (
                <Select
                  value={editValue}
                  onValueChange={(v) => setEditValue(v ?? "")}
                >
                  <SelectTrigger id="floor-correct-value">
                    <SelectValue placeholder="Select candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={editValue}
                  onValueChange={(v) => setEditValue(v ?? "")}
                >
                  <SelectTrigger id="floor-correct-value">
                    <SelectValue placeholder="Select value" />
                  </SelectTrigger>
                  <SelectContent>
                    {BILL_CHOICES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="floor-correct-reason">Reason (required)</Label>
              <Textarea
                id="floor-correct-reason"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Why is this correction being made?"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>
              Cancel
            </Button>
            <Button
              disabled={editSaving || !editReason.trim()}
              onClick={handleCorrect}
            >
              {editSaving ? (
                <>
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Correction"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── A single pending roll-call row (pick → inline confirm → record) ──

interface RollCallRowProps {
  participant: FloorPendingParticipant;
  voteType: string;
  candidates: VoteCandidate[];
  confirming: string | null;
  saving: boolean;
  labelForValue: (value: string) => string;
  onPick: (value: string) => void;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

function RollCallRow({
  participant,
  voteType,
  candidates,
  confirming,
  saving,
  labelForValue,
  onPick,
  onCancel,
  onConfirm,
}: RollCallRowProps) {
  const p = participant;

  return (
    <div className="rounded-md border bg-white px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-800">
            {p.serialNo != null && (
              <span className="text-gray-400">#{p.serialNo} </span>
            )}
            {p.fullName}
          </p>
          {p.constituencyName && (
            <p className="truncate text-[11px] text-gray-500">
              {p.constituencyName}
            </p>
          )}
        </div>

        {/* Quick vote controls (only when not mid-confirm) */}
        {!confirming &&
          (voteType === "speaker_election" ||
          voteType === "party_leader" ||
          voteType === "prime_minister" ||
          voteType === "deputy_prime_minister" ||
          voteType === "leader_of_opposition" ||
          voteType === "cabinet_minister" ||
          voteType === "shadow_minister" ? (
            <Select
              onValueChange={(v: string | null) => {
                if (v) onPick(v);
              }}
              disabled={saving}
            >
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue placeholder="Candidate" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex shrink-0 gap-1">
              {BILL_CHOICES.map((b) => (
                <Button
                  key={b.value}
                  size="sm"
                  disabled={saving}
                  className={cn("h-7 px-2 text-[11px]", b.cls)}
                  onClick={() => onPick(b.value)}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          ))}
      </div>

      {/* Inline one-tap confirm */}
      {confirming && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md bg-amber-50 px-2.5 py-1.5 ring-1 ring-amber-200">
          <span className="text-xs text-amber-800">
            Record {labelForValue(confirming)} for{" "}
            {p.serialNo != null ? `#${p.serialNo} ` : ""}
            {p.fullName}?
          </span>
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              disabled={saving}
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={saving}
              onClick={() => onConfirm(confirming)}
            >
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Confirm"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
