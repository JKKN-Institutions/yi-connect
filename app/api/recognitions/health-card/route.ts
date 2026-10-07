/**
 * POST /api/recognitions/health-card — upload a National Health Card file
 * for one award (super admin only).
 *
 * The file bytes do NOT pass through this route: Vercel refuses any function
 * request body over ~4.5 MB before Next.js runs, which would break the
 * promised 10 MB limit (measured in production 2026-09-11). So the upload is
 * two small JSON calls around a direct browser-to-Storage upload:
 *
 *   { step: "start",  awardId, fileName, size }  -> { path, token }
 *        browser: storage.uploadToSignedUrl(path, token, file)
 *   { step: "finish", awardId, path, fileName }  -> { fileId }
 *
 * "finish" re-reads the stored object, checks its size and that it opens as
 * a spreadsheet, then records recognition_health_card_files + an audit row.
 * Denials are JSON 401/403 with a plain message, never a redirect.
 */

import { revalidatePath } from "next/cache";
import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import { audit, getAward } from "@/lib/recognitions/data";
import {
  HEALTH_CARD_EXTS,
  HEALTH_CARD_MAX_BYTES,
  extOf,
  safeName,
} from "@/app/recognitions/(desk)/admin/_lib/ist";
import { HEALTH_CARD_BUCKET, parseWorkbook } from "@/app/recognitions/(desk)/admin/_lib/health-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const TYPES_TEXT = "Upload an Excel file (.xlsx or .xls) or a .csv file.";

export async function POST(req: Request) {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return json(gate.error.startsWith("You are not signed in") ? 401 : 403, { error: gate.error });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: "The request was not understood. Reload the page and try again." });
  }

  const awardId = String(body.awardId ?? "");
  const award = awardId ? await getAward(awardId) : null;
  if (!award) return json(404, { error: "That award no longer exists. Reload the page." });
  const fileName = String(body.fileName ?? "").trim();
  const ext = extOf(fileName);
  if (!fileName || !(HEALTH_CARD_EXTS as readonly string[]).includes(ext)) return json(400, { error: TYPES_TEXT });

  const svc = rxService();
  const prefix = `${award.cycle_id}/${award.id}/`;

  if (body.step === "start") {
    const size = Number(body.size);
    if (!Number.isFinite(size) || size <= 0) return json(400, { error: "That file is empty." });
    if (size > HEALTH_CARD_MAX_BYTES) return json(400, { error: "That file is over 10 MB. Remove extra sheets or images and try again." });
    const path = `${prefix}${Date.now()}-${safeName(fileName)}`;
    const { data, error } = await svc.storage.from(HEALTH_CARD_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return json(500, { error: "Couldn't start the upload. Try again in a minute." });
    return json(200, { path: data.path, token: data.token });
  }

  if (body.step === "finish") {
    const path = String(body.path ?? "");
    if (!path.startsWith(prefix) || path.includes("..")) return json(400, { error: "That upload doesn't belong to this award. Start again." });
    const { data: blob, error } = await svc.storage.from(HEALTH_CARD_BUCKET).download(path);
    if (error || !blob) return json(400, { error: "The file didn't arrive. Upload it again." });
    if (blob.size > HEALTH_CARD_MAX_BYTES) {
      await svc.storage.from(HEALTH_CARD_BUCKET).remove([path]);
      return json(400, { error: "That file is over 10 MB. Remove extra sheets or images and try again." });
    }
    try {
      parseWorkbook(new Uint8Array(await blob.arrayBuffer()));
    } catch {
      await svc.storage.from(HEALTH_CARD_BUCKET).remove([path]);
      return json(400, { error: "We couldn't read that file as a spreadsheet. Save it as .xlsx and upload it again." });
    }
    const { data: row, error: insErr } = await svc
      .from("recognition_health_card_files")
      .insert({ award_id: award.id, storage_path: path, file_name: fileName, uploaded_by: gate.viewer.personId })
      .select("id")
      .single();
    if (insErr || !row) return json(500, { error: "The file was stored but couldn't be recorded. Try again." });
    const fileId = (row as { id: string }).id;
    await audit({
      cycleId: award.cycle_id,
      awardId: award.id,
      actorPersonId: gate.viewer.personId,
      action: "upload",
      entity: "health_card_file",
      entityId: fileId,
      detail: { file_name: fileName, bytes: blob.size },
    });
    revalidatePath("/recognitions", "layout");
    return json(200, { fileId });
  }

  return json(400, { error: "The request was not understood. Reload the page and try again." });
}
