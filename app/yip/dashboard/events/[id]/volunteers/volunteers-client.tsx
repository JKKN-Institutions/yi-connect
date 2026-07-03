"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/yip/ui/badge";
import { Button } from "@/components/yip/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Input } from "@/components/yip/ui/input";
import {
  Plus,
  Loader2,
  UserCheck,
  Trash2,
  Users,
  Shield,
  CheckCircle2,
  KeyRound,
  Copy,
  Check,
  X,
} from "lucide-react";
import { VOLUNTEER_STATIONS, type VolunteerStation } from "@/lib/yip/volunteers";
import {
  addVolunteer,
  markVolunteerArrived,
  deleteVolunteer,
  generateVolunteerCode,
  generateAllVolunteerCodes,
  revokeVolunteerCode,
  type Volunteer,
} from "@/app/yip/actions/volunteers";
import { VolunteerCsvImport } from "@/components/yip/volunteer-csv-import";

const STATION_LABEL: Record<string, string> = Object.fromEntries(
  VOLUNTEER_STATIONS.map((s) => [s.code, s.label])
);

const STATION_COLORS: Record<string, string> = {
  registration: "bg-cyan-500",
  help_desk: "bg-blue-500",
  jury_support: "bg-teal-500",
  av_tech: "bg-violet-500",
  room_coordinator: "bg-indigo-500",
  hospitality: "bg-amber-500",
  stage_manager: "bg-rose-500",
  speaker_desk: "bg-orange-500",
  photographer: "bg-pink-500",
  media: "bg-fuchsia-500",
  runner: "bg-emerald-500",
  organiser_helper: "bg-lime-600",
  safety: "bg-red-500",
  floating: "bg-slate-400",
};

const YUVA_MIN = 10; // Handbook p.10

type FormState = {
  full_name: string;
  phone: string;
  email: string;
  station: VolunteerStation;
  shift: string;
  tshirt_size: string;
  is_yuva: boolean;
};

const EMPTY_FORM: FormState = {
  full_name: "",
  phone: "",
  email: "",
  station: "floating",
  shift: "both_days",
  tshirt_size: "",
  is_yuva: true,
};

