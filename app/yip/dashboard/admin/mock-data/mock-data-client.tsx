"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Loader2,
  Sparkles,
  Trash2,
  ShieldAlert,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent } from "@/components/yip/ui/card";
import { Badge } from "@/components/yip/ui/badge";
import { Input } from "@/components/yip/ui/input";
import {
  getMockDataStats,
  seedMockData,
  wipeMockData,
  wipeMockEvent,
  type MockDataStats,
  type MockEventSummary,
} from "@/app/actions/yip/mock-data";
import { MOCK_MARKER } from "@/lib/yip/mock-data";

const TABLE_LABELS: Record<string, string> = {
  seasons: "Seasons",
  events: "Events",
  schools: "Schools",
  people: "People (student profiles)",
  participants: "Participants (role bindings)",
  parties: "Parties",
  jury_assignments: "Jury Assignments",
  scores: "Scores",
  parliamentary_motions: "Parliamentary Motions",
  bills: "Bills",
  questions: "Questions",
  participant_fees: "Participant Fees",
  volunteers: "Volunteers",
  feedback_responses: "Feedback Responses",
  event_media: "Event Media",
  branding_compliance_checks: "Branding Compliance Checks",
  invitation_approvals: "Invitation Approvals",
  promotions: "Promotions",
  registrations: "Registrations",
  organizer_profiles: "Organizer Profiles",
  results: "Results (derived)",
  organizer_checklist: "Organizer Checklist (derived)",
  event_topic_assignments: "Event Topic Assignments (derived)",
};

function levelBadge(level: string) {
  if (level === "chapter")
    return <span className="inline-flex items-center rounded-full bg-[#FF9933]/10 px-2.5 py-0.5 text-xs font-medium text-[#FF9933]">Chapter</span>;
  if (level === "regional")
    return <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">Regional</span>;
  if (level === "national")
    return <span className="inline-flex items-center rounded-full bg-[#138808]/10 px-2.5 py-0.5 text-xs font-medium text-[#138808]">National</span>;
  return <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{level}</span>;
}

