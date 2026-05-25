import { redirect } from "next/navigation";
import { getHostContext } from "@/lib/yi-future/host-context";
import { createGovEngagement } from "@/app/yi-future/actions/government";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

export default async function NewGovEngagementPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  async function action(formData: FormData) {
    "use server";
    await createGovEngagement(ctx!.nationalEvent!.id, formData);
  }

  return (
    <FormLayout
      title="Log government engagement"
      subtitle="Central, state, or regulatory officials attending the national final."
      backHref="/yi-future/host/government"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Official name"
          name="official_name"
          required
          placeholder="Shri X, IAS"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Designation"
            name="official_designation"
            placeholder="Secretary"
          />
          <Field
            label="Ministry / Department"
            name="ministry_or_dept"
            placeholder="MoHUA"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Engagement type
          </label>
          <select
            name="engagement_type"
            defaultValue=""
            className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
          >
            <option value="">—</option>
            <option value="keynote">Keynote</option>
            <option value="panel">Panel</option>
            <option value="townhall">Town hall</option>
            <option value="closed_door">Closed-door briefing</option>
            <option value="whitepaper_handover">Whitepaper handover</option>
            <option value="visit">Visit / walkthrough</option>
          </select>
        </div>
        <Field
          label="Scheduled at"
          name="scheduled_at"
          type="datetime-local"
        />
        <Field label="Bio" name="bio" as="textarea" rows={2} />
        <Field
          label="Summary"
          name="summary"
          as="textarea"
          rows={3}
          placeholder="What was discussed / agreed."
        />
        <Field
          label="Media coverage URLs"
          name="media_coverage_urls"
          as="textarea"
          rows={2}
          placeholder="One URL per line"
          hint="One URL per line."
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="whitepaper_accepted"
            className="h-4 w-4 accent-yi-green"
          />
          <span>Whitepaper accepted on behalf of ministry</span>
        </label>
        <SubmitRow submitLabel="Log engagement" cancelHref="/yi-future/host/government" />
      </form>
    </FormLayout>
  );
}
