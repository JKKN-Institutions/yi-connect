import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { createInternship } from "@/app/yi-future/actions/internships";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

async function getPartners(
  eventId: string
): Promise<{ id: string; organization: string }[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("corporate_partners")
    .select("id, organization")
    .eq("event_id", eventId)
    .eq("is_internship_provider", true)
    .order("organization", { ascending: true });
  return (data as unknown as { id: string; organization: string }[]) ?? [];
}

export default async function NewInternshipPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const partners = await getPartners(ctx.nationalEvent.id);

  async function action(formData: FormData) {
    "use server";
    const partnerId = String(formData.get("partner_id") ?? "");
    await createInternship(partnerId, formData);
  }

  return (
    <FormLayout
      title="New internship slot"
      subtitle="Only partners flagged 'Internship provider' appear in the picker."
      backHref="/host/internships"
    >
      {partners.length === 0 ? (
        <div className="text-center p-4 text-sm text-navy/50">
          No internship-provider partners yet. Add a partner and tick
          &quot;Internship provider&quot; first.
        </div>
      ) : (
        <form action={action} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Partner *
            </label>
            <select
              name="partner_id"
              required
              defaultValue=""
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="" disabled>
                — pick —
              </option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.organization}
                </option>
              ))}
            </select>
          </div>
          <Field
            label="Title"
            name="title"
            required
            placeholder="Policy Research Intern"
          />
          <Field
            label="Description"
            name="description"
            as="textarea"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Domain" name="domain" placeholder="Policy" />
            <Field
              label="Duration"
              name="duration"
              placeholder="3 months"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Stipend" name="stipend" placeholder="₹15,000/mo" />
            <Field label="Location" name="location" placeholder="Bangalore" />
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Work mode
              </label>
              <select
                name="work_mode"
                defaultValue=""
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
            placeholder="Skills, eligibility, etc."
          />
          <Field
            label="Slots available"
            name="slots_available"
            type="number"
            placeholder="3"
          />
          <SubmitRow
            submitLabel="Create slot"
            cancelHref="/host/internships"
          />
        </form>
      )}
    </FormLayout>
  );
}
