"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yi-future/supabase/server";
import { readSession } from "@/app/yi-future/actions/auth";
import type { ActionResult } from "./editions";

export type ResourceType = "file" | "url";

export type ResourceRow = {
  id: string;
  edition_id: string;
  uploaded_by_mentor_id: string;
  title: string;
  description: string | null;
  resource_type: ResourceType;
  file_path: string | null;
  external_url: string | null;
  created_at: string;
  mentors: {
    full_name: string;
    organization: string | null;
  } | null;
};

const BUCKET = "future-resources";

/**
 * Best-effort bucket creation. Swallows "already exists" errors so subsequent
 * calls are no-ops. Buckets are created public so signed URLs aren't strictly
 * required for public reads, but we still mint signed URLs for the delegate UI
 * to keep the contract identical if the bucket is flipped private later.
 */
async function ensureBucket(): Promise<void> {
  try {
    const svc = await createServiceClient();
    // The storage client lives outside the typed schema surface; use any.
    const storage = (svc as unknown as {
      storage: {
        createBucket: (
          id: string,
          opts: { public: boolean }
        ) => Promise<{ error: { message: string } | null }>;
      };
    }).storage;
    const { error } = await storage.createBucket(BUCKET, { public: true });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      // Log but don't throw — bucket might exist from a previous session.
      console.warn("[resources] createBucket warning:", error.message);
    }
  } catch (err) {
    console.warn("[resources] ensureBucket failed (non-fatal):", err);
  }
}

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function addResource(input: {
  editionId?: string;
  title: string;
  description?: string;
  type: ResourceType;
  filePath?: string;
  externalUrl?: string;
}): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "mentor") {
    return { ok: false, error: "Mentor session required." };
  }

  const title = input.title.trim();
  if (!title) return { ok: false, error: "Title is required." };

  const editionId = (input.editionId ?? session.edition_id).trim();
  if (!editionId) return { ok: false, error: "Edition is required." };

  const description = input.description?.trim() || null;

  if (input.type === "file") {
    const filePath = input.filePath?.trim();
    if (!filePath) {
      return { ok: false, error: "File path is required for file resources." };
    }
    await ensureBucket();
    const svc = await createServiceClient();
    const { error } = await (svc as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          insert: (row: never) => Promise<{ error: { message: string } | null }>;
        };
      };
    })
      .schema("future")
      .from("resources")
      .insert({
        edition_id: editionId,
        uploaded_by_mentor_id: session.id,
        title,
        description,
        resource_type: "file",
        file_path: filePath,
        external_url: null,
      } as never);
    if (error) return { ok: false, error: error.message };
  } else if (input.type === "url") {
    const externalUrl = input.externalUrl?.trim();
    if (!externalUrl) {
      return { ok: false, error: "URL is required." };
    }
    if (!isValidUrl(externalUrl)) {
      return {
        ok: false,
        error: "Enter a valid URL starting with http:// or https://",
      };
    }
    const svc = await createServiceClient();
    const { error } = await (svc as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          insert: (row: never) => Promise<{ error: { message: string } | null }>;
        };
      };
    })
      .schema("future")
      .from("resources")
      .insert({
        edition_id: editionId,
        uploaded_by_mentor_id: session.id,
        title,
        description,
        resource_type: "url",
        file_path: null,
        external_url: externalUrl,
      } as never);
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: "Invalid resource type." };
  }

  revalidatePath("/yi-future/mentor/resources");
  revalidatePath("/yi-future/me/resources");
  return { ok: true, message: "Resource added." };
}

