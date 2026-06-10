import { createServiceClient } from "@/lib/yuva/supabase/service";

/**
 * Yi Youth Academy storage helpers (donor: app/yi-future/actions/resources.ts).
 * Buckets: yuva-materials / yuva-submissions / yuva-certificates (private,
 * signed-URL only) and yuva-public (public-read: mentor photos + academy logos).
 * ⚠️ Callers are gated actions — these helpers do NOT authorize.
 */

export type YuvaBucket =
  | "yuva-materials"
  | "yuva-submissions"
  | "yuva-certificates"
  | "yuva-public";

/** Upload base64-encoded content. Returns the storage path or an error. */
export async function uploadBase64(
  bucket: YuvaBucket,
  path: string,
  base64: string,
  contentType: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const supabase = await createServiceClient();
  const buffer = Buffer.from(base64, "base64");
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

/** Short-lived signed URL for a private object (default 10 minutes). */
export async function createSignedUrl(
  bucket: YuvaBucket,
  path: string,
  expiresInSeconds = 600
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message ?? "Could not sign URL" };
  }
  return { ok: true, url: data.signedUrl };
}

/** Public URL for an object in the public bucket (no signing). */
export function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  return `${base}/storage/v1/object/public/yuva-public/${path}`;
}

/** Delete an object (best-effort; callers audit-log separately). */
export async function removeObject(
  bucket: YuvaBucket,
  path: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createServiceClient();
  const { error } = await supabase.storage.from(bucket).remove([path]);
  return error ? { ok: false, error: error.message } : { ok: true };
}
