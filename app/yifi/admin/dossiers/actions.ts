"use server";

/**
 * YiFi Dossier admin server actions.
 *
 * Two explicit, admin-gated actions:
 *   - runDossierGeneration()  → generate dossiers for all census-complete
 *                               registrants (engine call).
 *   - deliverOneDossier(form) → manually deliver ONE dossier over WhatsApp.
 *
 * Both gate on getAdminContext + hasPermission("dossiers") and render/return
 * an explicit denial (rule #27 — never a silent redirect). NO automatic or
 * bulk-blast sending lives here; delivery is one explicit click per registrant.
 */

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAdminContext, hasPermission } from "../_guard";
import { generateAllDossiers } from "@/lib/yifi/dossier/generate";
import { deliverDossierWhatsApp } from "@/lib/yifi/dossier/deliver";
import type {
  GenerationActionResult,
  DeliverActionResult,
} from "@/lib/yifi/dossier/types";

/**
 * Generate dossiers for every census-complete registrant in the active edition.
 * Code-complete and gated; requires ANTHROPIC_API_KEY at runtime to produce
 * content (degrades to a clear error otherwise).
 */
export async function runDossierGeneration(): Promise<GenerationActionResult> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "dossiers")) {
    return { ok: false, error: "You don't have the 'dossiers' permission." };
  }

  const summary = await generateAllDossiers(ctx.editionId);

  revalidatePath("/yifi/admin/dossiers");

  return { ok: true, summary };
}

/**
 * Deliver ONE dossier over WhatsApp. Reads dossierId / phone / fullName from
 * the submitted form. Builds an absolute dossier URL from the request origin
 * when available, falling back to the relative member path.
 */
export async function deliverOneDossier(
  formData: FormData
): Promise<DeliverActionResult> {
  const ctx = await getAdminContext();
  if (!hasPermission(ctx.permissions, "dossiers")) {
    return { ok: false, error: "You don't have the 'dossiers' permission." };
  }

  const dossierId = (formData.get("dossierId") as string | null)?.trim() ?? "";
  const phone = (formData.get("phone") as string | null)?.trim() ?? "";
  const fullName = (formData.get("fullName") as string | null)?.trim() ?? "";

  if (!dossierId) {
    return { ok: false, error: "Missing dossier id." };
  }

  // The member reads the dossier at /yifi/me/dossier after logging in with their
  // access code. Build an absolute URL from the request origin when we can.
  const relativePath = "/yifi/me/dossier";
  let dossierUrl = relativePath;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) {
      dossierUrl = `${proto}://${host}${relativePath}`;
    }
  } catch {
    // Fall back to the relative path.
  }

  const result = await deliverDossierWhatsApp(dossierId, phone, fullName, dossierUrl);

  revalidatePath("/yifi/admin/dossiers");

  return result;
}
