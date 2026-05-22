import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  deletePartner,
  regeneratePartnerCode,
} from "@/app/yi-future/actions/partners";

type Partner = {
  id: string;
  organization: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  website_url: string | null;
  access_code: string;
  is_sponsor: boolean | null;
  is_internship_provider: boolean | null;
  is_jury: boolean | null;
  internship_slots: { id: string }[];
};

async function getPartners(eventId: string): Promise<Partner[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("corporate_partners")
    .select(
      "id, organization, contact_name, contact_email, contact_phone, website_url, access_code, is_sponsor, is_internship_provider, is_jury, internship_slots(id)"
    )
    .eq("event_id", eventId)
    .order("organization", { ascending: true });
  return (data as unknown as Partner[]) ?? [];
}

async function regen(formData: FormData) {
  "use server";
  await regeneratePartnerCode(String(formData.get("id") ?? ""));
}
async function remove(formData: FormData) {
  "use server";
  await deletePartner(String(formData.get("id") ?? ""));
}

export default async function PartnersPage() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const partners = await getPartners(ctx.nationalEvent.id);

  const sponsorCount = partners.filter((p) => p.is_sponsor).length;
  const internshipCount = partners.filter((p) => p.is_internship_provider)
    .length;
  const juryCount = partners.filter((p) => p.is_jury).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy">Partners</h2>
          <p className="mt-1 text-sm text-navy/60">
            {partners.length} partner(s) · {sponsorCount} sponsor ·{" "}
            {internshipCount} internship · {juryCount} jury
          </p>
        </div>
        <Link
          href="/yi-future/host/partners/new"
          className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
        >
          + Add partner
        </Link>
      </div>

      {partners.length === 0 ? (
        <div className="bg-white border border-navy/10 rounded-lg p-8 text-center text-sm text-navy/50">
          No partners onboarded yet. Target 3-5.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map((p) => (
            <div
              key={p.id}
              className="bg-white border border-navy/10 rounded-lg p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-navy truncate">
                    {p.organization}
                  </div>
                  <div className="text-xs text-navy/60 mt-0.5">
                    {p.contact_name ?? "—"}
                  </div>
                  <div className="text-xs text-navy/50 mt-1">
                    {p.contact_email}
                    {p.contact_email && p.contact_phone && " · "}
                    {p.contact_phone}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.is_sponsor && (
                      <span className="text-[10px] font-semibold bg-yi-gold/10 text-yi-gold px-1.5 py-0.5 rounded">
                        SPONSOR
                      </span>
                    )}
                    {p.is_internship_provider && (
                      <span className="text-[10px] font-semibold bg-yi-green/10 text-yi-green px-1.5 py-0.5 rounded">
                        INTERNSHIP ({p.internship_slots.length})
                      </span>
                    )}
                    {p.is_jury && (
                      <span className="text-[10px] font-semibold bg-yi-saffron/10 text-yi-saffron px-1.5 py-0.5 rounded">
                        JURY
                      </span>
                    )}
                  </div>
                </div>
                <code className="text-xs font-mono font-bold tracking-wider bg-yi-gold/10 text-yi-gold px-2 py-0.5 rounded">
                  {p.access_code}
                </code>
              </div>

              <div className="mt-3 pt-3 border-t border-navy/10 flex items-center justify-between">
                <Link
                  href={`/host/partners/${p.id}/edit`}
                  className="text-xs font-semibold text-navy hover:text-yi-gold"
                >
                  Edit
                </Link>
                <form action={regen}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="text-xs text-navy/60 hover:text-navy"
                  >
                    Regen code
                  </button>
                </form>
                <form action={remove}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    className="text-xs text-red-600/70 hover:text-red-600"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
