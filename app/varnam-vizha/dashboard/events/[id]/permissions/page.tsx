import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { getManagedEvent } from "@/lib/varnam/data/manage-events-data";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ensurePermissionRows } from "@/lib/varnam/actions/manage-permissions";
import { AUTHORITIES } from "@/lib/varnam/letters";
import { PermissionCard, type PermissionCardRow } from "./_components/PermissionCard";

export const metadata: Metadata = { title: "Permission letters" };

type Params = { params: Promise<{ id: string }> };

const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

export default async function EventPermissionsPage({ params }: Params) {
  const { id } = await params;
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;
  if (!access.canManage)
    return (
      <Forbidden403 reason="Your role can view the dashboard but not manage permission letters. Ask the festival chair for organiser access." />
    );

  const event = await getManagedEvent(id);
  if (!event || !event.festival_edition_id) notFound();

  // Make sure a row exists per authority (idempotent; no revalidate in render).
  await ensurePermissionRows(event.id);

  // The table is created by this round's migration — query defensively and
  // cast rows locally so the page still compiles/loads pre-deploy.
  const sb = createAdminSupabaseClient();
  const { data: permsRaw } = await sb
    .schema("yi_connect")
    .from("varnam_permissions")
    .select("id, event_id, authority, status, letter_body, notes")
    .eq("event_id", event.id);
  const perms = (permsRaw ?? []) as PermissionCardRow[];
  const byAuthority = new Map(perms.map((p) => [p.authority, p]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Print mode: hide the whole page except the letter being printed. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .vv-print-area, .vv-print-area * { visibility: visible !important; }
          .vv-print-area {
            position: absolute !important;
            left: 0; top: 0; width: 100%;
            padding: 2rem;
            background: #fff !important;
            color: #000 !important;
            font-size: 12pt;
          }
        }
      `}</style>

      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Permission letters
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          {event.title} · {fmtDate(event.start_date)}
          {event.venue_address ? ` · ${event.venue_address}` : ""}
        </p>
        <p className="mt-2 max-w-xl text-sm text-[#2B0A33]/60">
          One letter per authority. Draft it here, print and sign it, then keep
          the status current so the whole committee sees where each approval
          stands — no more chasing on WhatsApp.
        </p>
      </div>

      <div className="space-y-5">
        {AUTHORITIES.map((a) => {
          const row = byAuthority.get(a.key);
          if (!row) {
            // Pre-deploy safety: the table isn't there yet.
            return (
              <div
                key={a.key}
                className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm"
              >
                <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
                  {a.name}
                </h2>
                <p className="mt-2 text-sm text-[#2B0A33]/50">
                  The paperwork tracker isn&apos;t set up yet — reload this page
                  once the latest update is deployed.
                </p>
              </div>
            );
          }
          return (
            <PermissionCard key={a.key} authorityName={a.name} row={row} />
          );
        })}
      </div>

      <p className="mt-8 flex flex-wrap gap-x-5 gap-y-1">
        <Link
          href="/varnam-vizha/dashboard/paperwork"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← All paperwork
        </Link>
        <Link
          href={`/varnam-vizha/dashboard/events/${event.id}/edit`}
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          Edit this event
        </Link>
      </p>
    </div>
  );
}
