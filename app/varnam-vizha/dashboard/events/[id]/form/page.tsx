import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { parseFormFields } from "@/lib/varnam/forms/types";
import { FormBuilder } from "./FormBuilder";

export const metadata: Metadata = { title: "Registration form" };

type Params = { params: Promise<{ id: string }> };

export default async function RegistrationFormBuilderPage({ params }: Params) {
  const access = await getVarnamAccess();
  if (!access.canManage) {
    return (
      <Forbidden403
        reason={
          access.canView
            ? "Your role can view the dashboard but not edit registration forms. Ask the festival chair for organiser access."
            : access.reason
        }
      />
    );
  }

  const { id } = await params;
  const sb = createAdminSupabaseClient();
  const { data } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, title, registration_form_fields, public_slug, festival_edition_id")
    .eq("id", id)
    .maybeSingle();
  const event = data as {
    id: string;
    title: string;
    registration_form_fields: unknown;
    public_slug: string | null;
    festival_edition_id: string | null;
  } | null;
  if (!event || !event.festival_edition_id) notFound();

  const initialFields = parseFormFields(event.registration_form_fields);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/varnam-vizha/dashboard/events"
        className="text-sm font-medium text-[#0CA4A5] hover:underline"
      >
        ← All events
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Registration form
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          Extra sign-up questions for{" "}
          <span className="font-semibold text-[#2B0A33]">{event.title}</span>.
          {event.public_slug ? (
            <>
              {" "}
              <Link
                href={`/varnam-vizha/events/${event.public_slug}`}
                className="font-medium text-[#0CA4A5] hover:underline"
              >
                View the public page →
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-[#F4A300]/40 bg-[#F4A300]/5 px-5 py-4 text-sm text-[#2B0A33]/80">
        <span className="font-semibold text-[#3B0A45]">
          Name, email and phone are always collected
        </span>{" "}
        — the questions below are <span className="font-semibold">extra</span>.
        Only add what you'll actually use.
      </div>

      <FormBuilder eventId={event.id} initialFields={initialFields} />
    </div>
  );
}
