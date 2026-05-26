import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { createNationalFinals } from "@/app/yi-future/actions/events";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewNationalFinalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/yi-future/login");

  // Get current edition
  const svc = await createServiceClient();
  const { data: edition } = await svc
    .schema("future")
    .from("editions")
    .select("id")
    .eq("slug", "2026")
    .maybeSingle();
  if (!edition) redirect("/yi-future/national/admin");
  const editionId = (edition as { id: string }).id;

  async function action(formData: FormData) {
    "use server";
    await createNationalFinals({ editionId }, formData);
  }

  return (
    <FormLayout
      title="New national finals"
      subtitle="Creates the 2-day national event with Day 1 and Day 2 sections pre-seeded."
      backHref="/yi-future/national/admin/finals/live"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Event name"
          name="name"
          required
          placeholder="Yi YUVA Future 6.0 — National Finals 2026"
        />
        <Field
          label="Tagline"
          name="tagline"
          placeholder="From Opinions to Impact"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Start date (Day 1)"
            name="start_date"
            type="datetime-local"
          />
          <Field
            label="End date (Day 2)"
            name="end_date"
            type="datetime-local"
          />
        </div>
        <Field
          label="Venue"
          name="venue"
          placeholder="Convention Centre"
        />
        <Field
          label="Venue address"
          name="venue_address"
          placeholder="123 Main Road, City"
        />
        <Field
          label="Maps URL"
          name="venue_maps_url"
          type="url"
          placeholder="https://maps.google.com/…"
        />
        <Field
          label="Capacity"
          name="capacity"
          type="number"
          placeholder="1000"
        />
        <SubmitRow
          submitLabel="Create event"
          cancelHref="/yi-future/national/admin/finals/live"
        />
      </form>
    </FormLayout>
  );
}
