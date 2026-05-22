import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { updateInternship } from "@/app/yi-future/actions/internships";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Slot = {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  domain: string | null;
  duration: string | null;
  stipend: string | null;
  location: string | null;
  work_mode: string | null;
  requirements: string | null;
  slots_available: number | null;
  corporate_partners: { event_id: string; organization: string } | null;
};

async function getSlot(id: string): Promise<Slot | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("internship_slots")
    .select(
      "id, partner_id, title, description, domain, duration, stipend, location, work_mode, requirements, slots_available, corporate_partners(event_id, organization)"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Slot) ?? null;
}

export default async function EditInternshipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const { id } = await params;
  const slot = await getSlot(id);
  if (!slot) notFound();
  if (
    slot.corporate_partners?.event_id !== ctx.nationalEvent.id
  ) {
    redirect("/yi-future/host/internships");
  }

  async function action(formData: FormData) {
    "use server";
    await updateInternship(id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${slot.title}`}
      subtitle={slot.corporate_partners?.organization ?? ""}
      backHref="/host/internships"
    >
      <form action={action} className="space-y-5">
        <Field label="Title" name="title" required defaultValue={slot.title} />
        <Field
          label="Description"
          name="description"
          as="textarea"
          rows={3}
          defaultValue={slot.description ?? ""}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Domain"
            name="domain"
            defaultValue={slot.domain ?? ""}
          />
          <Field
            label="Duration"
            name="duration"
            defaultValue={slot.duration ?? ""}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Stipend"
            name="stipend"
            defaultValue={slot.stipend ?? ""}
          />
          <Field
            label="Location"
            name="location"
            defaultValue={slot.location ?? ""}
          />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Work mode
            </label>
            <select
              name="work_mode"
              defaultValue={slot.work_mode ?? ""}
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="">—</option>
              <option value="on_site">On-site</option>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </div>
        </div>
        <Field
          label="Requirements"
          name="requirements"
          as="textarea"
          rows={2}
          defaultValue={slot.requirements ?? ""}
        />
        <Field
          label="Slots available"
          name="slots_available"
          type="number"
          defaultValue={String(slot.slots_available ?? "")}
        />
        <SubmitRow submitLabel="Save" cancelHref="/host/internships" />
      </form>
    </FormLayout>
  );
}