export function VolunteersClient({
  eventId,
  eventName,
  initialVolunteers,
  canDelete = true,
}: {
  eventId: string;
  eventName: string;
  initialVolunteers: Volunteer[];
  /** Chair/national/regional only. Organisers cannot delete records. */
  canDelete?: boolean;
}) {
  const [volunteers, setVolunteers] = useState(initialVolunteers);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const router = useRouter();

  function submitAdd() {
    if (!form.full_name.trim()) {
      setError("Name required");
      return;
    }
    startTransition(async () => {
      const res = await addVolunteer({
        event_id: eventId,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        station: form.station,
        shift: form.shift || null,
        tshirt_size: form.tshirt_size || null,
        is_yuva: form.is_yuva,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setVolunteers([...volunteers, res.data]);
      setForm(EMPTY_FORM);
      setCreating(false);
      setFlash(`Added ${res.data.full_name}`);
      setTimeout(() => setFlash(null), 2000);
    });
  }

  function toggleArrived(v: Volunteer) {
    const next = !v.arrived;
    // optimistic
    setVolunteers((prev) =>
      prev.map((x) =>
        x.id === v.id
          ? { ...x, arrived: next, arrived_at: next ? new Date().toISOString() : null }
          : x
      )
    );
    startTransition(async () => {
      const res = await markVolunteerArrived(v.id, eventId, next);
      if (!res.success) {
        setError(res.error);
        setVolunteers((prev) =>
          prev.map((x) => (x.id === v.id ? { ...x, arrived: !next } : x))
        );
      }
    });
  }

  function handleDelete(v: Volunteer) {
    if (!confirm(`Remove ${v.full_name} from the volunteer roster?`)) return;
    startTransition(async () => {
      const res = await deleteVolunteer(v.id, eventId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setVolunteers(volunteers.filter((x) => x.id !== v.id));
    });
  }

  function handleGenerateCode(v: Volunteer) {
    startTransition(async () => {
      const res = await generateVolunteerCode(eventId, v.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setVolunteers((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, access_code: res.data.code } : x))
      );
    });
  }

  function handleRevokeCode(v: Volunteer) {
    startTransition(async () => {
      const res = await revokeVolunteerCode(eventId, v.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setVolunteers((prev) =>
        prev.map((x) => (x.id === v.id ? { ...x, access_code: null } : x))
      );
      setConfirmRevoke(null);
    });
  }

  function handleGenerateAll() {
    startTransition(async () => {
      const res = await generateAllVolunteerCodes(eventId);
      if (!res.success) {
        setError(res.error);
        return;
      }
      // Refetch is overkill — just optimistically reflect that all blanks were
      // filled (exact codes are revealed on the next page render / reload).
      setFlash(
        res.data.generated > 0
          ? `Generated ${res.data.generated} code${res.data.generated === 1 ? "" : "s"}`
          : "All volunteers already have codes"
      );
      setTimeout(() => setFlash(null), 2500);
      router.refresh();
    });
  }

  function copyCode(code: string) {
    void navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
  }

  const total = volunteers.length;
  const arrived = volunteers.filter((v) => v.arrived).length;
  const yuvaCount = volunteers.filter((v) => v.is_yuva).length;
  const missingCodes = volunteers.filter((v) => !v.access_code).length;

  const byStation = VOLUNTEER_STATIONS.map((s) => ({
    ...s,
    volunteers: volunteers.filter((v) => v.station === s.code),
  })).filter((g) => g.volunteers.length > 0);

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a1a3e] flex items-center gap-2">
            <Shield className="size-7 text-[#FF9933]" />
            Volunteer Roster
          </h1>
          <p className="text-sm text-[#1a1a3e]/60 mt-1">
            {eventName} · Handbook p.10 · Min {YUVA_MIN} YUVA volunteers required
          </p>
          <p className="text-xs text-[#1a1a3e]/50 mt-1 flex items-center gap-1.5">
            <KeyRound className="size-3 text-[#FF9933]" />
            Volunteers sign in at <span className="font-mono">/yip/join</span> with their code to run voting kiosks on event day.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {missingCodes > 0 && (
            <Button
              variant="outline"
              onClick={handleGenerateAll}
              disabled={pending}
              className="border-[#FF9933]/40 text-[#FF9933] hover:bg-[#FF9933]/10"
            >
              {pending ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="size-4 mr-2" />
              )}
              Generate all codes ({missingCodes})
            </Button>
          )}
          <VolunteerCsvImport
            eventId={eventId}
            onImported={() => router.refresh()}
          />
          <Button
            onClick={() => {
              setCreating(true);
              setError(null);
            }}
            className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
          >
            <Plus className="size-4 mr-2" />
            Add Volunteer
          </Button>
        </div>
      </div>

      {flash && (
        <div className="rounded-lg bg-[#138808]/8 border border-[#138808]/15 px-4 py-2 text-sm text-[#138808]">
          {flash}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-[#FF9933]/10 flex items-center justify-center">
                <Users className="size-5 text-[#FF9933]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1a1a3e]">{total}</div>
                <div className="text-xs text-[#1a1a3e]/60">Total Volunteers</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={yuvaCount < YUVA_MIN ? "border-amber-300" : ""}>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className={`size-9 rounded-lg flex items-center justify-center ${
                yuvaCount < YUVA_MIN ? "bg-amber-100" : "bg-[#138808]/10"
              }`}>
                <Shield className={`size-5 ${
                  yuvaCount < YUVA_MIN ? "text-amber-600" : "text-[#138808]"
                }`} />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1a1a3e]">
                  {yuvaCount}<span className="text-sm text-[#1a1a3e]/40">/{YUVA_MIN} min</span>
                </div>
                <div className="text-xs text-[#1a1a3e]/60">
                  YUVA volunteers{yuvaCount < YUVA_MIN && " · below handbook minimum"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="size-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-[#1a1a3e]">
                  {arrived}/{total}
                </div>
                <div className="text-xs text-[#1a1a3e]/60">Arrived</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add form */}
      {creating && (
        <Card className="border-[#FF9933]/30">
          <CardHeader>
            <CardTitle className="text-base">Add Volunteer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-[#1a1a3e]/70">Name *</label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Station</label>
                <select
                  value={form.station}
                  onChange={(e) =>
                    setForm({ ...form, station: e.target.value as VolunteerStation })
                  }
                  className="w-full border border-input rounded-md px-3 py-2 text-sm"
                >
                  {VOLUNTEER_STATIONS.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Phone</label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/70">Shift</label>
                <select
                  value={form.shift}
                  onChange={(e) => setForm({ ...form, shift: e.target.value })}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm"
                >
                  <option value="both_days">Both days</option>
                  <option value="day1_morning">Day 1 Morning</option>
                  <option value="day1_afternoon">Day 1 Afternoon</option>
                  <option value="day2_morning">Day 2 Morning</option>
                  <option value="day2_afternoon">Day 2 Afternoon</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="is_yuva"
                  checked={form.is_yuva}
                  onChange={(e) => setForm({ ...form, is_yuva: e.target.checked })}
                  className="size-4"
                />
                <label htmlFor="is_yuva" className="text-sm">
                  YUVA volunteer
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false);
                  setError(null);
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                onClick={submitAdd}
                disabled={pending}
                className="bg-[#FF9933] hover:bg-[#FF9933]/90 text-white"
              >
                {pending && <Loader2 className="size-4 mr-2 animate-spin" />}
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stations grid */}
      {byStation.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-[#1a1a3e]/60">
            No volunteers yet. Add at least {YUVA_MIN} YUVA volunteers per handbook p.10.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {byStation.map((g) => (
            <Card key={g.code}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <span className={`size-2 rounded-full ${STATION_COLORS[g.code] ?? "bg-gray-400"}`} />
                  <CardTitle className="text-base">{g.label}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">
                    {g.volunteers.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1">
                {g.volunteers.map((v) => (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-[#1a1a3e]/[0.02] ${
                      v.arrived ? "opacity-75" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#1a1a3e] truncate">
                          {v.full_name}
                        </span>
                        {v.is_yuva && (
                          <Badge className="bg-[#FF9933]/10 text-[#FF9933] border-[#FF9933]/20 text-[9px]">
                            YUVA
                          </Badge>
                        )}
                        {v.arrived && (
                          <Badge className="bg-[#138808]/10 text-[#138808] border-[#138808]/20 text-[9px]">
                            <CheckCircle2 className="size-2.5 mr-0.5" /> Here
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-[#1a1a3e]/50 flex gap-2">
                        {v.phone && <span>{v.phone}</span>}
                        {v.shift && <span>· {v.shift.replace(/_/g, " ")}</span>}
                      </div>
                      {/* Access Code — kiosk login credential */}
                      <div className="mt-1 flex items-center gap-1.5">
                        {v.access_code ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 rounded bg-[#FF9933]/10 border border-[#FF9933]/20 px-2 py-0.5 font-mono text-xs font-semibold tracking-wider text-[#FF9933]">
                              <KeyRound className="size-3" />
                              {v.access_code}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => copyCode(v.access_code as string)}
                              title="Copy code"
                              className="size-6 text-[#1a1a3e]/50 hover:text-[#1a1a3e]"
                            >
                              {copied === v.access_code ? (
                                <Check className="size-3 text-[#138808]" />
                              ) : (
                                <Copy className="size-3" />
                              )}
                            </Button>
                            {confirmRevoke === v.id ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-red-600">
                                Revoke?
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleRevokeCode(v)}
                                  disabled={pending}
                                  title="Confirm revoke"
                                  className="size-6 text-red-600 hover:bg-red-50"
                                >
                                  <Check className="size-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setConfirmRevoke(null)}
                                  title="Keep code"
                                  className="size-6 text-[#1a1a3e]/50 hover:bg-[#1a1a3e]/5"
                                >
                                  <X className="size-3" />
                                </Button>
                              </span>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setConfirmRevoke(v.id)}
                                disabled={pending}
                                title="Revoke code"
                                className="size-6 text-[#1a1a3e]/40 hover:text-red-500 hover:bg-red-50"
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            )}
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleGenerateCode(v)}
                            disabled={pending}
                            className="h-6 px-2 text-[11px] text-[#FF9933] hover:bg-[#FF9933]/10"
                          >
                            <KeyRound className="size-3 mr-1" />
                            Generate code
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleArrived(v)}
                        disabled={pending}
                        title={v.arrived ? "Mark absent" : "Mark arrived"}
                        className={v.arrived ? "text-[#138808]" : ""}
                      >
                        <UserCheck className="size-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(v)}
                          disabled={pending}
                          className="text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Helper line */}
      <p className="text-xs text-[#1a1a3e]/50 text-center">
        Station labels: {VOLUNTEER_STATIONS.map((s) => s.label).join(" · ")}
      </p>
      <p className="text-xs text-[#1a1a3e]/40 text-center">
        <span className="font-mono">{STATION_LABEL.registration}</span>
      </p>
    </div>
  );
}
