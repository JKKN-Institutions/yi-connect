import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { createPartnership } from "@/app/yi-future/actions/gov-partnerships";

// New tables not yet in generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

type Partnership = {
  id: string;
  org_name: string;
  org_type: string | null;
  official_name: string | null;
  official_title: string | null;
  mou_signed: boolean | null;
  status: string;
  created_at: string | null;
  last_contact_date: string | null;
};

type StatusKey =
  | "initial"
  | "in_discussion"
  | "mou_drafted"
  | "mou_signed"
  | "active"
  | "dormant";

const STATUS_ORDER: StatusKey[] = [
  "initial",
  "in_discussion",
  "mou_drafted",
  "mou_signed",
  "active",
  "dormant",
];

const STATUS_LABEL: Record<StatusKey, string> = {
  initial: "Initial",
  in_discussion: "In discussion",
  mou_drafted: "MoU drafted",
  mou_signed: "MoU signed",
  active: "Active",
  dormant: "Dormant",
};

const STATUS_CLASSES: Record<StatusKey, string> = {
  initial: "bg-navy/5 text-navy/70",
  in_discussion: "bg-amber-100 text-amber-800",
  mou_drafted: "bg-blue-100 text-blue-800",
  mou_signed: "bg-emerald-100 text-emerald-800",
  active: "bg-green-100 text-green-800",
  dormant: "bg-gray-200 text-gray-600",
};

const ORG_TYPE_LABEL: Record<string, string> = {
  central_ministry: "Central ministry",
  state_govt: "State govt",
  psu: "PSU",
  regulatory: "Regulatory",
  other: "Other",
};

async function getPartnerships(): Promise<Partnership[]> {
  const svc = (await createServiceClient()) as AnyClient;

  // Partnerships
  const { data: parts } = await svc
    .schema("yi")
    .from("government_partnerships")
    .select(
      "id, org_name, org_type, official_name, official_title, mou_signed, status, created_at"
    )
    .order("created_at", { ascending: false });

  const rows = (parts ?? []) as Omit<Partnership, "last_contact_date">[];
  if (rows.length === 0) return [];

  // Latest contact date per partnership (single query, group client-side)
  const { data: logs } = await svc
    .schema("yi")
    .from("government_contact_log")
    .select("partnership_id, contact_date")
    .order("contact_date", { ascending: false });

  const lastByPartner = new Map<string, string>();
  for (const l of (logs ?? []) as {
    partnership_id: string;
    contact_date: string;
  }[]) {
    if (!lastByPartner.has(l.partnership_id)) {
      lastByPartner.set(l.partnership_id, l.contact_date);
    }
  }

  return rows.map((r) => ({
    ...r,
    last_contact_date: lastByPartner.get(r.id) ?? null,
  }));
}

function statusOf(s: string): StatusKey {
  return (STATUS_ORDER as readonly string[]).includes(s)
    ? (s as StatusKey)
    : "initial";
}

export default async function NationalGovernmentPage() {
  const partnerships = await getPartnerships();

  const counts: Record<StatusKey, number> = {
    initial: 0,
    in_discussion: 0,
    mou_drafted: 0,
    mou_signed: 0,
    active: 0,
    dormant: 0,
  };
  for (const p of partnerships) counts[statusOf(p.status)] += 1;

  async function addPartnership(formData: FormData) {
    "use server";
    await createPartnership(formData);
  }

  return (
    <div className="space-y-8">
      {/* ─── Header ───────────────────────────────────────────────── */}
      <div>
        <h2 className="text-2xl font-bold text-navy">
          Government Partnerships
        </h2>
        <p className="mt-1 text-sm text-navy/60">
          {partnerships.length} partner organisations · org-level
          relationships, persist across editions
        </p>
      </div>

      {/* ─── Status counts ────────────────────────────────────────── */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {STATUS_ORDER.map((k) => (
          <div
            key={k}
            className="bg-white border border-navy/10 rounded-lg p-4 text-center"
          >
            <div className="text-2xl font-bold text-navy">{counts[k]}</div>
            <div
              className={`mt-1 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full inline-block ${STATUS_CLASSES[k]}`}
            >
              {STATUS_LABEL[k]}
            </div>
          </div>
        ))}
      </section>

      {/* ─── Add partnership inline form ──────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg p-6">
        <h3 className="text-lg font-bold text-navy mb-4">
          Add a partnership
        </h3>
        <form action={addPartnership} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Organisation *
              </label>
              <input
                name="org_name"
                required
                placeholder="e.g. Ministry of Education"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Org type
              </label>
              <select
                name="org_type"
                defaultValue=""
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
                placeholder="Full name"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Designation
              </label>
              <input
                name="official_title"
                placeholder="e.g. Joint Secretary"
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
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Phone
              </label>
              <input
                name="official_phone"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-navy/70 mb-1.5">
                Status
              </label>
              <select
                name="status"
                defaultValue="initial"
                className="w-full px-3 py-2 border border-navy/20 rounded-md text-sm bg-white"
              >
                {STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
            >
              Add partnership
            </button>
          </div>
        </form>
      </section>

      {/* ─── Partnerships table ───────────────────────────────────── */}
      <section className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="px-5 py-3 bg-navy/5 text-sm font-bold text-navy">
          All partnerships
        </div>
        {partnerships.length === 0 ? (
          <div className="p-8 text-center text-navy/50 text-sm">
            No partnerships yet. Use the form above to add the first one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-navy/5 text-navy/70">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Organisation</th>
                <th className="text-left px-4 py-3 font-semibold">Type</th>
                <th className="text-left px-4 py-3 font-semibold">Official</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-center px-4 py-3 font-semibold">MoU</th>
                <th className="text-left px-4 py-3 font-semibold">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {partnerships.map((p) => {
                const sk = statusOf(p.status);
                return (
                  <tr key={p.id} className="border-t border-navy/5 hover:bg-navy/5">
                    <td className="px-4 py-3 font-semibold text-navy/90">
                      <Link
                        href={`/national/admin/government/${p.id}`}
                        className="hover:underline"
                      >
                        {p.org_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-navy/70 text-xs">
                      {p.org_type
                        ? ORG_TYPE_LABEL[p.org_type] ?? p.org_type
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-navy/70 text-xs">
                      {p.official_name ?? "—"}
                      {p.official_title && (
                        <div className="text-[11px] text-navy/40">
                          {p.official_title}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${STATUS_CLASSES[sk]}`}
                      >
                        {STATUS_LABEL[sk]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.mou_signed ? (
                        <span className="text-emerald-600 font-bold">✓</span>
                      ) : (
                        <span className="text-navy/20">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-navy/60 font-mono">
                      {p.last_contact_date ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
