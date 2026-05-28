"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { logAuditAction } from "@/lib/yip/audit/log-action";

// ─── Access Code Validation (unauthenticated) ──────────────────────

type ValidationResult =
  | {
      type: "participant";
      participant: {
        id: string;
        full_name: string;
        school_name: string;
        parliament_role: string | null;
        party_side: string | null;
        committee_name: string | null;
      };
      eventId: string;
    }
  | {
      type: "jury";
      jury: {
        id: string;
        jury_name: string;
      };
      eventId: string;
    }
  | {
      type: "error";
      message: string;
    };

export async function validateAccessCode(
  code: string
): Promise<ValidationResult> {
  const trimmed = code.trim().toUpperCase();

  if (!trimmed || trimmed.length < 3 || trimmed.length > 10) {
    return { type: "error", message: "Please enter a valid access code" };
  }

  const supabase = await createServiceClient();

  // Check participants table first
  const { data: participant, error: pError } = await supabase
    .from("participants")
    .select(
      "id, full_name, school_name, parliament_role, party_side, committee_name, event_id"
    )
    .eq("access_code", trimmed)
    .single();

  if (participant && !pError) {
    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(
      "yip_session",
      JSON.stringify({
        type: "participant",
        id: participant.id,
        name: participant.full_name,
        eventId: participant.event_id,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      }
    );

    return {
      type: "participant",
      participant: {
        id: participant.id,
        full_name: participant.full_name,
        school_name: participant.school_name,
        parliament_role: participant.parliament_role,
        party_side: participant.party_side,
        committee_name: participant.committee_name,
      },
      eventId: participant.event_id,
    };
  }

  // Check jury_assignments table
  const { data: jury, error: jError } = await supabase
    .from("jury_assignments")
    .select("id, jury_name, event_id, is_active")
    .eq("access_code", trimmed)
    .single();

  if (jury && !jError) {
    if (!jury.is_active) {
      return {
        type: "error",
        message: "This jury code has been deactivated",
      };
    }

    // Set session cookie
    const cookieStore = await cookies();
    cookieStore.set(
      "yip_session",
      JSON.stringify({
        type: "jury",
        id: jury.id,
        name: jury.jury_name,
        eventId: jury.event_id,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      }
    );

    return {
      type: "jury",
      jury: {
        id: jury.id,
        jury_name: jury.jury_name,
      },
      eventId: jury.event_id,
    };
  }

  return { type: "error", message: "Code not found" };
}

// ─── Frictionless Jury Login by Email + Event ──────────────────────
//
// Security model (Phase 19 / D):
//   "Frictionless" cannot mean "anyone with an email can score." Instead,
//   the organizer pre-creates a jury_assignment row with the juror's email
//   for a specific event. Login = lookup match. No match → not authorised.
//
//   Pros: zero-friction for legit jurors, no password/OTP UI surface, no
//   open auth hole. Cons: organizer must enter emails in advance (they
//   already do — they print badges with access codes today).

type JuryLoginResult =
  | {
      type: "ok";
      jury: { id: string; jury_name: string };
      eventId: string;
    }
  | { type: "error"; message: string };

export async function juryLoginByEmail(
  email: string,
  eventId: string
): Promise<JuryLoginResult> {
  const normalisedEmail = email.trim().toLowerCase();
  const trimmedEventId = eventId.trim();

  if (!normalisedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) {
    return { type: "error", message: "Please enter a valid email address" };
  }

  if (!trimmedEventId) {
    return { type: "error", message: "Please select an event" };
  }

  const supabase = await createServiceClient();

  const { data: jury, error } = await supabase
    .from("jury_assignments")
    .select("id, jury_name, event_id, is_active")
    .eq("email", normalisedEmail)
    .eq("event_id", trimmedEventId)
    .maybeSingle();

  if (error || !jury) {
    return {
      type: "error",
      message:
        "Not authorized for this event. Please contact the event organizer.",
    };
  }

  if (jury.is_active === false) {
    return {
      type: "error",
      message: "Your jury access has been deactivated. Contact the organizer.",
    };
  }

  // Set the SAME session cookie shape as access-code login so /yip/jury/*
  // is agnostic to login method.
  const cookieStore = await cookies();
  cookieStore.set(
    "yip_session",
    JSON.stringify({
      type: "jury",
      id: jury.id,
      name: jury.jury_name,
      eventId: jury.event_id,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    }
  );

  await logAuditAction({
    action_type: "login",
    target_table: "auth",
    target_id: jury.id,
    target_event_id: jury.event_id,
    performed_by: { email: normalisedEmail },
    metadata: { method: "jury-email", jury_name: jury.jury_name },
  });

  return {
    type: "ok",
    jury: { id: jury.id, jury_name: jury.jury_name },
    eventId: jury.event_id,
  };
}

// Public list of events for the jury login dropdown.
// Returns only minimal display info (no payment/admin fields).
export async function listJuryLoginEvents(): Promise<
  Array<{
    id: string;
    name: string;
    chapter_name: string | null;
    level: string;
    day1_date: string;
  }>
> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, chapter_name, level, day1_date")
    .order("day1_date", { ascending: false });

  return data ?? [];
}

// ─── Organizer Auth (Supabase Auth) ─────────────────────────────────

type LoginResult =
  | { success: true }
  | { success: false; error: string };

export async function loginOrganizer(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  await logAuditAction({
    action_type: "login",
    target_table: "auth",
    performed_by: { email: email.trim().toLowerCase() },
    metadata: { method: "organizer-password" },
  });

  return { success: true };
}

export async function logoutOrganizer(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/yip/login");
}
