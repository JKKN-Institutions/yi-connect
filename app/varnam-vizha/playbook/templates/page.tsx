import type { Metadata } from "next";
import Link from "next/link";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { EVENT_TEMPLATES, type EventTemplate } from "@/lib/varnam/data/playbook";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { MapPin, Users, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Event Templates" };

/** Map a playbook template category to a real yi_connect event category. */
function toEventCategory(cat: EventTemplate["category"]): string {
  switch (cat) {
    case "Sports":
      return "sports";
    case "Cultural":
    case "Music":
    case "Heritage":
    case "Ceremony":
      return "cultural";
    default: // Awareness, Community
      return "other";
  }
}

/** Prefill link into the New-event form (URL-encoded from the template). */
function templateHref(t: EventTemplate): string {
  const params = new URLSearchParams({
    title: t.name,
    category: toEventCategory(t.category),
    description: t.whatItIs,
  });
  if (t.typicalVenue) params.set("venue", t.typicalVenue);
  return `/varnam-vizha/dashboard/events/new?${params.toString()}`;
}

function categoryChip(cat: EventTemplate["category"]): string {
  switch (cat) {
    case "Sports":
      return "bg-[#0CA4A5]/10 text-[#0a8485]";
    case "Cultural":
    case "Music":
      return "bg-[#D6336C]/10 text-[#b02a59]";
    case "Awareness":
      return "bg-[#F4A300]/15 text-[#a06a00]";
    default:
      return "bg-[#3B0A45]/10 text-[#3B0A45]";
  }
}

function TemplateCard({ t, canManage }: { t: EventTemplate; canManage: boolean }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryChip(
            t.category
          )}`}
        >
          {t.category}
        </span>
      </div>
      <h2 className="font-[family-name:var(--font-vv-display)] text-xl font-bold leading-tight text-[#3B0A45]">
        {t.name}
        {t.tamilName && (
          <span className="ml-2 text-base font-semibold text-[#2B0A33]/55">
            {t.tamilName}
          </span>
        )}
      </h2>
      <p className="mt-2 text-sm text-[#2B0A33]/70">{t.whatItIs}</p>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#D6336C]">
          Run checklist
        </p>
        <ul className="space-y-1.5">
          {t.checklist.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-[#2B0A33]/80">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0CA4A5]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {(t.typicalVenue || t.leadForum) && (
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-[#3B0A45]/8 pt-4 text-xs text-[#2B0A33]/60">
          {t.typicalVenue && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-[#D6336C]" />
              {t.typicalVenue}
            </span>
          )}
          {t.leadForum && (
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-[#D6336C]" />
              {t.leadForum}
            </span>
          )}
        </div>
      )}

      {canManage && (
        <p className="mt-auto pt-4">
          <Link
            href={templateHref(t)}
            className="text-sm font-semibold text-[#0CA4A5] hover:underline"
          >
            Use this template →
          </Link>
        </p>
      )}
    </article>
  );
}

export default async function VarnamPlaybookTemplates() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D6336C]">
          Playbook
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45] sm:text-4xl">
          Event Templates
        </h1>
        <p className="mt-3 max-w-2xl text-[#2B0A33]/70">
          Blueprints for the signature events that recur every edition. Each
          template carries a ready-to-run checklist distilled from how Varnam
          Vizha actually ran on the ground.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        {EVENT_TEMPLATES.map((t) => (
          <TemplateCard key={t.name} t={t} canManage={access.canManage} />
        ))}
      </div>

      <p className="mt-10">
        <Link
          href="/varnam-vizha/playbook"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          ← Back to Playbook
        </Link>
      </p>
    </div>
  );
}
