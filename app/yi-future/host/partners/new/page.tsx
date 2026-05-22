import { redirect } from "next/navigation";
import { getHostContext } from "@/lib/yi-future/host-context";
import { createPartner } from "@/app/yi-future/actions/partners";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewPartnerPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  async function action(formData: FormData) {
    "use server";
    await createPartner(ctx!.nationalEvent!.id, formData);
  }

  return (
    <FormLayout
      title="Add partner"
      subtitle={`Adding to ${ctx.nationalEvent.name}. Access code is generated.`}
      backHref="/host/partners"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Organization"
          name="organization"
          required
          placeholder="Infosys"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Contact name"
            name="contact_name"
            placeholder="Ms. Priya Menon"
          />
          <Field
            label="Website"
            name="website_url"
            type="url"
            placeholder="https://infosys.com"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" name="contact_email" type="email" />
          <Field label="Phone" name="contact_phone" type="tel" />
        </div>
        <Field
          label="Notes"
          name="notes"
          as="textarea"
          rows={2}
          placeholder="Context, asks, etc."
        />

        <div className="pt-3 border-t border-navy/10 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-navy/70 mb-2">
            Partner roles
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_sponsor"
              className="h-4 w-4 accent-yi-gold"
            />
            <span>Sponsor</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_internship_provider"
              className="h-4 w-4 accent-yi-green"
            />
            <span>Internship provider</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="is_jury"
              className="h-4 w-4 accent-yi-saffron"
            />
            <span>National jury member</span>
          </label>
        </div>

        <SubmitRow submitLabel="Add partner" cancelHref="/host/partners" />
      </form>
    </FormLayout>
  );
}
