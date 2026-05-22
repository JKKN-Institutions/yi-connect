import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { createNationalEvent } from "@/app/yi-future/actions/host-events";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

async function getTracks(
  editionId: string
): Promise<{ id: string; name: string }[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("tracks")
    .select("id, name")
    .eq("edition_id", editionId)
    .order("display_order", { ascending: true });
  return (data as unknown as { id: string; name: string }[]) ?? [];
}

export default async function NewHostEventPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost) redirect("/yi-future/host");

  const tracks = await getTracks(ctx.editionId);

  async function action(formData: FormData) {
    "use server";
    await createNationalEvent(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  return (
    <FormLayout
      title="Schedule National Track Final"
      subtitle="2-day event — Day 1 (learning) + Day 2 (competition)."
      backHref="/host"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Event name"
          name="name"
          required
          placeholder={`Bangalore · ${ctx.trackName ?? "Track"} National Final`}
        />
        <Field
          label="Tagline"
          name="tagline"
          placeholder="From Opinions to Impact"
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Track *
          </label>
          <select
            name="track_id"
            required
            defaultValue={ctx.trackId ?? ""}
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
          >
            <option value="" disabled>
              — pick —
            </option>
            {tracks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" name="start_date" type="datetime-local" />
          <Field label="End" name="end_date" type="datetime-local" />
        </div>
        <Field label="Venue" name="venue" placeholder="Taj Bangalore" />
        <Field label="Venue address" name="venue_address" />
        <SubmitRow submitLabel="Create event" cancelHref="/host" />
      </form>
    </FormLayout>
  );
}
