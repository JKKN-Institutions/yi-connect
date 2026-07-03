import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { EventForm } from "../EventForm";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;
  if (!access.canManage)
    return (
      <Forbidden403 reason="Your role can view the dashboard but not add events. Ask the festival chair for organiser access." />
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          New event
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          Adds a published event to this edition&apos;s public programme.
        </p>
      </div>
      <EventForm mode="create" />
    </div>
  );
}
