/**
 * GET /api/compendium/[editionSlug]/pdf
 *
 * Returns a bundled PDF compendium of every published whitepaper for the
 * given edition. National admins only (must be authenticated via Supabase Auth).
 *
 * Handbook refs: [HPB §6 Whitepaper, HPB §9 National Deliverables]
 */

import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/yi-future/supabase/server";
import {
  generateCompendiumPdf,
  type CompendiumWhitepaper,
} from "@/lib/yi-future/compendium";

export const runtime = "nodejs";

type WhitepaperRow = {
  title: string | null;
  executive_summary: string | null;
  sections: { heading: string; body: string }[] | null;
  tracks: { name: string; icon: string | null } | null;
  chapters: { name: string } | null;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ editionSlug: string }> }
) {
  const { editionSlug } = await params;

  // 1. Require Supabase Auth (national admin).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const svc = await createServiceClient();

  // 2. Resolve edition by slug.
  const { data: edition, error: editionErr } = await svc
    .schema("future")
    .from("editions")
    .select("id, name, slug")
    .eq("slug", editionSlug)
    .single();

  if (editionErr || !edition) {
    return NextResponse.json(
      { error: "Edition not found" },
      { status: 404 }
    );
  }

  // 3. Fetch published whitepapers with track + host chapter joins.
  const { data: whitepapersRaw, error: wpErr } = await svc
    .schema("future")
    .from("whitepapers")
    .select(
      "title, executive_summary, sections, published_at, tracks(name, icon), chapters:chapters!whitepapers_host_chapter_id_fkey(name)"
    )
    .eq("edition_id", edition.id)
    .eq("status", "published")
    .order("published_at", { ascending: true });

  if (wpErr) {
    return NextResponse.json(
      { error: "Failed to load whitepapers" },
      { status: 500 }
    );
  }

  const rows = (whitepapersRaw ?? []) as unknown as WhitepaperRow[];

  const whitepapers: CompendiumWhitepaper[] = rows.map((row) => ({
    title: row.title ?? "Untitled Whitepaper",
    track_name: row.tracks?.name ?? "—",
    track_icon: row.tracks?.icon ?? null,
    host_chapter_name: row.chapters?.name ?? "—",
    executive_summary: row.executive_summary,
    sections: Array.isArray(row.sections) ? row.sections : [],
  }));

  // 4. Render the PDF.
  const pdfBuffer = await generateCompendiumPdf({
    edition_name: edition.name,
    edition_slug: edition.slug,
    published_at: new Date(),
    whitepapers,
  });

  const body = new Uint8Array(pdfBuffer);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="future-${edition.slug}-compendium.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
