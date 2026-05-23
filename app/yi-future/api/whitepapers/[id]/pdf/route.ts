/**
 * Streams a generated Track Whitepaper PDF by id.
 * Published whitepapers are publicly readable.
 * Drafts are only readable by authenticated Supabase Auth users (admins).
 * Handbook ref: [HPB §7.1]
 */

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import { generateWhitepaperPdf } from "@/lib/yi-future/whitepaper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Section = { heading: string; body: string };

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "whitepaper"
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: "Whitepaper id required." },
      { status: 400 }
    );
  }

  const svc = await createServiceClient();
  // Phase E fix 2026-05-23 (Agent re-audit): drop `chapters:host_chapter_id`
  // embed. whitepapers.host_chapter_id is a cross-schema FK
  // (future.whitepapers -> yi.chapters), which PostgREST cannot resolve when
  // scoped to the `future` schema (PGRST200). Fetch the whitepaper first,
  // then resolve the chapter name via a follow-up lookup against yi.chapters
  // using the service client's schema switcher.
  const { data, error } = await svc
    .schema("future")
    .from("whitepapers")
    .select(
      `
      id,
      title,
      executive_summary,
      sections,
      cover_image_url,
      status,
      published_at,
      host_chapter_id,
      tracks:track_id ( name, icon ),
      editions:edition_id ( name )
      `
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "Whitepaper not found." },
      { status: 404 }
    );
  }

  // Draft access requires an authenticated Supabase Auth user.
  if (data.status !== "published") {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "This whitepaper is still a draft." },
        { status: 403 }
      );
    }
  }

  // Supabase single-row join returns either a single object or an array
  // depending on the relationship; normalise both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pickOne = <T,>(rel: any): T | null => {
    if (!rel) return null;
    if (Array.isArray(rel)) return (rel[0] as T) ?? null;
    return rel as T;
  };

  const track = pickOne<{ name: string | null; icon: string | null }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).tracks
  );
  const edition = pickOne<{ name: string | null }>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (data as any).editions
  );

  // Resolve host chapter via follow-up lookup against yi.chapters.
  let chapter: { name: string | null } | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hostChapterId = (data as any).host_chapter_id as string | null;
  if (hostChapterId) {
    const { data: chapterRow } = await svc
      .schema("yi")
      .from("chapters")
      .select("name")
      .eq("id", hostChapterId)
      .maybeSingle();
    chapter = chapterRow ? { name: chapterRow.name ?? null } : null;
  }

  const title = data.title ?? "Untitled Whitepaper";
  const sections: Section[] = Array.isArray(data.sections)
    ? (data.sections as unknown as Section[]).filter(
        (s) => s && (s.heading || s.body)
      )
    : [];

  const pdfBuffer = await generateWhitepaperPdf({
    title,
    edition_name: edition?.name ?? "Future 6.0",
    track_name: track?.name ?? "—",
    track_icon: track?.icon ?? null,
    host_chapter_name: chapter?.name ?? "Host Chapter",
    executive_summary: data.executive_summary ?? null,
    sections,
    cover_image_url: data.cover_image_url ?? null,
    published_at: data.published_at ?? null,
  });

  const filename = `whitepaper-${slugify(title)}.pdf`;
  // Convert Node Buffer to a fresh Uint8Array so the Response body matches
  // BodyInit and doesn't leak Node-only internals across the Edge/Fetch boundary.
  const body = new Uint8Array(pdfBuffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "Content-Length": String(body.byteLength),
    },
  });
}
