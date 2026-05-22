import Link from "next/link";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  seedNationalSections,
  activateNationalSection,
  updateNationalSectionNotes,
} from "@/app/yi-future/actions/national-sections";
import {
  NATIONAL_DAY1_SECTIONS,
  NATIONAL_DAY1_SECTION_LABELS,
} from "@/lib/yi-future/constants";

type Section = {
  id: string;
  event_id: string;
  day: number;
  section_key: string;
  title: string | null;
  notes: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
  sequence_order: number | null;
};

async function getSections(eventId: string, day: number): Promise<Section[]> {
  const svc = await createServiceClient();
  // national_event_sections (migration 116) isn't in generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = (svc as any).schema("future").from("national_event_sections");
  const { data } = await tbl
    .select(
      "id, event_id, day, section_key, title, notes, starts_at, ends_at, is_active, sequence_order"
    )
    .eq("event_id", eventId)
    .eq("day", day);
  return ((data as unknown) as Section[]) ?? [];
}

export default async function HostAgendaDay1Page() {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost || !ctx.nationalEvent) redirect("/yi-future/host");

  const eventId = ctx.nationalEvent.id;
  let sections = await getSections(eventId, 1);

  // Auto-seed if empty
  if (sections.length === 0) {
    await seedNationalSections(eventId);
    sections = await getSections(eventId, 1);
  }

  const byKey = new Map<string, Section>();
  for (const s of sections) byKey.set(s.section_key, s);

  async function activate(formData: FormData) {
    "use server";
    const key = String(formData.get("section_key") ?? "");
    await activateNationalSection(eventId, 1, key);
  }

  async function saveNotes(formData: FormData) {
    "use server";
    const key = String(formData.get("section_key") ?? "");
    const notes = String(formData.get("notes") ?? "").trim() || null;
    await updateNationalSectionNotes(eventId, 1, key, notes);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/yi-future/host"
          className="text-xs font-semibold tracking-widest text-navy/50 hover:text-navy uppercase"
        >
          ← Host dashboard
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-navy">
              Day 1 agenda
            </h2>
            <p className="mt-1 text-sm text-navy/60">
              {ctx.nationalEvent.name}
            </p>
            <p className="mt-1 text-xs text-navy/40">
              Opening · Keynote · Masterclass · Youth-Policy Dialogue ·
              Networking [HPB §4 Day 1]
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/yi-future/host/agenda/day2"
              className="text-xs font-semibold text-navy hover:text-yi-gold"
            >
              Day 2 agenda →
            </Link>
            <Link
              href={`/host/event/${eventId}/live`}
              className="px-3 py-1.5 rounded-md bg-navy text-ivory text-xs font-semibold hover:bg-navy-dark"
            >
              Open live panel →
            </Link>
            <Link
              href={`/event/${eventId}/display`}
              target="_blank"
              className="text-xs text-navy/60 hover:text-yi-gold"
            >
              Open projector view ↗
            </Link>
          </div>
        </div>
      </div>

      <section className="bg-white border border-navy/10 rounded-lg p-5">
        <h3 className="text-sm font-bold text-navy mb-4">
          Day 1 sections ({NATIONAL_DAY1_SECTIONS.length})
        </h3>
        <div className="space-y-3">
          {NATIONAL_DAY1_SECTIONS.map((k, i) => {
            const s = byKey.get(k);
            return (
              <div
                key={k}
                className={`border rounded-md p-3 ${
                  s?.is_active
                    ? "border-yi-gold bg-yi-gold/5"
                    : "border-navy/10"
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-navy/40 font-mono text-xs">
                      {i + 1}.
                    </span>
                    <span className="font-semibold text-navy text-sm">
                      {NATIONAL_DAY1_SECTION_LABELS[k]}
                    </span>
                    {s?.is_active && (
                      <span className="text-[10px] font-semibold text-yi-gold bg-yi-gold/15 px-1.5 py-0.5 rounded">
                        LIVE
                      </span>
                    )}
                    {!s?.is_active && s?.ends_at && (
                      <span className="text-[10px] font-semibold text-navy/40">
                        ✓ done
                      </span>
                    )}
                  </div>
                  {!s?.is_active && (
                    <form action={activate}>
                      <input
                        type="hidden"
                        name="section_key"
                        value={k}
                      />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-navy hover:text-yi-gold"
                      >
                        Go live →
                      </button>
                    </form>
                  )}
                </div>
                <form action={saveNotes} className="flex gap-2">
                  <input type="hidden" name="section_key" value={k} />
                  <input
                    name="notes"
                    defaultValue={s?.notes ?? ""}
                    placeholder="Speaker / panel / notes"
                    className="flex-1 px-2 py-1 text-xs border border-navy/20 rounded"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 text-xs font-semibold text-navy/70 border border-navy/20 rounded hover:border-navy/40"
                  >
                    Save
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
