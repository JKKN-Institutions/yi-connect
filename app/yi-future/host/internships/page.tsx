import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  deleteInternship,
  toggleInternshipActive,
} from "@/app/yi-future/actions/internships";

type Slot = {
  id: string;
  title: string;
  description: string | null;
  domain: string | null;
  duration: string | null;
  stipend: string | null;
  location: string | null;
  work_mode: string | null;
  slots_available: number | null;
  is_active: boolean | null;
  partner_id: string;
  corporate_partners: { organization: string } | null;
};

async function getSlots(eventId: string): Promise<Slot[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("internship_slots")
    .select(
      "id, title, description, domain, duration, stipend, location, work_mode, slots_available, is_active, partner_id, corporate_partners!inner(organization, event_id)"
    )
    .eq("corporate_partners.event_id", eventId)
    .order("created_at", { ascending: false });
  return (data as unknown as Slot[]) ?? [];
}

async function toggle(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const next = formData.get("next") === "true";
  await toggleInternshipActive(id, next);
}
async function remove(formData: FormData) {
  "use server";
  await deleteInternship(String(formData.get("id") ?? ""));
}

export default async function InternshipsPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const slots = await getSlots(ctx.nationalEvent.id);
  const totalSlots = slots.reduce((s, r) => s + (r.slots_available ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Internship slots</h2>
          <p className="mt-1 text-sm text-navy/60">
            {slots.length} listings · {totalSlots} total slots (target: 10-20)
          </p>
        </div>
        <Link
          href="/yi-future/host/internships/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + New slot
        </Link>
      </div>

      {slots.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No internship slots yet. Add a partner first, then create slots.
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map((s) => (
            <article
              key={s.id}
              className={`bg-white border rounded-lg p-5 ${
                s.is_active ? "border-navy/10" : "border-navy/10 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-navy">{s.title}</span>
                    {s.domain && (
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/50 px-1.5 py-0.5 rounded bg-navy/5">
                        {s.domain}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-navy/60 mt-0.5">
                    {s.corporate_partners?.organization}
                  </div>
                  {s.description && (
                    <p className="mt-2 text-sm text-navy/70">
                      {s.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-navy/60">
                    {s.duration && <span>⏱ {s.duration}</span>}
                    {s.stipend && <span>💰 {s.stipend}</span>}
                    {s.location && <span>📍 {s.location}</span>}
                    {s.work_mode && <span>{s.work_mode}</span>}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-2xl font-bold text-navy">
                    {s.slots_available ?? 0}
                  </div>
                  <div className="text-[10px] text-navy/50">slots</div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-navy/5 flex items-center justify-between">
                <Link
                  href={`/host/internships/${s.id}/edit`}
                  className="text-xs font-semibold text-navy hover:text-yi-gold"
                >
                  Edit
                </Link>
                <form action={toggle} className="inline-block">
                  <input type="hidden" name="id" value={s.id} />
                  <input
                    type="hidden"
                    name="next"
                    value={String(!s.is_active)}
                  />
                  <button
                    type="submit"
                    className="text-xs text-navy/60 hover:text-navy"
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                </form>
                <form action={remove}>
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600/70 hover:text-red-600"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
