"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getEvent, updateEvent } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const LEVEL_OPTIONS = [
  { value: "chapter", label: "Chapter Level" },
  { value: "regional", label: "Regional Level" },
  { value: "national", label: "National Level" },
] as const;

interface EditFormData {
  name: string;
  level: "chapter" | "regional" | "national";
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

  const [form, setForm] = useState<EditFormData>({
    name: "",
    level: "chapter",
    chapter_name: "",
    city: "",
    state: "",
    day1_date: "",
    day2_date: "",
    venue_name: "",
    venue_address: "",
    central_agenda: "",
  });

  // Load existing event data
  useEffect(() => {
    async function loadEvent() {
      const event = await getEvent(eventId);
      if (!event) {
        toast.error("Event not found");
        router.push("/yip/dashboard");
        return;
      }
      setForm({
        name: event.name ?? "",
        level: event.level as "chapter" | "regional" | "national",
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
    loadEvent();
  }, [eventId, router]);

  function updateField<K extends keyof EditFormData>(
    key: K,
    value: EditFormData[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  function validate(): boolean {
    if (!form.name.trim()) {
      setError("Event name is required");
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
      router.push(`/dashboard/events/${eventId}`);
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
        <Link href={`/dashboard/events/${eventId}`}>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="chapter_name">Chapter Name</Label>
              <Input
                id="chapter_name"
                placeholder="e.g., Coimbatore"
                value={form.chapter_name}
                onChange={(e) => updateField("chapter_name", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g., Coimbatore"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              placeholder="e.g., Tamil Nadu"
              value={form.state}
              onChange={(e) => updateField("state", e.target.value)}
            />
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
        <Link href={`/dashboard/events/${eventId}`}>
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
