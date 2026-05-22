"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/yip/supabase/server";

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

  return { success: true };
}

export async function logoutOrganizer(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/yip/login");
}
