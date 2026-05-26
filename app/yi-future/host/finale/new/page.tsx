import { redirect } from "next/navigation";
import { getHostContext } from "@/lib/yi-future/host-context";
import { createRegionalFinale } from "@/app/yi-future/actions/events";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewRegionalFinalePage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/host");

  async function action(formData: FormData) {
    "use server";
    await createRegionalFinale(
      { chapterId: ctx!.chapterId, editionId: ctx!.editionId },
      formData
    );
  }

  return (
    <FormLayout
      title="New regional finale"
      subtitle="Creates the regional finale event for the host chapter."
      backHref="/yi-future/host/finale/live"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Event name"
          name="name"
          required
          placeholder="Eastern Region Finale · Future 6.0"
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
          cancelHref="/yi-future/host/finale/live"
        />
      </form>
    </FormLayout>
  );
}
