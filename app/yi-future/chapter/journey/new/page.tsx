import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createPhaseEvent } from "@/app/yi-future/actions/phase-events";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";
import {
  PHASES,
  PHASE_LABELS,
  PHASE_EVENT_TYPES_BY_PHASE,
  PHASE_EVENT_LABELS,
} from "@/lib/yi-future/constants";

export default async function NewJourneyEventPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");
  const { phase: phaseParam } = await searchParams;

  async function action(formData: FormData) {
    "use server";
    await createPhaseEvent(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  return (
    <FormLayout
      title="Schedule phase event"
      subtitle="One of 9 mandated events across the 90-day journey."
      backHref="/yi-future/chapter/journey"
    >
      <form action={action} className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Phase *
            </label>
            <select
              name="phase"
              required
              defaultValue={phaseParam ?? ""}
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="" disabled>
                — pick —
              </option>
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {PHASE_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Event type *
            </label>
            <select
              name="type"
              required
              defaultValue=""
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="" disabled>
                — pick —
              </option>
              <optgroup label="Phase A">
                {PHASE_EVENT_TYPES_BY_PHASE.phase_a.map((t) => (
                  <option key={t} value={t}>
                    {PHASE_EVENT_LABELS[t]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Phase B">
                {PHASE_EVENT_TYPES_BY_PHASE.phase_b.map((t) => (
                  <option key={t} value={t}>
                    {PHASE_EVENT_LABELS[t]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Phase C">
                {PHASE_EVENT_TYPES_BY_PHASE.phase_c.map((t) => (
                  <option key={t} value={t}>
                    {PHASE_EVENT_LABELS[t]}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <Field
          label="Title"
          name="title"
          required
          placeholder="Orientation: Welcome to Future 6.0"
          hint="Public-facing name delegates will see."
        />
        <Field
          label="Description"
          name="description"
          as="textarea"
          rows={3}
          placeholder="Agenda, what to bring, prep reading, etc."
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Scheduled at"
            name="scheduled_at"
            type="datetime-local"
            required
          />
          <Field
            label="Duration (min)"
            name="duration_minutes"
            type="number"
            placeholder="90"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Mode
            </label>
            <select
              name="mode"
              defaultValue=""
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="">— pick —</option>
              <option value="in_person">In person</option>
              <option value="virtual">Virtual</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
          <Field
            label="Capacity"
            name="capacity"
            type="number"
            placeholder="50"
          />
        </div>
        <Field
          label="Venue"
          name="venue"
          placeholder="XYZ Auditorium or 'Online'"
        />
        <Field
          label="Meeting URL"
          name="meeting_url"
          type="url"
          placeholder="https://meet.google.com/…"
          hint="For virtual or hybrid events."
        />

        <SubmitRow
          submitLabel="Schedule event"
          cancelHref="/yi-future/chapter/journey"
        />
      </form>
    </FormLayout>
  );
}
