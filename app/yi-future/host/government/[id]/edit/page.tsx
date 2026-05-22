import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { updateGovEngagement } from "@/app/yi-future/actions/government";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Engagement = {
  id: string;
  event_id: string;
  official_name: string;
  official_designation: string | null;
  ministry_or_dept: string | null;
  engagement_type: string | null;
  scheduled_at: string | null;
  bio: string | null;
  summary: string | null;
  whitepaper_accepted: boolean | null;
  media_coverage_urls: string[] | null;
};

async function getEngagement(id: string): Promise<Engagement | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("government_engagements")
    .select(
      "id, event_id, official_name, official_designation, ministry_or_dept, engagement_type, scheduled_at, bio, summary, whitepaper_accepted, media_coverage_urls"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Engagement) ?? null;
}

export default async function EditGovEngagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const { id } = await params;
  const e = await getEngagement(id);
  if (!e) notFound();
  if (e.event_id !== ctx.nationalEvent.id) redirect("/yi-future/host/government");

  async function action(formData: FormData) {
    "use server";
    await updateGovEngagement(id, formData);
  }

  // scheduled_at needs to be in local YYYY-MM-DDTHH:mm form
  const dt = e.scheduled_at
    ? new Date(e.scheduled_at).toISOString().slice(0, 16)
    : "";

  return (
    <FormLayout
      title={`Edit — ${e.official_name}`}
      backHref="/host/government"
    >
      <form action={action} className="space-y-5">
        <Field
          label="Official name"
          name="official_name"
          required
          defaultValue={e.official_name}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Designation"
            name="official_designation"
            defaultValue={e.official_designation ?? ""}
          />
          <Field
            label="Ministry / Department"
            name="ministry_or_dept"
            defaultValue={e.ministry_or_dept ?? ""}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
            Engagement type
          </label>
          <select
            name="engagement_type"
            defaultValue={e.engagement_type ?? ""}
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
          defaultValue={dt}
        />
        <Field
          label="Bio"
          name="bio"
          as="textarea"
          rows={2}
          defaultValue={e.bio ?? ""}
        />
        <Field
          label="Summary"
          name="summary"
          as="textarea"
          rows={3}
          defaultValue={e.summary ?? ""}
        />
        <Field
          label="Media coverage URLs"
          name="media_coverage_urls"
          as="textarea"
          rows={3}
          defaultValue={(e.media_coverage_urls ?? []).join("\n")}
          hint="One URL per line."
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="whitepaper_accepted"
            defaultChecked={e.whitepaper_accepted ?? false}
            className="h-4 w-4 accent-yi-green"
          />
          <span>Whitepaper accepted</span>
        </label>
        <SubmitRow submitLabel="Save" cancelHref="/host/government" />
      </form>
    </FormLayout>
  );
}
