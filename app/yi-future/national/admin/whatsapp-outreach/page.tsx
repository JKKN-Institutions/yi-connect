import Link from "next/link";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { fetchAllRows } from "@/lib/pagination";
import { isCurrentUserPlatformAdmin } from "@/app/yi-future/actions/national-admins";
import {
  whatsappStatusForOutreach,
  credentialsMessage,
  type BulkNudgeRow,
} from "./actions";
import { NudgeButton, BulkNudgeButton } from "./SendButton";

type ChapterRow = {
  id: string;
  name: string;
  region: string | null;
  is_active: boolean | null;
  chair_name: string | null;
  chair_email: string | null;
  chair_mobile: string | null;
};

type DelegateRow = {
  id: string;
  chapter_id: string;
};

type EditionRow = {
  id: string;
  name: string;
  slug: string;
};

async function getActiveEdition(): Promise<EditionRow | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, slug")
    .eq("is_active", true)
    .maybeSingle();
  return (data as EditionRow | null) ?? null;
}

async function getChapters(): Promise<ChapterRow[]> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("yi")
    .from("chapters")
    .select("id, name, region, is_active, chair_name, chair_email, chair_mobile")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return (data as unknown as ChapterRow[]) ?? [];
}

async function getDelegateCounts(editionId: string): Promise<Map<string, number>> {
  const svc = await createServiceClient();
  // PostgREST caps a single response at ~1000 rows; this edition already has
  // 1100+ delegates, so a bare select silently undercounts the per-chapter
  // totals (and the lowest-registration-first sort below). Page through in full
  // batches.
  const rows = await fetchAllRows<DelegateRow>((from, to) =>
    svc
      .schema("future")
      .from("delegates")
      .select("id, chapter_id")
      .eq("edition_id", editionId)
      .order("id", { ascending: true })
      .range(from, to) as unknown as PromiseLike<{
      data: DelegateRow[] | null;
      error: unknown;
    }>
  );
  const counts = new Map<string, number>();
  for (const d of rows) {
    counts.set(d.chapter_id, (counts.get(d.chapter_id) ?? 0) + 1);
  }
  return counts;
}

export default async function WhatsAppOutreachPage() {
  const [{ isPlatform }, status, chapters, edition] = await Promise.all([
    isCurrentUserPlatformAdmin(),
    whatsappStatusForOutreach(),
    getChapters(),
    getActiveEdition(),
  ]);

  const counts = edition
    ? await getDelegateCounts(edition.id)
    : new Map<string, number>();
  const editionName = edition?.name ?? "Future 6.0";

  // Lowest-registration first, then alphabetical.
  const rows = chapters
    .map((c) => ({ ...c, count: counts.get(c.id) ?? 0 }))
    .sort((a, b) =>
      a.count !== b.count ? a.count - b.count : a.name.localeCompare(b.name)
    );

  // Pre-build the per-chapter credentials messages for the bulk action.
  const bulkRows: BulkNudgeRow[] = [];
  const credMessages = new Map<string, string>();
  for (const r of rows) {
    if (!r.chair_mobile) continue;
    const msg = await credentialsMessage(r.chair_name ?? "Chair", r.name);
    credMessages.set(r.id, msg);
    bulkRows.push({
      chapterId: r.id,
      mobile: r.chair_mobile,
      name: r.chair_name ?? "Chair",
      message: msg,
    });
  }

  const ready = status.isReady;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-navy">WhatsApp Outreach</h2>
          <p className="mt-1 text-sm text-navy/60">
            Send nudges and login info to chapter chairs through the connected
            Yi WhatsApp number · {editionName}
          </p>
        </div>
        {isPlatform && ready && bulkRows.length > 0 && (
          <BulkNudgeButton rows={bulkRows} />
        )}
      </div>

      {!ready && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800">
            WhatsApp not connected — a platform admin must connect it first.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            {status.error
              ? status.error
              : "No active WhatsApp session. Scan the QR code at the connect page to bind the sending number."}
          </p>
          <Link
            href="/yi-future/national/admin/whatsapp-connect"
            className="mt-2 inline-flex items-center text-xs font-semibold text-amber-900 underline hover:text-amber-700"
          >
            Open WhatsApp connect page →
          </Link>
        </div>
      )}

      <div className="rounded-lg border border-navy/10 bg-navy/[0.02] p-3">
        <p className="text-[11px] text-navy/60">
          <span className="font-semibold text-navy/70">Operational note:</span>{" "}
          Sending requires the WhatsApp service env vars
          (<code>WHATSAPP_SERVICE_URL</code> / <code>WHATSAPP_API_KEY</code>) set
          and the QR scanned. Login messages never contain a password — chairs
          set their own via the reset link.
        </p>
      </div>

      <div className="bg-white border border-navy/10 rounded-lg overflow-hidden">
        <div className="flex items-end justify-between px-3 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50">
            Chapters · lowest registration first
          </h3>
        </div>
        <table className="mt-2 w-full text-sm">
          <thead className="bg-navy/5 text-navy/70">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Chapter</th>
              <th className="text-left px-3 py-2 font-semibold">Region</th>
              <th className="text-right px-3 py-2 font-semibold">Delegates</th>
              <th className="text-left px-3 py-2 font-semibold">Chair</th>
              <th className="text-right px-3 py-2 font-semibold">Send</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const credMsg = credMessages.get(r.id) ?? "";
              const tone =
                r.count === 0
                  ? "text-red-600"
                  : r.count < 5
                  ? "text-yi-saffron"
                  : "text-yi-green";
              return (
                <tr
                  key={r.id}
                  className="border-t border-navy/5 hover:bg-navy/[0.015]"
                >
                  <td className="px-3 py-2.5 font-semibold text-navy">
                    {r.name}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-navy/50">
                      {r.region ?? "—"}
                    </span>
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold ${tone}`}>
                    {r.count}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.chair_name ? (
                      <>
                        <div className="text-navy font-medium">
                          {r.chair_name}
                        </div>
                        <div className="text-navy/40">
                          {r.chair_mobile ?? "no mobile"}
                        </div>
                      </>
                    ) : (
                      <span className="text-navy/30">no chair</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <NudgeButton
                      chapterId={r.id}
                      mobile={r.chair_mobile}
                      name={r.chair_name ?? "Chair"}
                      message={credMsg}
                      label="Send login info"
                      disabled={!ready || !credMsg}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
