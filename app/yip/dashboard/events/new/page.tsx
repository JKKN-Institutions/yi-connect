"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createEvent,
  listEventChapters,
  listCommitteeTopics,
  type CommitteeTopicOption,
} from "@/app/yip/actions/events";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Textarea } from "@/components/yip/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CalendarDays,
  MapPin,
  FileText,
} from "lucide-react";

type WizardStep = 1 | 2 | 3;

interface ChapterOption {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  programmeDurationDays: number | null;
}

interface ChapterGroup {
  region: string;
  chapters: ChapterOption[];
}

interface EventFormData {
  name: string;
  level: "chapter" | "regional" | "national";
  yi_chapter_id: string;
  chapter_name: string;
  city: string;
  state: string;
  day1_date: string;
  day2_date: string;
  venue_name: string;
  venue_address: string;
  central_agenda: string;
  committee_topics: Record<string, string>;
}

/** Add (days - 1) days to an ISO yyyy-mm-dd date string, returning yyyy-mm-dd. */
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const STEPS = [
  { num: 1, label: "Basic Info", icon: CalendarDays },
  { num: 2, label: "Agenda & Topics", icon: FileText },
  { num: 3, label: "Review & Create", icon: Check },
] as const;

const LEVEL_OPTIONS = [
  { value: "chapter", label: "Chapter Level" },
  { value: "regional", label: "Regional Level" },
  { value: "national", label: "National Level" },
] as const;

