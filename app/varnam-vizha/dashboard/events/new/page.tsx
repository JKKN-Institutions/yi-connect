import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { EventForm, type EventFormInitial } from "../EventForm";

export const metadata: Metadata = { title: "New event" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Must match ALLOWED_CATEGORIES in lib/varnam/actions/manage-events.ts.
const CATEGORY_VALUES = ["cultural", "sports", "workshop", "other"];

const first = (v: string | string[] | undefined): string =>
  (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Prefill from the Playbook's "Use this template →" links
 * (?title=..&category=..&venue=..&description=..). Values are sanitised here
 * and re-validated server-side by createEvent anyway.
 */
function prefillFromParams(
  sp: Record<string, string | string[] | undefined>
): Partial<EventFormInitial> | undefined {
  const title = first(sp.title).trim().slice(0, 120);
  const categoryRaw = first(sp.category).trim();
  const category = CATEGORY_VALUES.includes(categoryRaw)
    ? categoryRaw
    : "";
  const venueAddress = first(sp.venue).trim().slice(0, 300);
  const description = first(sp.description).trim().slice(0, 2000);

  if (!title && !category && !venueAddress && !description) return undefined;
  return {
    ...(title ? { title } : {}),
    ...(category ? { category } : {}),
    ...(venueAddress ? { venueAddress } : {}),
    ...(description ? { description } : {}),
  };
}

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;
  if (!access.canManage)
    return (
      <Forbidden403 reason="Your role can view the dashboard but not add events. Ask the festival chair for organiser access." />
    );

  const prefill = prefillFromParams(await searchParams);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          New event
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          Adds a published event to this edition&apos;s public programme.
        </p>
        {prefill && (
          <p className="mt-2 rounded-lg bg-[#F4A300]/10 px-3 py-2 text-sm text-[#a06a00]">
            Pre-filled from the playbook template — set the date, adjust
            anything, then create.
          </p>
        )}
      </div>
      <EventForm mode="create" initial={prefill} />
    </div>
  );
}
