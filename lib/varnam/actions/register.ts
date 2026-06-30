"use server";

/**
 * Public event registration for Varnam Vizha. Writes to yi_connect.guest_rsvps
 * (no login required) via the service client. Free registration only — paid
 * events (e.g. the concert) will add a payment gateway later; this is built
 * gateway-ready but wires no payment.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { computeRegistrationMode } from "@/lib/varnam/data/editions";

export type RegisterState = { ok: boolean; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function registerForEvent(
  _prev: RegisterState,
  formData: FormData
): Promise<RegisterState> {
  const eventId = String(formData.get("event_id") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) return { ok: false, message: "Please enter your name." };
  if (!EMAIL_RE.test(email))
    return { ok: false, message: "Please enter a valid email address." };
  if (!eventId)
    return { ok: false, message: "Something went wrong — missing event." };

  const first = fullName.split(" ")[0];
  const sb = createAdminSupabaseClient();

  // Only allow registration for a real Varnam Vizha edition event.
  const { data: ev } = await sb
    .schema("yi_connect")
    .from("events")
    .select(
      "id, festival_edition_id, status, start_date, max_capacity, waitlist_enabled, custom_fields"
    )
    .eq("id", eventId)
    .maybeSingle();
  const event = ev as {
    festival_edition_id?: string | null;
    status?: string | null;
    start_date?: string | null;
    max_capacity?: number | null;
    waitlist_enabled?: boolean | null;
    custom_fields?: Record<string, unknown> | null;
  } | null;
  if (!event || !event.festival_edition_id) {
    return { ok: false, message: "This event isn't open for registration yet." };
  }

  // De-dupe: same email + event = already registered.
  const { data: existing } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("id")
    .eq("event_id", eventId)
    .ilike("email", email)
    .maybeSingle();
  if (existing) {
    return { ok: true, message: `You're already registered, ${first} — see you there!` };
  }

  // Enforce the registration rules (paid / closed / cancelled / full→waitlist).
  const { count } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "confirmed");
  const mode = computeRegistrationMode({
    status: event.status ?? null,
    customFields: event.custom_fields ?? null,
    startDate: event.start_date ?? null,
    maxCapacity: event.max_capacity ?? null,
    waitlistEnabled: event.waitlist_enabled ?? null,
    confirmedCount: count ?? 0,
  });
  if (mode === "paid")
    return {
      ok: false,
      message: "This is a ticketed event — please buy a ticket via the ticketing link.",
    };
  if (mode === "cancelled")
    return { ok: false, message: "This event has been cancelled." };
  if (mode === "closed")
    return { ok: false, message: "Registration for this event has closed." };
  if (mode === "full")
    return { ok: false, message: "Sorry — this event is full." };

  const status = mode === "waitlist" ? "waitlist" : "confirmed";
  const { error } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .insert({
      event_id: eventId,
      full_name: fullName,
      email,
      phone: phone || null,
      status,
    });
  if (error) {
    return { ok: false, message: "Couldn't register right now — please try again." };
  }

  return {
    ok: true,
    message:
      status === "waitlist"
        ? `You're on the waitlist, ${first} — we'll be in touch if a spot opens up.`
        : `You're registered, ${first}! A confirmation will follow by email.`,
  };
}