export async function deleteResource(
  resourceId: string
): Promise<ActionResult> {
  const session = await readSession();
  if (!session || session.type !== "mentor") {
    return { ok: false, error: "Mentor session required." };
  }
  const id = resourceId.trim();
  if (!id) return { ok: false, error: "Resource id is required." };

  const svc = await createServiceClient();

  // Fetch the row first so we can verify ownership and clean up storage.
  const { data: existing } = await (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            c: string,
            v: string
          ) => {
            maybeSingle: () => Promise<{
              data:
                | {
                    id: string;
                    uploaded_by_mentor_id: string;
                    resource_type: ResourceType;
                    file_path: string | null;
                  }
                | null;
            }>;
          };
        };
      };
    };
  })
    .schema("future")
    .from("resources")
    .select("id, uploaded_by_mentor_id, resource_type, file_path")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Resource not found." };
  if (existing.uploaded_by_mentor_id !== session.id) {
    return { ok: false, error: "You can only delete your own resources." };
  }

  const { error } = await (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        delete: () => {
          eq: (
            c: string,
            v: string
          ) => Promise<{ error: { message: string } | null }>;
        };
      };
    };
  })
    .schema("future")
    .from("resources")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Best-effort storage cleanup for file resources.
  if (existing.resource_type === "file" && existing.file_path) {
    try {
      const storage = (svc as unknown as {
        storage: {
          from: (b: string) => {
            remove: (paths: string[]) => Promise<{ error: unknown }>;
          };
        };
      }).storage;
      await storage.from(BUCKET).remove([existing.file_path]);
    } catch (err) {
      console.warn("[resources] storage cleanup failed:", err);
    }
  }

  revalidatePath("/yi-future/mentor/resources");
  revalidatePath("/yi-future/me/resources");
  return { ok: true, message: "Resource deleted." };
}

export async function listResources(
  editionId?: string
): Promise<ResourceRow[]> {
  const svc = await createServiceClient();

  // If no edition supplied, find the active one.
  let resolvedEditionId = editionId?.trim();
  if (!resolvedEditionId) {
    const { data: edition } = await (svc as unknown as {
      schema: (s: string) => {
        from: (t: string) => {
          select: (cols: string) => {
            eq: (
              c: string,
              v: boolean
            ) => {
              maybeSingle: () => Promise<{
                data: { id: string } | null;
              }>;
            };
          };
        };
      };
    })
      .schema("future")
      .from("editions")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    resolvedEditionId = edition?.id;
  }

  if (!resolvedEditionId) return [];

  const { data } = await (svc as unknown as {
    schema: (s: string) => {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (
            c: string,
            v: string
          ) => {
            order: (
              c: string,
              o: { ascending: boolean }
            ) => Promise<{ data: ResourceRow[] | null }>;
          };
        };
      };
    };
  })
    .schema("future")
    .from("resources")
    .select(
      "id, edition_id, uploaded_by_mentor_id, title, description, resource_type, file_path, external_url, created_at, mentors:uploaded_by_mentor_id(full_name, organization)"
    )
    .eq("edition_id", resolvedEditionId)
    .order("created_at", { ascending: false });

  return (data as ResourceRow[] | null) ?? [];
}

/**
 * Returns a signed URL for a stored file (1 hour). Used by the delegate page
 * to "Open" file resources without exposing the bucket directly.
 */
export async function getResourceSignedUrl(
  filePath: string
): Promise<{ url: string | null; error?: string }> {
  if (!filePath) return { url: null, error: "Missing path." };
  const svc = await createServiceClient();
  try {
    const storage = (svc as unknown as {
      storage: {
        from: (b: string) => {
          createSignedUrl: (
            p: string,
            expiresIn: number
          ) => Promise<{
            data: { signedUrl: string } | null;
            error: { message: string } | null;
          }>;
        };
      };
    }).storage;
    const { data, error } = await storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60 * 60);
    if (error) return { url: null, error: error.message };
    return { url: data?.signedUrl ?? null };
  } catch (err) {
    return { url: null, error: (err as Error).message };
  }
}

export async function listMyResources(): Promise<ResourceRow[]> {
  const session = await readSession();
  if (!session || session.type !== "mentor") return [];
  const all = await listResources(session.edition_id);
  return all.filter((r) => r.uploaded_by_mentor_id === session.id);
}