export default function NewEventPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [chapterGroups, setChapterGroups] = useState<ChapterGroup[]>([]);
  const [chaptersLoading, setChaptersLoading] = useState(true);

  // The official 15 committee topics come from the yip.topics catalog (managed
  // at /yip/dashboard/admin/topics). The organiser picks 8–10 for this round;
  // committee_topics holds ONLY the selected committees → their fixed topic.
  const [committeeCatalog, setCommitteeCatalog] = useState<
    CommitteeTopicOption[]
  >([]);
  const [committeesLoading, setCommitteesLoading] = useState(true);

  const [form, setForm] = useState<EventFormData>({
    name: "",
    level: "chapter",
    yi_chapter_id: "",
    chapter_name: "",
    city: "",
    state: "",
    day1_date: "",
    day2_date: "",
    venue_name: "",
    venue_address: "",
    central_agenda: "",
    committee_topics: {},
  });

  // Load the committee catalog on mount. Committees start UNSELECTED — the
  // organiser consciously picks the ones their event will run (2026-06-19).
  // (Previously all 15 were auto-selected, which made the in-event Committees
  // tab open showing "15 selected" and the setup tick meaningless.)
  useEffect(() => {
    let active = true;
    listCommitteeTopics()
      .then((catalog) => {
        if (!active) return;
        setCommitteeCatalog(catalog);
      })
      .catch(() => {
        /* catalog load failed — organiser can still create with no committees */
      })
      .finally(() => {
        if (active) setCommitteesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Load the canonical chapter list (grouped by region) on mount.
  useEffect(() => {
    let active = true;
    listEventChapters()
      .then((groups) => {
        if (active) setChapterGroups(groups);
      })
      .catch(() => {
        if (active) setError("Could not load the chapter list. Please refresh.");
      })
      .finally(() => {
        if (active) setChaptersLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Flat lookup of chapter id -> chapter (+ its region) for auto-fill displays.
  const chapterById = useMemo(() => {
    const map = new Map<string, ChapterOption & { region: string }>();
    for (const group of chapterGroups) {
      for (const chapter of group.chapters) {
        map.set(chapter.id, { ...chapter, region: group.region });
      }
    }
    return map;
  }, [chapterGroups]);

  const selectedChapter = form.yi_chapter_id
    ? chapterById.get(form.yi_chapter_id) ?? null
    : null;

  function updateField<K extends keyof EventFormData>(
    key: K,
    value: EventFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  // Select / deselect a committee for this event. Selecting stores its official
  // topic from the catalog; deselecting removes it. Topics are fixed — not typed.
  function toggleCommittee(committee: string) {
    setForm((prev) => {
      const next = { ...prev.committee_topics };
      if (committee in next) {
        delete next[committee];
      } else {
        next[committee] =
          committeeCatalog.find((c) => c.committee === committee)?.topic ?? "";
      }
      return { ...prev, committee_topics: next };
    });
    setError("");
  }

  // Selecting a chapter auto-fills chapter_name/city/state (kept for back-compat;
  // the server re-derives these authoritatively from yi_chapter_id). It also
  // defaults Day 2 from the chapter's programme duration when Day 1 is set and
  // Day 2 is still empty.
  function handleChapterSelect(chapterId: string) {
    const chapter = chapterId ? chapterById.get(chapterId) ?? null : null;
    setForm((prev) => {
      let day2 = prev.day2_date;
      if (chapter && prev.day1_date && !prev.day2_date) {
        const duration = chapter.programmeDurationDays ?? 2;
        day2 = addDays(prev.day1_date, Math.max(duration, 1) - 1);
      }
      return {
        ...prev,
        yi_chapter_id: chapterId,
        chapter_name: chapter ? chapter.name : "",
        city: chapter ? chapter.city ?? "" : "",
        state: chapter ? chapter.state ?? "" : "",
        day2_date: day2,
      };
    });
    setError("");
  }

  // Setting Day 1 defaults Day 2 from the selected chapter's programme
  // duration when Day 2 has not been set yet (covers picking the chapter
  // before entering a date). The user can still override Day 2.
  function handleDay1Change(value: string) {
    setForm((prev) => {
      let day2 = prev.day2_date;
      if (value && !prev.day2_date && prev.yi_chapter_id) {
        const chapter = chapterById.get(prev.yi_chapter_id);
        const duration = chapter?.programmeDurationDays ?? 2;
        day2 = addDays(value, Math.max(duration, 1) - 1);
      }
      return { ...prev, day1_date: value, day2_date: day2 };
    });
    setError("");
  }

  function validateStep1(): boolean {
    if (!form.name.trim()) {
      setError("Event name is required");
      return false;
    }
    if (form.level === "chapter" && !form.yi_chapter_id) {
      setError("Please choose a chapter for a Chapter Level event");
      return false;
    }
    if (!form.day1_date) {
      setError("Day 1 date is required");
      return false;
    }
    if (!form.day2_date) {
      setError("Day 2 date is required");
      return false;
    }
    if (form.day2_date < form.day1_date) {
      setError("Day 2 must be on or after Day 1");
      return false;
    }
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    if (step < 3) setStep((step + 1) as WizardStep);
  }

  function handleBack() {
    if (step > 1) setStep((step - 1) as WizardStep);
  }

  async function handleCreate() {
    setLoading(true);
    setError("");

    const result = await createEvent({
      ...form,
      // Send undefined (not "") so the server's `if (data.yi_chapter_id)`
      // derivation only runs when a chapter is actually linked.
      yi_chapter_id: form.yi_chapter_id || undefined,
    });

    if (result.success) {
      router.push(`/yip/dashboard/events/${result.data.id}`);
    } else {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Event</h1>
        <p className="text-sm text-gray-500">
          Set up your Young Indians Parliament event
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    step >= s.num
                      ? "border-[#FF9933] bg-[#FF9933] text-white"
                      : "border-gray-300 bg-white text-gray-400"
                  }`}
                >
                  {step > s.num ? (
                    <Check className="size-5" />
                  ) : (
                    <s.icon className="size-5" />
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    step >= s.num ? "text-[#FF9933]" : "text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-full -mt-6 ${
                    step > s.num ? "bg-[#FF9933]" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="e.g., YIP Coimbatore Chapter 2026"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="level">Level *</Label>
              <select
                id="level"
                value={form.level}
                onChange={(e) =>
                  updateField(
                    "level",
                    e.target.value as "chapter" | "regional" | "national"
                  )
                }
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="yi_chapter_id">
                Chapter {form.level === "chapter" ? "*" : "(optional)"}
              </Label>
              <select
                id="yi_chapter_id"
                value={form.yi_chapter_id}
                disabled={chaptersLoading}
                onChange={(e) => handleChapterSelect(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="">
                  {chaptersLoading ? "Loading chapters…" : "Select a chapter…"}
                </option>
                {chapterGroups.map((group) => (
                  <optgroup key={group.region} label={group.region}>
                    {group.chapters.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>
                        {chapter.name}
                        {chapter.city ? ` — ${chapter.city}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Linking a chapter fills in the city, state and region
                automatically.
              </p>
            </div>

            {/* Auto-filled, read-only location inherited from the chapter */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>City</Label>
                <div className="flex h-8 w-full items-center rounded-lg border border-input bg-gray-50 px-2.5 text-sm text-gray-600">
                  {selectedChapter?.city || "—"}
                </div>
              </div>
              <div>
                <Label>State</Label>
                <div className="flex h-8 w-full items-center rounded-lg border border-input bg-gray-50 px-2.5 text-sm text-gray-600">
                  {selectedChapter?.state || "—"}
                </div>
              </div>
              <div>
                <Label>Region</Label>
                <div className="flex h-8 w-full items-center rounded-lg border border-input bg-gray-50 px-2.5 text-sm text-gray-600">
                  {selectedChapter?.region || "—"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="day1_date">Day 1 Date *</Label>
                <Input
                  id="day1_date"
                  type="date"
                  value={form.day1_date}
                  onChange={(e) => handleDay1Change(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="day2_date">Day 2 Date *</Label>
                <Input
                  id="day2_date"
                  type="date"
                  value={form.day2_date}
                  onChange={(e) => updateField("day2_date", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="venue_name">Venue Name</Label>
              <Input
                id="venue_name"
                placeholder="e.g., JKKN Convention Center"
                value={form.venue_name}
                onChange={(e) => updateField("venue_name", e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="venue_address">Venue Address</Label>
              <Textarea
                id="venue_address"
                placeholder="Full address..."
                value={form.venue_address}
                onChange={(e) => updateField("venue_address", e.target.value)}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Agenda & Topics */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Agenda & Committee Topics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="central_agenda">Central Agenda / Theme</Label>
              <Textarea
                id="central_agenda"
                placeholder="The central theme or agenda for this session of parliament..."
                value={form.central_agenda}
                onChange={(e) => updateField("central_agenda", e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label className="mb-3">Committee Topics</Label>
              <p className="mb-4 text-xs text-gray-500">
                Pick the committees for this round from the official YIP 2026
                list. Recommended: choose <strong>8–10</strong>. Each
                committee&apos;s topic is fixed — students draft bills on it.{" "}
                <span className="font-medium text-[#1a1a3e]">
                  Selected: {Object.keys(form.committee_topics).length}
                </span>
              </p>
              {committeesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="size-4 animate-spin" /> Loading committee
                  topics…
                </div>
              ) : committeeCatalog.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No committee topics found. Add them under Admin → Topics.
                </p>
              ) : (
                <div className="space-y-2">
                  {committeeCatalog.map((c) => {
                    const checked = c.committee in form.committee_topics;
                    return (
                      <label
                        key={c.committee}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                          checked
                            ? "border-[#FF9933]/40 bg-[#FF9933]/5"
                            : "border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCommittee(c.committee)}
                          className="mt-1 size-4 shrink-0 accent-[#FF9933]"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {c.topic_number != null
                                ? `${c.topic_number} · ${c.committee}`
                                : c.committee}
                            </p>
                            <span className="shrink-0 rounded border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                              Committee
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{c.topic}</p>
                          {c.scheme && (
                            <p className="text-xs text-gray-400">
                              Linked scheme: {c.scheme}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Create */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info Summary */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700 flex items-center gap-2">
                <CalendarDays className="size-4" /> Basic Info
              </h3>
              <div className="rounded-lg bg-gray-50 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name</span>
                  <span className="font-medium">{form.name || "Not set"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Level</span>
                  <span className="font-medium capitalize">{form.level}</span>
                </div>
                {selectedChapter && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chapter</span>
                    <span className="font-medium">{selectedChapter.name}</span>
                  </div>
                )}
                {selectedChapter?.region && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Region</span>
                    <span className="font-medium">{selectedChapter.region}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Location</span>
                  <span className="font-medium">
                    {[form.city, form.state].filter(Boolean).join(", ") ||
                      "Not set"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dates</span>
                  <span className="font-medium">
                    {form.day1_date && form.day2_date
                      ? `${form.day1_date} to ${form.day2_date}`
                      : "Not set"}
                  </span>
                </div>
              </div>
            </div>

            {/* Venue Summary */}
            {(form.venue_name || form.venue_address) && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <MapPin className="size-4" /> Venue
                </h3>
                <div className="rounded-lg bg-gray-50 p-4 text-sm">
                  {form.venue_name && (
                    <p className="font-medium">{form.venue_name}</p>
                  )}
                  {form.venue_address && (
                    <p className="text-gray-500">{form.venue_address}</p>
                  )}
                </div>
              </div>
            )}

            {/* Agenda Summary */}
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="size-4" /> Agenda & Topics
              </h3>
              <div className="rounded-lg bg-gray-50 p-4 space-y-3 text-sm">
                {form.central_agenda && (
                  <div>
                    <span className="text-gray-500">Central Agenda:</span>
                    <p className="mt-1 font-medium">{form.central_agenda}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-500">
                    Committee Topics ({Object.keys(form.committee_topics).length}
                    ):
                  </span>
                  <div className="mt-1 space-y-1">
                    {Object.keys(form.committee_topics).length === 0 ? (
                      <p className="text-gray-400">No committees selected.</p>
                    ) : (
                      Object.entries(form.committee_topics).map(([c, t]) => (
                        <div key={c} className="flex gap-2">
                          <span className="text-gray-400 shrink-0">{c}:</span>
                          <span className="font-medium">{t}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              A default 2-day agenda with 30 items will be automatically created
              based on the YIP format. You can customize it later.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="outline"
          onClick={step === 1 ? () => router.push("/yip/dashboard") : handleBack}
        >
          <ChevronLeft className="size-4" />
          {step === 1 ? "Cancel" : "Back"}
        </Button>

        {step < 3 ? (
          <Button
            className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
            onClick={handleNext}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Check className="size-4" />
                Create Event
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
