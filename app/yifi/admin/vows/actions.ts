"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/yifi/supabase/server";

export type UpdateVowTileResult = { ok: true } | { ok: false; error: string };

/**
 * Toggle the engraving / placement state of a single vow's physical tile.
 * Sends the NEW intended values for both flags (the caller computes them).
 */
export async function updateVowTile(
  vowId: string,
  tileEngraved: boolean,
  tilePlaced: boolean,
): Promise<UpdateVowTileResult> {
  const svc = await createServiceClient();

  const { error } = await svc.rpc("yifi_admin_update_vow", {
    p_vow_id: vowId,
    p_tile_engraved: tileEngraved,
    p_tile_placed: tilePlaced,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/yifi/admin/vows");
  return { ok: true };
}
