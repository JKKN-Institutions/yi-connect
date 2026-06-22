"use server";

/**
 * Public event registration for Varnam Vizha. Writes to yi_connect.guest_rsvps
 * (no login required) via the service client. Free registration only — paid
 * events (e.g. the concert) will add a payment gateway later; this is built
 * gateway-ready but wires no payment.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";

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
    .select("id, festival_edition_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev || !(ev as { festival_edition_id?: string }).festival_edition_id) {
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

  const { error } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .insert({
      event_id: eventId,
      full_name: fullName,
      email,
      phone: phone || null,
      status: "confirmed",
    });
  if (error) {
    return { ok: false, message: "Couldn't register right now — please try again." };
  }

  return {
    ok: true,
    message: `You're registered, ${first}! A confirmation will follow by email.`,
  };
}