export function MockDataClient({ initialStats }: { initialStats: MockDataStats }) {
  const [stats, setStats] = useState<MockDataStats>(initialStats);
  const [message, setMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeOpen, setWipeOpen] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [perEventBusy, setPerEventBusy] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function refresh() {
    const s = await getMockDataStats();
    setStats(s);
  }

  function onSeed() {
    setMessage(null);
    startTransition(async () => {
      const res = await seedMockData();
      if (res.success) {
        setStats(res.data);
        setMessage({
          type: "success",
          text: "Mock data seeded. Click any dashboard surface to see it populated.",
        });
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  }

  function onWipeAll() {
    if (wipeConfirm !== "WIPE MOCK") return;
    setMessage(null);
    startTransition(async () => {
      const res = await wipeMockData();
      if (res.success) {
        await refresh();
        setWipeConfirm("");
        setWipeOpen(false);
        const totalDeleted = Object.values(res.data.deleted).reduce((a, b) => a + b, 0);
        setMessage({
          type: "success",
          text: `Wipe complete. Deleted ${totalDeleted} mock rows across ${
            Object.keys(res.data.deleted).length
          } tables.`,
        });
      } else {
        setMessage({ type: "error", text: res.error });
      }
    });
  }

  async function onWipeEvent(eventId: string) {
    setPerEventBusy(eventId);
    setMessage(null);
    const res = await wipeMockEvent(eventId);
    setPerEventBusy(null);
    if (res.success) {
      await refresh();
      const totalDeleted = Object.values(res.data.deleted).reduce((a, b) => a + b, 0);
      setMessage({
        type: "success",
        text: `Event wiped. Deleted ${totalDeleted} related rows.`,
      });
    } else {
      setMessage({ type: "error", text: res.error });
    }
  }

  const totalMockRows = Object.values(stats.counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a3e]">Mock Data</h1>
          <p className="text-sm text-[#1a1a3e]/60">
            Seed a realistic end-to-end demo event — then wipe it cleanly when real chapter data lands.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => startTransition(refresh)}
          disabled={pending}
          className="gap-2"
        >
          <RotateCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* ── Warning banner ───────────────────────────────────────── */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-600 mt-0.5" />
        <div className="text-sm text-amber-900 space-y-1">
          <p className="font-medium">This seeds demo data.</p>
          <p>
            Do <span className="font-semibold">not</span> run on production with real
            chapter data in flight. Every mock row carries{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-mono text-amber-900">
              is_mock=true
            </code>{" "}
            AND the literal marker{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-mono text-amber-900">
              {MOCK_MARKER}
            </code>{" "}
            in its <code className="text-[11px]">notes</code> /{" "}
            <code className="text-[11px]">note</code> /{" "}
            <code className="text-[11px]">reason</code> field — so wipe can never
            touch a real row.
          </p>
        </div>
      </div>

      {/* ── Message toast ────────────────────────────────────────── */}
      {message && (
        <div
          className={`rounded-lg border p-3 flex items-start gap-2 text-sm ${
            message.type === "success"
              ? "border-green-300 bg-green-50 text-green-900"
              : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* ── Action cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-[#FF9933]/30">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-[#FF9933]" />
              <h2 className="font-semibold text-[#1a1a3e]">Seed Mock Chapter + Journey</h2>
            </div>
            <p className="text-sm text-[#1a1a3e]/70">
              Creates 1 Mock Chapter Round (Erode), 30 students, 4 jurors, scores,
              motions, bills, questions, fees, volunteers, media — plus a promoted
              journey through Regional → National to prove the end-to-end flow.
            </p>
            <Button
              onClick={onSeed}
              disabled={pending || stats.seeded}
              className="w-full bg-[#FF9933] text-white hover:bg-[#FF9933]/90 disabled:bg-gray-300"
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" /> Seeding…
                </>
              ) : stats.seeded ? (
                "Already seeded — wipe first"
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" /> Seed Mock Data
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-red-200">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Trash2 className="size-5 text-red-600" />
              <h2 className="font-semibold text-[#1a1a3e]">Wipe All Mock Data</h2>
            </div>
            <p className="text-sm text-[#1a1a3e]/70">
              Removes every row flagged as mock across all tables, in FK-safe order.
              Real rows are untouched.
            </p>
            {!wipeOpen ? (
              <Button
                variant="outline"
                onClick={() => setWipeOpen(true)}
                disabled={pending || totalMockRows === 0}
                className="w-full border-red-300 text-red-700 hover:bg-red-50"
              >
                <Trash2 className="size-4 mr-2" /> Wipe All Mock Data
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded border border-red-200 bg-red-50/40 p-2.5 max-h-44 overflow-y-auto">
                  <p className="text-xs font-semibold text-red-800 mb-1.5">
                    Will delete {totalMockRows} rows across these tables:
                  </p>
                  <div className="text-[11px] font-mono text-red-900 space-y-0.5">
                    {Object.entries(stats.counts)
                      .filter(([, c]) => c > 0)
                      .sort(([, a], [, b]) => b - a)
                      .map(([table, c]) => (
                        <div key={table} className="flex justify-between">
                          <span>{TABLE_LABELS[table] ?? table}</span>
                          <span>{c}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <label className="text-xs font-medium text-[#1a1a3e]/80 block">
                  Type <code className="bg-gray-100 px-1 rounded">WIPE MOCK</code> to confirm
                </label>
                <Input
                  value={wipeConfirm}
                  onChange={(e) => setWipeConfirm(e.target.value)}
                  placeholder="WIPE MOCK"
                  className="font-mono"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setWipeOpen(false);
                      setWipeConfirm("");
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onWipeAll}
                    disabled={pending || wipeConfirm !== "WIPE MOCK"}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300"
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Confirm Wipe"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Current mock state ───────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Database className="size-5 text-[#1a1a3e]/70" />
              <h2 className="font-semibold text-[#1a1a3e]">Current Mock State</h2>
            </div>
            <Badge className="bg-[#1a1a3e] text-white">
              {totalMockRows} total mock rows
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-sm">
            {Object.entries(stats.counts).map(([table, count]) => (
              <div
                key={table}
                className={`flex items-center justify-between rounded border p-2 ${
                  count > 0
                    ? "border-[#1a1a3e]/10 bg-white"
                    : "border-gray-100 bg-gray-50 text-[#1a1a3e]/40"
                }`}
              >
                <span className="text-xs truncate">{TABLE_LABELS[table] ?? table}</span>
                <span
                  className={`font-mono text-xs font-semibold ${
                    count > 0 ? "text-[#1a1a3e]" : ""
                  }`}
                >
                  {count}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Per-event list ───────────────────────────────────────── */}
      {stats.events.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold text-[#1a1a3e] mb-3">Mock Events</h2>
            <div className="space-y-2">
              {stats.events.map((ev) => (
                <MockEventRow
                  key={ev.id}
                  event={ev}
                  onWipe={() => onWipeEvent(ev.id)}
                  busy={perEventBusy === ev.id}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Proof-of-safety panel ────────────────────────────────── */}
      <Card>
        <CardContent className="p-5">
          <button
            onClick={() => setProofOpen((v) => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            {proofOpen ? (
              <ChevronDown className="size-4 text-[#1a1a3e]/70" />
            ) : (
              <ChevronRight className="size-4 text-[#1a1a3e]/70" />
            )}
            <ShieldAlert className="size-4 text-[#138808]" />
            <span className="font-semibold text-[#1a1a3e]">Proof of safety</span>
            <span className="text-xs text-[#1a1a3e]/50 ml-2">
              (which rows are counted as mock, and how the wipe avoids real data)
            </span>
          </button>
          {proofOpen && (
            <div className="mt-4 space-y-3 text-sm text-[#1a1a3e]/80">
              <div className="rounded-lg border border-[#138808]/30 bg-[#138808]/5 p-3 space-y-2">
                <p className="font-medium text-[#138808]">Safety contract</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Every direct <code className="text-xs">DELETE</code> is filtered by{" "}
                    <code className="text-xs">is_mock=true</code>. No bare delete is ever issued.
                  </li>
                  <li>
                    Child rows without an <code className="text-xs">is_mock</code> column
                    (results, organizer_checklist, event_topic_assignments, votes,
                    vote_sessions, agenda_items, agenda_speakers, score_audit_log,
                    notifications) are only deleted where their FK resolves to a{" "}
                    <em>mock event</em> or <em>mock score</em>.
                  </li>
                  <li>
                    Every mock row carries the literal marker{" "}
                    <code className="text-xs">{MOCK_MARKER}</code> in its notes / reason
                    field as a second line of defense.
                  </li>
                  <li>
                    Per-event wipe refuses to run unless the target event's{" "}
                    <code className="text-xs">is_mock</code> flag is{" "}
                    <code className="text-xs">true</code>.
                  </li>
                  <li>
                    FK order is respected (leaves first): votes → scores → agenda →
                    motions/bills/questions/fees/volunteers/feedback/media → promotions
                    → invitations → compliance → jury → participants → parties →
                    registrations → events → schools → people → organizer_profiles →
                    seasons.
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-2">Rows that qualify as mock right now</p>
                <div className="rounded border border-[#1a1a3e]/10 divide-y text-xs">
                  {Object.entries(stats.counts)
                    .filter(([, c]) => c > 0)
                    .map(([table, c]) => (
                      <div
                        key={table}
                        className="flex items-center justify-between px-3 py-1.5"
                      >
                        <span>{TABLE_LABELS[table] ?? table}</span>
                        <span className="font-mono">{c}</span>
                      </div>
                    ))}
                  {Object.values(stats.counts).every((c) => c === 0) && (
                    <div className="px-3 py-2 text-[#1a1a3e]/50">
                      No mock rows present. Safe to proceed with real data.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MockEventRow({
  event,
  onWipe,
  busy,
}: {
  event: MockEventSummary;
  onWipe: () => void;
  busy: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-[#1a1a3e]/10 bg-white p-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {levelBadge(event.level)}
          <span className="font-medium text-[#1a1a3e] truncate">{event.name}</span>
        </div>
        <div className="text-xs text-[#1a1a3e]/60 mt-1 flex gap-3 flex-wrap">
          <span>{event.chapter_name ?? "—"}</span>
          <span>
            {event.day1_date} → {event.day2_date}
          </span>
          <span>status: {event.status}</span>
          <span>{event.participants} participants</span>
        </div>
      </div>
      {!confirmOpen ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
          className="shrink-0 border-red-300 text-red-700 hover:bg-red-50"
        >
          <Trash2 className="size-3.5 mr-1.5" /> Wipe
        </Button>
      ) : (
        <div className="flex gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onWipe}
            disabled={busy}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              "Confirm"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
