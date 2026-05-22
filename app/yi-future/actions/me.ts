"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "./auth";
import type { ActionResult } from "./editions";

async function requireDelegate(): Promise<string | null> {
  const session = await readSession();
  if (!session || session.type !== "delegate") return null;
  return session.id;
}

export async function updateMyResume(
  formData: FormData
): Promise<ActionResult> {
  const delegateId = await requireDelegate();
  if (!delegateId) return { ok: false, error: "Not signed in as delegate." };

  const resume_url = String(formData.get("resume_url") ?? "").trim() || null;

  if (resume_url) {
    try {
      const u = new URL(resume_url);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return { ok: false, error: "Only http(s) URLs accepted." };
      }
    } catch {
      return { ok: false, error: "Please enter a valid URL." };
    }
  }

  const svc = await createServiceClient();
  const { error } = await svc
    .schema("future")
    .from("delegates")
    .update({ resume_url })
    .eq("id", delegateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/me");
  revalidatePath("/me/resume");
  return { ok: true, message: "Resume link updated." };
}
