import type { Metadata } from "next";
import { getVarnamAccess } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AddAssetForm } from "./_components/AddAssetForm";
import { AssetsBoard, type AssetItem } from "./_components/AssetsBoard";

export const metadata: Metadata = { title: "Assets" };

const FESTIVAL_KEY = "varnam-vizha";

export type EventOption = { id: string; title: string };

/**
 * Asset rows for the live edition + the edition's events (for the event
 * chips / select). varnam_assets has no generated types (migration
 * 20260714000004 lands with this round), so rows are cast to local shapes
 * and a missing table degrades to an empty library instead of a crash.
 */
async function getAssetLibrary(): Promise<{
  assets: AssetItem[];
  events: EventOption[];
}> {
  const sb = createAdminSupabaseClient();

  const { data: editionRaw } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("id")
    .eq("festival_key", FESTIVAL_KEY)
    .eq("status", "live")
    .maybeSingle();
  const editionId = (editionRaw as { id: string } | null)?.id;
  if (!editionId) return { assets: [], events: [] };

  const [assetsRes, eventsRes] = await Promise.all([
    sb
      .schema("yi_connect")
      .from("varnam_assets")
      .select("id, event_id, title, kind, url, status, notes, created_at")
      .eq("edition_id", editionId)
      .order("created_at", { ascending: false }),
    sb
      .schema("yi_connect")
      .from("events")
      .select("id, title")
      .eq("festival_edition_id", editionId)
      .order("start_date", { ascending: true }),
  ]);

  const events = ((eventsRes.data ?? []) as EventOption[]).map((e) => ({
    id: e.id,
    title: e.title,
  }));
  const eventTitles = new Map(events.map((e) => [e.id, e.title]));

  // assetsRes.error covers "table not deployed yet" — show an empty library.
  const rows = (assetsRes.error ? [] : assetsRes.data ?? []) as {
    id: string;
    event_id: string | null;
    title: string;
    kind: string | null;
    url: string | null;
    status: string | null;
    notes: string | null;
    created_at: string | null;
  }[];

  const assets: AssetItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind ?? "other",
    url: r.url,
    status: r.status ?? "draft",
    notes: r.notes,
    createdAt: r.created_at,
    eventId: r.event_id,
    eventTitle: r.event_id ? eventTitles.get(r.event_id) ?? null : null,
  }));

  return { assets, events };
}

export default async function AssetLibraryPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const { assets, events } = await getAssetLibrary();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Assets
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          Every poster, reel and script link in one place — with a clear
          approval status instead of WhatsApp scrollback.
        </p>
      </div>

      {access.canManage && <AddAssetForm events={events} />}

      <AssetsBoard assets={assets} canManage={access.canManage} />
    </div>
  );
}
