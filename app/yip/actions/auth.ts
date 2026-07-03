"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";
import { mintYipSession } from "@/lib/yip/auth/yip-session";
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
      // Floor voting: YUVA volunteer kiosk login (access code on yip.volunteers).
      type: "volunteer";
      volunteer: {
        id: string;
        full_name: string;
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
    await mintYipSession({
      type: "participant",
      id: participant.id,
      name: participant.full_name,
      eventId: participant.event_id,
    });

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
    await mintYipSession({
      type: "jury",
      id: jury.id,
      name: jury.jury_name,
      eventId: jury.event_id,
    });

    return {
      type: "jury",
      jury: {
        id: jury.id,
        jury_name: jury.jury_name,
      },
      eventId: jury.event_id,
    };
  }

  // Check volunteers table (floor-voting kiosk carriers). A volunteer's code
  // can be revoked by clearing volunteers.access_code in the Volunteers tab.
  const { data: volunteer, error: vError } = await supabase
    .from("volunteers")
    .select("id, full_name, event_id")
    .eq("access_code", trimmed)
    .single();

  if (volunteer && !vError) {
    await mintYipSession({
      type: "volunteer",
      id: volunteer.id,
      name: volunteer.full_name,
      eventId: volunteer.event_id,
    });

    return {
      type: "volunteer",
      volunteer: {
        id: volunteer.id,
        full_name: volunteer.full_name,
      },
      eventId: volunteer.event_id,
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
