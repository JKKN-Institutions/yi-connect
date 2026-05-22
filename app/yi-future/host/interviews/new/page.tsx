import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import { scheduleInterview } from "@/app/yi-future/actions/interviews";
import { FormLayout, Field, SubmitRow } from "@/components/yi-future/admin/FormLayout";

type Advancement = {
  team_id: string;
  teams: {
    team_name: string;
    team_members: {
      delegate_id: string;
      delegates: { full_name: string } | null;
    }[];
  } | null;
};

async function getFinalistDelegates(eventId: string) {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("advancements")
    .select(
      "team_id, teams(team_name, team_members(delegate_id, delegates(full_name)))"
    )
    .eq("to_event_id", eventId);
  const advs = (data as unknown as Advancement[]) ?? [];
  const rows: { id: string; label: string }[] = [];
  for (const a of advs) {
    for (const m of a.teams?.team_members ?? []) {
      rows.push({
        id: m.delegate_id,
        label: `${m.delegates?.full_name ?? "—"} (${a.teams?.team_name ?? ""})`,
      });
    }
  }
  rows.sort((a, b) => a.label.localeCompare(b.label));
  return rows;
}

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

async function getSlots(
  eventId: string
): Promise<{ id: string; title: string; partner_id: string }[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("internship_slots")
    .select(
      "id, title, partner_id, corporate_partners!inner(event_id)"
    )
    .eq("corporate_partners.event_id", eventId)
    .eq("is_active", true);
  return (data as unknown as {
    id: string;
    title: string;
    partner_id: string;
  }[]) ?? [];
}

export default async function NewInterviewPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const [delegates, partners, slots] = await Promise.all([
    getFinalistDelegates(ctx.nationalEvent.id),
    getPartners(ctx.nationalEvent.id),
    getSlots(ctx.nationalEvent.id),
  ]);

  async function action(formData: FormData) {
    "use server";
    await scheduleInterview({ eventId: ctx!.nationalEvent!.id }, formData);
  }

  return (
    <FormLayout
      title="Schedule interview"
      subtitle="Conflict-check enforced server-side (delegate + partner can't double-book the same time)."
      backHref="/host/interviews"
    >
      {delegates.length === 0 || partners.length === 0 ? (
        <div className="text-center text-sm text-navy/50">
          Need at least one finalist delegate AND one internship-provider
          partner to schedule.
        </div>
      ) : (
        <form action={action} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Delegate *
            </label>
            <select
              name="delegate_id"
              required
              defaultValue=""
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="" disabled>
                — pick —
              </option>
              {delegates.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
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
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
              Internship slot
            </label>
            <select
              name="internship_slot_id"
              defaultValue=""
              className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
            >
              <option value="">— optional —</option>
              {slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Scheduled at *"
              name="scheduled_at"
              type="datetime-local"
              required
            />
            <Field
              label="Duration (min)"
              name="duration_minutes"
              type="number"
              placeholder="20"
            />
          </div>
          <Field label="Room" name="room" placeholder="Breakout 1" />
          <SubmitRow
            submitLabel="Schedule"
            cancelHref="/host/interviews"
          />
        </form>
      )}
    </FormLayout>
  );
}
