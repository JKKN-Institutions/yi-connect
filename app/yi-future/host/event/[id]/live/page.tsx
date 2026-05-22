import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { getHostContext } from "@/lib/yi-future/host-context";
import {
  activateNationalSection,
  endAllNationalSections,
  seedNationalSections,
} from "@/app/yi-future/actions/national-sections";
import {
  NATIONAL_DAY1_SECTIONS,
  NATIONAL_DAY1_SECTION_LABELS,
  NATIONAL_DAY2_SECTIONS,
  NATIONAL_DAY2_SECTION_LABELS,
} from "@/lib/yi-future/constants";

type Section = {
  id: string;
  event_id: string;
  day: number;
  section_key: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean | null;
};

async function getEventMeta(
  id: string
): Promise<{ id: string; chapter_id: string | null; name: string } | null> {
  const svc = await createServiceClient();
  const { data } = await svc
    .schema("future")
    .from("events")
    .select("id, chapter_id, name")
    .eq("id", id)
    .maybeSingle();
  return (
    (data as unknown as { id: string; chapter_id: string | null; name: string }) ??
    null
  );
}

async function getSections(eventId: string): Promise<Section[]> {
  const svc = await createServiceClient();
  // national_event_sections (migration 116) isn't in generated types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tbl = (svc as any).schema("future").from("national_event_sections");
  const { data } = await tbl
    .select(
      "id, event_id, day, section_key, title, starts_at, ends_at, is_active"
    )
    .eq("event_id", eventId);
  return ((data as unknown) as Section[]) ?? [];
}

export default async function HostLiveControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await getHostContext();
  if (!ctx) redirect("/yi-future/chapter");
  if (!ctx.isHost) redirect("/yi-future/host");

  const { id } = await params;
  const event = await getEventMeta(id);
  if (!event) notFound();
  if (event.chapter_id && event.chapter_id !== ctx.chapterId) {
    redirect("/yi-future/host");
  }

  let sections = await getSections(id);
  if (sections.length === 0) {
    await seedNationalSections(id);
    sections = await getSections(id);
  }

  const day1Map = new Map<string, Section>();
  const day2Map = new Map<string, Section>();
  for (const s of sections) {
    if (s.day === 1) day1Map.set(s.section_key, s);
    else if (s.day === 2) day2Map.set(s.section_key, s);
  }

  const active = sections.find((s) => s.is_active);
  const activeLabel = active
    ? active.day === 1
      ? NATIONAL_DAY1_SECTION_LABELS[
          active.section_key as (typeof NATIONAL_DAY1_SECTIONS)[number]
        ]
      : NATIONAL_DAY2_SECTION_LABELS[
          active.section_key as (typeof NATIONAL_DAY2_SECTIONS)[number]
        ]
    : null;

  async function activate(formData: FormData) {
    "use server";
    const key = String(formData.get("section_key") ?? "");
    const dayRaw = String(formData.get("day") ?? "1");
    const day = dayRaw === "2" ? 2 : 1;
    await activateNationalSection(id, day, key);
  }

  async function endAll() {
    "use server";
    await endAllNationalSections(id);
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
              National — live control
            </h2>
            <p className="mt-1 text-sm text-navy/60">{event.name}</p>
          </div>
          <Link
            href={`/event/${id}/display`}
            target="_blank"
            className="px-4 py-2 rounded-md bg-navy text-ivory text-sm font-semibold hover:bg-navy-dark"
          >
            Open projector view ↗
          </Link>
        </div>
      </div>

      {active ? (
        <section className="bg-gradient-to-br from-yi-gold to-yi-saffron text-white rounded-lg p-6 text-center">
          <div className="text-[10px] font-semibold tracking-widest uppercase opacity-80">
            Now live · Day {active.day}
          </div>
          <div className="mt-2 text-3xl font-bold">{activeLabel}</div>
          {active.starts_at && (
            <div className="mt-2 text-xs opacity-80 font-mono">
              Started at{" "}
              {new Date(active.starts_at).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
          <form action={endAll} className="mt-4">
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-semibold"
            >
              End section / pause
            </button>
          </form>
        </section>
      ) : (
        <section className="bg-navy/5 border border-navy/20 rounded-lg p-6 text-center text-sm text-navy/60">
          No section live. Pick one below.
        </section>
      )}

      {/* Day 1 */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
          Day 1 · Conclave & Dialogues
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {NATIONAL_DAY1_SECTIONS.map((k, i) => {
            const s = day1Map.get(k);
            const done = !!s?.ends_at && !s?.is_active;
            return (
              <form
                action={activate}
                key={`d1-${k}`}
                className={`relative rounded-lg p-4 border-2 transition-all ${
                  s?.is_active
                    ? "border-yi-gold bg-yi-gold/5"
                    : done
                      ? "border-navy/10 bg-navy/[0.02] opacity-60"
                      : "border-navy/20 bg-white hover:border-yi-gold/50"
                }`}
              >
                <input type="hidden" name="section_key" value={k} />
                <input type="hidden" name="day" value="1" />
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl font-black text-navy/20">
                    {i + 1}
                  </span>
                  <span className="font-bold text-navy text-sm">
                    {NATIONAL_DAY1_SECTION_LABELS[k]}
                  </span>
                </div>
                {s?.is_active ? (
                  <span className="text-[10px] font-semibold text-yi-gold">
                    ● LIVE
                  </span>
                ) : done ? (
                  <span className="text-[10px] font-semibold text-navy/40">
                    ✓ done
                  </span>
                ) : (
                  <button
                    type="submit"
                    className="text-xs font-semibold text-navy hover:text-yi-gold"
                  >
                    Go live →
                  </button>
                )}
              </form>
            );
          })}
        </div>
      </section>

      {/* Day 2 */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-widest text-navy/50 mb-3">
          Day 2 · Finals & Opportunity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {NATIONAL_DAY2_SECTIONS.map((k, i) => {
            const s = day2Map.get(k);
            const done = !!s?.ends_at && !s?.is_active;
            return (
              <form
                action={activate}
                key={`d2-${k}`}
                className={`relative rounded-lg p-4 border-2 transition-all ${
                  s?.is_active
                    ? "border-yi-gold bg-yi-gold/5"
                    : done
                      ? "border-navy/10 bg-navy/[0.02] opacity-60"
                      : "border-navy/20 bg-white hover:border-yi-gold/50"
                }`}
              >
                <input type="hidden" name="section_key" value={k} />
                <input type="hidden" name="day" value="2" />
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl font-black text-navy/20">
                    {i + 1}
                  </span>
                  <span className="font-bold text-navy text-sm">
                    {NATIONAL_DAY2_SECTION_LABELS[k]}
                  </span>
                </div>
                {s?.is_active ? (
                  <span className="text-[10px] font-semibold text-yi-gold">
                    ● LIVE
                  </span>
                ) : done ? (
                  <span className="text-[10px] font-semibold text-navy/40">
                    ✓ done
                  </span>
                ) : (
                  <button
                    type="submit"
                    className="text-xs font-semibold text-navy hover:text-yi-gold"
                  >
                    Go live →
                  </button>
                )}
              </form>
            );
          })}
        </div>
      </section>
    </div>
  );
}
