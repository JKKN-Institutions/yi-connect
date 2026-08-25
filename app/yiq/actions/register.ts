"use server";

/**
 * Public team registration. NO authentication — a schoolteacher registers
 * their team from a phone. Every guard therefore lives here.
 *
 * A "use server" file may export ONLY async functions. Types and constants
 * for this flow live in lib/yiq/registration.ts.
 */

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yiq/supabase/server";
import { generateStudentCode, generateTeamCode } from "@/lib/yiq/access-code";
import { categoryForClass } from "@/lib/yiq/constants";
import {
  MAX_TEAMS_PER_SCHOOL_PER_CATEGORY,
  REGISTRATIONS_PER_IP_PER_HOUR,
  type RegisterTeamInput,
  type RegisterTeamResult,
  validateRegistration,
} from "@/lib/yiq/registration";

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function registerTeam(
  input: RegisterTeamInput
): Promise<RegisterTeamResult> {
  // ---- 0. Honeypot. A real person never fills a hidden field. -----------
  if (input.website && input.website.trim() !== "") {
    // Behave exactly like success so a bot gets no signal.
    return { success: true, teamCode: "", members: [] };
  }

  // ---- 1. Shape + business validation (pure, testable) ------------------
  const invalid = validateRegistration(input);
  if (invalid) return { success: false, error: invalid };

  const svc = await createServiceClient();
  const ip = await clientIp();
  const h = await headers();
  const userAgent = (h.get("user-agent") ?? "").slice(0, 400);

  // ---- 2. The event must actually be open. FAIL CLOSED. -----------------
  const { data: event } = await svc
    .from("chapter_events")
    .select(
      "id, chapter_name, status, edition_id, registration_opens_at, registration_closes_at"
    )
    .eq("id", input.chapterEventId)
    .maybeSingle();

  if (!event) {
    return { success: false, error: "That chapter is not running YIQ yet." };
  }
  if (event.status !== "registration_open") {
    return {
      success: false,
      error: `Registration for ${event.chapter_name} is not open right now.`,
    };
  }

  const { data: edition } = await svc
    .from("editions")
    .select("registration_opens_at, registration_closes_at")
    .eq("id", event.edition_id)
    .maybeSingle();

  // Per-event window overrides the edition window; null on both means open.
  const opens = event.registration_opens_at ?? edition?.registration_opens_at;
  const closes = event.registration_closes_at ?? edition?.registration_closes_at;
  const now = Date.now();
  if (opens && now < Date.parse(opens)) {
    return { success: false, error: "Registration has not opened yet." };
  }
  if (closes && now > Date.parse(closes)) {
    return { success: false, error: "Registration has closed for this chapter." };
  }

  // ---- 3. Per-IP throttle ------------------------------------------------
  if (ip !== "unknown") {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await svc
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("registered_ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= REGISTRATIONS_PER_IP_PER_HOUR) {
      return {
        success: false,
        error:
          "Too many registrations from this device in the last hour. Try again later, or ask your chapter organiser to add the team.",
      };
    }
  }

  // ---- 4. Find or create the school -------------------------------------
  const schoolName = input.schoolName.trim();
  let schoolId: string;

  const { data: existingSchool } = await svc
    .from("schools")
    .select("id")
    .eq("edition_id", event.edition_id)
    .eq("chapter_name", event.chapter_name)
    .ilike("name", schoolName)
    .maybeSingle();

  if (existingSchool) {
    schoolId = existingSchool.id;
  } else {
    const { data: created, error: schoolErr } = await svc
      .from("schools")
      .insert({
        edition_id: event.edition_id,
        chapter_name: event.chapter_name,
        name: schoolName,
        school_type: input.schoolType,
        board: input.board?.trim() || null,
        city: input.city?.trim() || null,
        district: input.district?.trim() || null,
        state: input.state?.trim() || null,
        principal_name: input.principalName?.trim() || null,
        contact_person: input.contactPerson.trim(),
        contact_email: input.contactEmail.trim().toLowerCase(),
        contact_phone: input.contactPhone.trim(),
        registered_ip: ip,
      })
      .select("id")
      .single();

    if (schoolErr || !created) {
      console.error("[yiq] school insert failed", schoolErr);
      return {
        success: false,
        error: "Could not save the school. Please check the details and retry.",
      };
    }
    schoolId = created.id;
  }

  // ---- 5. Cap teams per school per category -----------------------------
  const category = categoryForClass(input.members[0].classLevel)!;
  const { count: existingTeams } = await svc
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("category", category)
    .neq("status", "withdrawn");

  if ((existingTeams ?? 0) >= MAX_TEAMS_PER_SCHOOL_PER_CATEGORY) {
    return {
      success: false,
      error: `${schoolName} already has ${MAX_TEAMS_PER_SCHOOL_PER_CATEGORY} ${category} teams registered — the maximum per school.`,
    };
  }

  // ---- 6. Create the team, retrying on a code collision ------------------
  let teamId: string | null = null;
  let teamCode = "";
  for (let attempt = 0; attempt < 5 && !teamId; attempt++) {
    teamCode = generateTeamCode();
    const { data, error } = await svc
      .from("teams")
      .insert({
        chapter_event_id: event.id,
        school_id: schoolId,
        name: input.teamName.trim(),
        category,
        team_code: teamCode,
        status: "registered",
        registered_ip: ip,
        registered_user_agent: userAgent,
      })
      .select("id")
      .single();
    if (data) teamId = data.id;
    else if (error && !`${error.message}`.includes("team_code")) {
      console.error("[yiq] team insert failed", error);
      return { success: false, error: "Could not create the team. Please retry." };
    }
  }

  if (!teamId) {
    return { success: false, error: "Could not generate a team code. Please retry." };
  }

  // ---- 7. Create the members --------------------------------------------
  const members: { name: string; classLevel: number; accessCode: string }[] = [];
  for (let i = 0; i < input.members.length; i++) {
    const m = input.members[i];
    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      const accessCode = generateStudentCode();
      const { error } = await svc.from("students").insert({
        team_id: teamId,
        full_name: m.fullName.trim(),
        class_level: m.classLevel,
        section: m.section?.trim() || null,
        email: m.email?.trim().toLowerCase() || null,
        phone: m.phone?.trim() || null,
        access_code: accessCode,
        is_captain: i === 0,
      });
      if (!error) {
        members.push({
          name: m.fullName.trim(),
          classLevel: m.classLevel,
          accessCode,
        });
        saved = true;
      } else if (!`${error.message}`.includes("access_code")) {
        console.error("[yiq] student insert failed", error);
        // Roll the team back so a half-built team never sits in the data.
        await svc.from("teams").delete().eq("id", teamId);
        return {
          success: false,
          error: "Could not save team members. Please retry.",
        };
      }
    }
    if (!saved) {
      await svc.from("teams").delete().eq("id", teamId);
      return { success: false, error: "Could not generate access codes. Please retry." };
    }
  }

  await svc.from("audit_log").insert({
    actor_label: input.contactEmail.trim().toLowerCase(),
    action: "team_registered",
    entity_type: "team",
    entity_id: teamId,
    chapter_event_id: event.id,
    detail: {
      school: schoolName,
      team: input.teamName.trim(),
      category,
      members: members.length,
      ip,
    },
  });

  revalidatePath("/yiq/dashboard");

  return {
    success: true,
    teamCode,
    teamName: input.teamName.trim(),
    schoolName,
    category,
    chapterName: event.chapter_name,
    members,
  };
}

/** Chapters currently accepting registrations, for the picker. */
export async function getOpenChapters(): Promise<
  { id: string; chapterName: string; zone: string | null }[]
> {
  const svc = await createServiceClient();
  const { data: edition } = await svc
    .from("editions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (!edition) return [];

  const { data } = await svc
    .from("chapter_events")
    .select("id, chapter_name, yi_zone")
    .eq("edition_id", edition.id)
    .eq("status", "registration_open")
    .order("chapter_name");

  return (data ?? []).map((c) => ({
    id: c.id,
    chapterName: c.chapter_name,
    zone: c.yi_zone,
  }));
}
