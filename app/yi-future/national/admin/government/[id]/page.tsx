import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  deleteContactLog,
  deletePartnership,
  logContact,
  updatePartnership,
} from "@/app/yi-future/actions/gov-partnerships";

// New tables not yet in generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

type Partnership = {
  id: string;
  org_name: string;
  org_type: string | null;
  official_name: string | null;
  official_title: string | null;
  official_email: string | null;
  official_phone: string | null;
  mou_signed: boolean | null;
  mou_url: string | null;
  mou_signed_date: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ContactLog = {
  id: string;
  contact_date: string;
  contact_type: string | null;
  summary: string;
  next_step: string | null;
  created_at: string | null;
};

const STATUS_ORDER = [
  "initial",
  "in_discussion",
  "mou_drafted",
  "mou_signed",
  "active",
  "dormant",
] as const;

const STATUS_LABEL: Record<string, string> = {
  initial: "Initial",
  in_discussion: "In discussion",
  mou_drafted: "MoU drafted",
  mou_signed: "MoU signed",
  active: "Active",
  dormant: "Dormant",
};

async function getPartnership(id: string): Promise<Partnership | null> {
  const svc = (await createServiceClient()) as AnyClient;
  const { data } = await svc
    .schema("yi")
    .from("government_partnerships")
    .select(
      "id, org_name, org_type, official_name, official_title, official_email, official_phone, mou_signed, mou_url, mou_signed_date, status, notes, created_at, updated_at"
    )
    .eq("id", id)
    .maybeSingle();
  return (data as Partnership | null) ?? null;
}

async function getContactLog(partnershipId: string): Promise<ContactLog[]> {
  const svc = (await createServiceClient()) as AnyClient;
  const { data } = await svc
    .schema("yi")
    .from("government_contact_log")
    .select("id, contact_date, contact_type, summary, next_step, created_at")
    .eq("partnership_id", partnershipId)
    .order("contact_date", { ascending: false });
  return ((data as ContactLog[] | null) ?? []) as ContactLog[];
}

export default async function GovernmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const partnership = await getPartnership(id);
  if (!partnership) notFound();

  const logs = await getContactLog(id);

  async function saveEdit(formData: FormData) {
    "use server";
    await updatePartnership(id, formData);
  }

  async function addLog(formData: FormData) {
    "use server";
    await logContact(id, formData);
  }

  async function removeLog(formData: FormData) {
    "use server";
    const logId = String(formData.get("log_id") ?? "");
    if (logId) await deleteContactLog(logId, id);
  }

  async function removePartnership() {
    "use server";
    await deletePartnership(id);
  }

  return (
    <div className="space-y-8">
      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/yi-future/national/admin/government"
            className="text-xs text-navy/50 hover:text-navy"
          >
            ← All partnerships
          </Link>
          <h2 className="mt-1 text-2xl font-bold text-navy">
            {partnership.org_name}
          </h2>
          <p className="mt-1 text-sm text-navy/60">
            {logs.length} contact{logs.length === 1 ? "" : "s"} logged ·{" "}
            {partnership.mou_signed ? "MoU signed" : "MoU not signed"}
          </p>
        </div>
      </div>

      {/* ─── Edit form ────────────────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg p-6">
        <h3 className="text-lg font-bold text-navy mb-4">Partnership details</h3>
        <form action={saveEdit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Organisation *
              </label>
              <input
                name="org_name"
                required
                defaultValue={partnership.org_name}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Org type
              </label>
              <select
                name="org_type"
                defaultValue={partnership.org_type ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              >
                <option value="">— pick —</option>
                <option value="central_ministry">Central ministry</option>
                <option value="state_govt">State government</option>
                <option value="psu">PSU</option>
                <option value="regulatory">Regulatory body</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Point of contact
              </label>
              <input
                name="official_name"
                defaultValue={partnership.official_name ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Designation
              </label>
              <input
                name="official_title"
                defaultValue={partnership.official_title ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Email
              </label>
              <input
                name="official_email"
                type="email"
                defaultValue={partnership.official_email ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Phone
              </label>
              <input
                name="official_phone"
                defaultValue={partnership.official_phone ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Status
              </label>
              <select
                name="status"
                defaultValue={partnership.status}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                MoU signed date
              </label>
              <input
                name="mou_signed_date"
                type="date"
                defaultValue={partnership.mou_signed_date ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                MoU URL
              </label>
              <input
                name="mou_url"
                type="url"
                placeholder="https://..."
                defaultValue={partnership.mou_url ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="mou_signed"
                type="checkbox"
                name="mou_signed"
                defaultChecked={!!partnership.mou_signed}
                className="h-4 w-4 rounded border-navy/30"
              />
              <label
                htmlFor="mou_signed"
                className="text-sm text-navy/80 font-medium"
              >
                MoU is signed
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Notes
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={partnership.notes ?? ""}
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <form action={removePartnership}>
              <button
                type="submit"
                className="text-xs text-red-600/80 hover:text-red-700 font-semibold"
              >
                Delete partnership
              </button>
            </form>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Save changes
            </button>
          </div>
        </form>
      </section>

      {/* ─── Add contact ──────────────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg p-6">
        <h3 className="text-lg font-bold text-navy mb-4">
          Log a contact touchpoint
        </h3>
        <form action={addLog} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Date *
              </label>
              <input
                name="contact_date"
                type="date"
                required
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Type
              </label>
              <select
                name="contact_type"
                defaultValue=""
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              >
                <option value="">— pick —</option>
                <option value="meeting">Meeting</option>
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="letter">Letter</option>
                <option value="event">Event</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Summary *
              </label>
              <textarea
                name="summary"
                required
                rows={2}
                placeholder="What was discussed?"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Next step
              </label>
              <input
                name="next_step"
                placeholder="What happens next?"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Log contact
            </button>
          </div>
        </form>
      </section>

      {/* ─── Contact log ──────────────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-navy/5 text-sm font-bold text-navy">
          Contact history
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-navy/50 text-sm">
            No contact touchpoints logged yet.
          </div>
        ) : (
          <ul className="divide-y divide-navy/5">
            {logs.map((l) => (
              <li key={l.id} className="px-5 py-4 flex items-start gap-4">
                <div className="text-xs font-mono text-navy/40 w-24 flex-shrink-0 pt-0.5">
                  {l.contact_date}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {l.contact_type && (
                      <span className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-navy/5 text-navy/70">
                        {l.contact_type}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-navy/80 whitespace-pre-wrap">
                    {l.summary}
                  </p>
                  {l.next_step && (
                    <p className="mt-1 text-xs text-navy/60">
                      <span className="font-semibold">Next:</span> {l.next_step}
                    </p>
                  )}
                </div>
                <form action={removeLog}>
                  <input type="hidden" name="log_id" value={l.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600/70 hover:text-red-600"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
