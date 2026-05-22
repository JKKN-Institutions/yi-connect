import { redirect } from "next/navigation";
import { getChapterContext } from "@/lib/yi-future/chapter-context";
import { createChapterFinal } from "@/app/yi-future/actions/events";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewChapterFinalPage() {
  const ctx = await getChapterContext();
  if (!ctx) redirect("/yi-future/chapter");

  async function action(formData: FormData) {
    "use server";
    await createChapterFinal(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  return (
    <FormLayout
      title="New chapter final"
      subtitle="Creates the day-90 event with the 5 handbook-mandated sections pre-seeded."
      backHref="/chapter/final"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Event name"
          name="name"
          required
          placeholder="Bangalore Chapter Final · Future 6.0"
        />
        <Field
          label="Tagline"
          name="tagline"
          placeholder="From opinions to impact"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Start date"
            name="start_date"
            type="datetime-local"
          />
          <Field label="End date" name="end_date" type="datetime-local" />
        </div>
        <Field
          label="Venue"
          name="venue"
          placeholder="XYZ Auditorium"
        />
        <Field
          label="Venue address"
          name="venue_address"
          placeholder="123 MG Road, Bangalore"
        />
        <Field
          label="Maps URL"
          name="venue_maps_url"
          type="url"
          placeholder="https://maps.google.com/…"
        />
        <SubmitRow
          submitLabel="Create event"
          cancelHref="/chapter/final"
        />
      </form>
    </FormLayout>
  );
}
