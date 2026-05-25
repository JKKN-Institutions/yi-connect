import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { updatePartner } from "@/app/yi-future/actions/partners";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Partner = {
  id: string;
  event_id: string;
  organization: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  notes: string | null;
  access_code: string;
  is_sponsor: boolean | null;
  is_internship_provider: boolean | null;
  is_jury: boolean | null;
};

async function getPartner(id: string): Promise<Partner | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("corporate_partners")
    .select(
      "id, event_id, organization, contact_name, contact_email, contact_phone, website_url, notes, access_code, is_sponsor, is_internship_provider, is_jury"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Partner) ?? null;
}

export default async function EditPartnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const { id } = await params;
  const partner = await getPartner(id);
  if (!partner) notFound();
  if (partner.event_id !== ctx.nationalEvent.id) redirect("/yi-future/host/partners");

  async function action(formData: FormData) {
    "use server";
    await updatePartner(id, formData);
  }

  return (
    <FormLayout
      title={`Edit — ${partner.organization}`}
      subtitle={`Access code: ${partner.access_code}`}
      backHref="/yi-future/host/partners"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Organization"
          name="organization"
          required
          defaultValue={partner.organization}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Contact name"
            name="contact_name"
            defaultValue={partner.contact_name ?? ""}
          />
          <Field
            label="Website"
            name="website_url"
            type="url"
            defaultValue={partner.website_url ?? ""}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Email"
            name="contact_email"
            type="email"
            defaultValue={partner.contact_email ?? ""}
          />
          <Field
            label="Phone"
            name="contact_phone"
            type="tel"
            defaultValue={partner.contact_phone ?? ""}
          />
        </div>
        <Field
          label="Notes"
          name="notes"
          as="textarea"
          rows={2}
          defaultValue={partner.notes ?? ""}
        />

        <div className="pt-3 border-t border-navy/10 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-navy/70 mb-2">
            Partner roles
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_sponsor"
              defaultChecked={partner.is_sponsor ?? false}
              className="h-4 w-4 accent-yi-gold"
            />
            <span>Sponsor</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_internship_provider"
              defaultChecked={partner.is_internship_provider ?? false}
              className="h-4 w-4 accent-yi-green"
            />
            <span>Internship provider</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_jury"
              defaultChecked={partner.is_jury ?? false}
              className="h-4 w-4 accent-yi-saffron"
            />
            <span>National jury member</span>
          </label>
        </div>

        <SubmitRow submitLabel="Save" cancelHref="/yi-future/host/partners" />
      </form>
    </FormLayout>
  );
}
