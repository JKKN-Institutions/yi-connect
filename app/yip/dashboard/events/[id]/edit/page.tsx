"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { getEvent, updateEvent, listEventChapters } from "@/app/yip/actions/events";
import { Button } from "@/components/yip/ui/button";
import { Input } from "@/components/yip/ui/input";
import { Label } from "@/components/yip/ui/label";
import { Textarea } from "@/components/yip/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/yip/ui/card";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const LEVEL_OPTIONS = [
  { value: "chapter", label: "Chapter Level" },
  { value: "regional", label: "Regional Level" },
  { value: "national", label: "National Level" },
] as const;

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

interface EditFormData {
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
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const eventId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [chapterGroups, setChapterGroups] = useState<ChapterGroup[]>([]);

  const [form, setForm] = useState<EditFormData>({
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
  });

  // Load the existing event and the canonical chapter list together so the
  // picker can pre-select the event's current chapter.
  useEffect(() => {
    async function load() {
      const [event, groups] = await Promise.all([
        getEvent(eventId),
        listEventChapters().catch(() => [] as ChapterGroup[]),
      ]);
      if (!event) {
        toast.error("Event not found");
        router.push("/yip/dashboard");
        return;
      }
      setChapterGroups(groups);
      setForm({
        name: event.name ?? "",
        level: event.level as "chapter" | "regional" | "national",
        yi_chapter_id: event.yi_chapter_id ?? "",
        chapter_name: event.chapter_name ?? "",
        city: event.city ?? "",
        state: event.state ?? "",
        day1_date: event.day1_date ?? "",
        day2_date: event.day2_date ?? "",
        venue_name: event.venue_name ?? "",
        venue_address: event.venue_address ?? "",
        central_agenda: event.central_agenda ?? "",
      });
      setLoading(false);
    }
    load();
  }, [eventId, router]);

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

  function updateField<K extends keyof EditFormData>(
    key: K,
    value: EditFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  // Selecting a chapter auto-fills chapter_name/city/state (kept for back-compat;
  // the server re-derives these authoritatively from yi_chapter_id). No Day 2
  // auto-default on edit — dates already exist.
  function handleChapterSelect(chapterId: string) {
    const chapter = chapterId ? chapterById.get(chapterId) ?? null : null;
    setForm((prev) => ({
      ...prev,
      yi_chapter_id: chapterId,
      chapter_name: chapter ? chapter.name : "",
      city: chapter ? chapter.city ?? "" : "",
      state: chapter ? chapter.state ?? "" : "",
    }));
    setError("");
  }

  function validate(): boolean {
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

  async function handleSave() {
    if (!validate()) return;

    setSaving(true);
    setError("");

    const result = await updateEvent(eventId, {
      name: form.name,
      level: form.level,
      // Send undefined (not "") when no chapter is linked so the server only
      // re-derives location/zone when a chapter is actually selected.
      yi_chapter_id: form.yi_chapter_id || undefined,
      chapter_name: form.chapter_name || undefined,
      city: form.city || undefined,
      state: form.state || undefined,
      day1_date: form.day1_date,
      day2_date: form.day2_date,
      venue_name: form.venue_name || undefined,
      venue_address: form.venue_address || undefined,
      central_agenda: form.central_agenda || undefined,
    });

    if (result.success) {
      toast.success("Event updated successfully");
      router.push(`/yip/dashboard/events/${eventId}`);
    } else {
      setError(result.error);
      toast.error(result.error);
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Edit Event</h2>
          <p className="text-sm text-gray-500">
            Update basic event information
          </p>
        </div>
        <Link href={`/yip/dashboard/events/${eventId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-4" />
            Back to Overview
          </Button>
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
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
              onChange={(e) => handleChapterSelect(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">Select a chapter…</option>
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
                {selectedChapter?.city || form.city || "—"}
              </div>
            </div>
            <div>
              <Label>State</Label>
              <div className="flex h-8 w-full items-center rounded-lg border border-input bg-gray-50 px-2.5 text-sm text-gray-600">
                {selectedChapter?.state || form.state || "—"}
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
                onChange={(e) => updateField("day1_date", e.target.value)}
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

          <div>
            <Label htmlFor="central_agenda">Central Agenda / Theme</Label>
            <Textarea
              id="central_agenda"
              placeholder="The central theme or agenda for this session..."
              value={form.central_agenda}
              onChange={(e) => updateField("central_agenda", e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Link href={`/yip/dashboard/events/${eventId}`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button
          className="bg-[#FF9933] text-white hover:bg-[#E68A2E]"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
