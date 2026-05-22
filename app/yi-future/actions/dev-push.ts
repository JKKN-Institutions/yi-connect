"use server";

import { createClient } from "@/lib/yi-future/supabase/server";
import { sendPushToSubject } from "./push";
import type { PushSubjectType } from "./push-types";

// NOTE: "use server" files may only export async functions. Types below are
// used internally; consumers re-import them from this module via TS's
// structural typing (types aren't emitted at runtime so this is safe).

export type DevPushSubjectType = Extract<
  PushSubjectType,
  "delegate" | "mentor" | "jury" | "partner"
> | "auth_user";

export type DevPushInput = {
  title: string;
  body: string;
  url?: string;
  subjectType: DevPushSubjectType;
  subjectId: string;
};

export type DevPushResult =
  | { ok: true; sent: number; failed: number; removed: number }
  | { ok: false; error: string };

/**
 * DEV-ONLY: send a manual test push to any subject. Admin auth required.
 * Uses the shared sendPushToSubject under the hood.
 */
export async function sendDevTestPush(
  input: DevPushInput
): Promise<DevPushResult> {
  try {
    // Admin gate: must have a Supabase Auth user.
    const supabase = await createClient();
    const { data, error: authErr } = await supabase.auth.getUser();
    if (authErr || !data?.user) {
      return { ok: false, error: "admin auth required" };
    }

    // Validate inputs.
    const title = (input.title ?? "").trim();
    const body = (input.body ?? "").trim();
    const subjectId = (input.subjectId ?? "").trim();

    if (title.length < 1) return { ok: false, error: "title required" };
    if (body.length < 1) return { ok: false, error: "body required" };
    if (subjectId.length < 1) return { ok: false, error: "subjectId required" };

    const validTypes: DevPushSubjectType[] = [
      "delegate",
      "mentor",
      "jury",
      "partner",
      "auth_user",
    ];
    if (!validTypes.includes(input.subjectType)) {
      return { ok: false, error: "invalid subjectType" };
    }

    const result = await sendPushToSubject(input.subjectType, subjectId, {
      title,
      body,
      url: input.url?.trim() || "/me",
    });

    return {
      ok: true,
      sent: result.sent,
      failed: result.failed,
      removed: result.removed,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "unknown error sending push";
    return { ok: false, error: message };
  }
}
