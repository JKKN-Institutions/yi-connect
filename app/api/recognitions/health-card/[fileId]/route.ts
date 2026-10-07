/**
 * GET /api/recognitions/health-card/[fileId] — download one National Health
 * Card file (Phase 0: "National Health Card Excel (Download)").
 *
 * Allowed: the Recognitions super admin, National Leadership, or a viewer
 * holding an ACTIVE evaluator duty (RM or NMT) on that file's award. The
 * reply is a 302 to a 60-second signed Storage URL. Anyone else gets a JSON
 * 401/403 with a plain sentence — never a redirect to a landing page.
 */

import { getRxViewer } from "@/lib/recognitions/auth";
import { rxService } from "@/lib/recognitions/supabase";
import { HEALTH_CARD_BUCKET } from "@/app/recognitions/(desk)/admin/_lib/health-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const viewer = await getRxViewer();
  if (!viewer) return json(401, "You are not signed in, or your account is not in the Yi directory.");

  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return json(404, "That Health Card file doesn't exist.");
  const svc = rxService();
  const { data } = await svc
    .from("recognition_health_card_files")
    .select("id, award_id, storage_path, file_name")
    .eq("id", fileId)
    .maybeSingle();
  const file = data as { id: string; award_id: string; storage_path: string; file_name: string } | null;
  if (!file) return json(404, "That Health Card file doesn't exist.");

  // viewer.duties already holds only ACTIVE duties in the current cycle that the directory backs.
  const allowed =
    viewer.isSuperAdmin || viewer.isNationalLeadership || viewer.duties.some((d) => d.award_id === file.award_id);
  if (!allowed) return json(403, "Only this award's evaluators, National Leadership and the Recognitions super admin can download its Health Card.");

  const { data: signed, error } = await svc.storage
    .from(HEALTH_CARD_BUCKET)
    .createSignedUrl(file.storage_path, 60, { download: file.file_name });
  if (error || !signed?.signedUrl) return json(404, "The stored file is missing. Ask the Recognitions super admin to upload it again.");
  return Response.redirect(signed.signedUrl, 302);
}
