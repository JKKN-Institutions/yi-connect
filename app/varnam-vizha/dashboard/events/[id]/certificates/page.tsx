import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { PrintAllButton } from "./PrintAllButton";

export const metadata: Metadata = { title: "Certificates" };

type Params = { params: Promise<{ id: string }> };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtLongDateIST = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "";

/**
 * Pure HTML/CSS certificate printing — no PDF libraries. @page sets A4
 * landscape; each .vv-cert is exactly one page (297 × 210 mm) with
 * page-break-after. On screen the same certificates render as a preview
 * stack (scroll sideways on a phone). print-color-adjust keeps the festival
 * colours on paper.
 */
const PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
.vv-cert {
  width: 297mm;
  height: 210mm;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
@media print {
  header, footer, nav, .vv-no-print { display: none !important; }
  body { background: #fff !important; }
  .vv-cert-page { max-width: none !important; padding: 0 !important; }
  .vv-cert-stack { gap: 0 !important; }
  .vv-cert { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  .vv-cert:last-child { break-after: auto; page-break-after: auto; }
}
`;

type CertGuest = {
  id: string;
  full_name: string;
  checked_in_at: string | null;
};

function Certificate({
  name,
  eventTitle,
  eventDate,
  editionName,
}: {
  name: string;
  eventTitle: string;
  eventDate: string;
  editionName: string;
}) {
  return (
    <div className="vv-cert shrink-0 bg-white p-[10mm] shadow-md">
      {/* Double border in festival colours: plum outer, marigold inner. */}
      <div className="flex h-full w-full flex-col border-[3px] border-[#3B0A45] p-[3mm]">
        <div className="flex h-full w-full flex-col items-center justify-between border-2 border-[#F4A300] px-[18mm] py-[12mm] text-center">
          <div>
            <p className="font-[family-name:var(--font-vv-display)] text-[24px] font-bold text-[#D6336C]">
              வர்ணம் விழா · Varnam Vizha
            </p>
            <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.3em] text-[#2B0A33]/60">
              Erode&apos;s Festival of Colour
            </p>
          </div>

          <div className="w-full">
            <h2 className="font-[family-name:var(--font-vv-display)] text-[38px] font-bold leading-tight text-[#3B0A45]">
              Certificate of Participation
            </h2>
            <p className="mt-6 text-[15px] text-[#2B0A33]/70">
              This certifies that
            </p>
            <p className="mx-auto mt-2 max-w-[210mm] border-b border-[#3B0A45]/25 pb-2 font-[family-name:var(--font-vv-display)] text-[30px] font-bold text-[#2B0A33]">
              {name}
            </p>
            <p className="mx-auto mt-4 max-w-[220mm] text-[15px] leading-relaxed text-[#2B0A33]/80">
              participated in{" "}
              <span className="font-semibold text-[#3B0A45]">{eventTitle}</span>
              {eventDate ? (
                <>
                  {" "}
                  held on{" "}
                  <span className="font-semibold text-[#3B0A45]">
                    {eventDate}
                  </span>
                </>
              ) : null}{" "}
              as part of{" "}
              <span className="font-semibold text-[#3B0A45]">
                {editionName}
              </span>
              , Erode.
            </p>
          </div>

          <div className="flex w-full items-end justify-between gap-[20mm]">
            <div className="flex-1 text-center">
              <div className="mx-auto w-[60mm] border-t border-[#2B0A33]/50 pt-2 text-[12px] font-medium text-[#2B0A33]/70">
                Chair, Varnam Vizha
              </div>
            </div>
            <div className="flex-1 text-center">
              <div className="mx-auto w-[60mm] border-t border-[#2B0A33]/50 pt-2 text-[12px] font-medium text-[#2B0A33]/70">
                Yi Erode
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function CertificatesPage({ params }: Params) {
  const { id } = await params;
  const access = await getVarnamAccess();
  if (!access.canManage) {
    return (
      <Forbidden403
        reason={
          access.canView
            ? "Your role can view the dashboard but not print certificates. Ask the festival chair for organiser access."
            : access.reason
        }
      />
    );
  }

  if (!UUID_RE.test(id)) notFound();
  const sb = createAdminSupabaseClient();

  const { data: eventRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, title, start_date, festival_edition_id")
    .eq("id", id)
    .maybeSingle();
  const event = eventRaw as {
    id: string;
    title: string;
    start_date: string | null;
    festival_edition_id: string | null;
  } | null;
  if (!event || !event.festival_edition_id) notFound();

  const { data: editionRaw } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("name")
    .eq("id", event.festival_edition_id)
    .maybeSingle();
  const editionName =
    (editionRaw as { name: string } | null)?.name ?? "Varnam Vizha";

  // Confirmed guests only, checked-in first (they definitely attended),
  // then alphabetical so the printed stack is easy to hand out.
  const { data: guestsRaw } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("id, full_name, checked_in_at")
    .eq("event_id", event.id)
    .eq("status", "confirmed")
    .order("checked_in_at", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true });
  const guests = (guestsRaw ?? []) as CertGuest[];
  const checkedInCount = guests.filter((g) => g.checked_in_at != null).length;

  const eventDate = fmtLongDateIST(event.start_date);

  return (
    <div className="vv-cert-page mx-auto max-w-6xl px-4 py-10">
      <style>{PRINT_CSS}</style>

      <div className="vv-no-print">
        <Link
          href="/varnam-vizha/dashboard/events"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← All events
        </Link>

        <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
              Participation certificates
            </h1>
            <p className="mt-1 text-sm text-[#2B0A33]/60">
              {guests.length === 0
                ? `No confirmed guests for ${event.title} yet.`
                : `${guests.length} certificate${
                    guests.length === 1 ? "" : "s"
                  } ready for ${event.title} — checked-in guests (${checkedInCount}) come first in the stack. Print, or Save as PDF, on A4 landscape.`}
            </p>
          </div>
          <PrintAllButton count={guests.length} />
        </div>
      </div>

      {guests.length === 0 ? (
        <div className="vv-no-print rounded-2xl border border-[#3B0A45]/10 bg-white p-6 text-sm text-[#2B0A33]/50 shadow-sm">
          Certificates appear here once guests are confirmed on the sign-up
          list.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="vv-cert-stack flex flex-col gap-8">
            {guests.map((g) => (
              <Certificate
                key={g.id}
                name={g.full_name}
                eventTitle={event.title}
                eventDate={eventDate}
                editionName={editionName}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
