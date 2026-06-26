import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { Forbidden403 } from "@/app/yip/_components/Forbidden403";
import { getGovTaxonomy } from "@/lib/yip/national/taxonomy";
import { TaxonomyAdminClient } from "./taxonomy-admin-client";

// ═══════════════════════════════════════════════════════════════════════
// GoI ministry/scheme TAXONOMY — the tagging vocabulary the national
// intelligence layer maps every chapter's deliberation onto.
//
// PLATFORM master data → requireSuperAdmin() (NOT event-scoped). The admin
// layout already gates the whole tree; we re-gate here (defence-in-depth) and
// deny EXPLICITLY with <Forbidden403/> — never a silent redirect.
//
// includeInactive:true so the editor can manage soft-deleted rows. The
// deterministic committee→scheme join still reads yip.topics at query time;
// this table is the curated, human-validated parent vocabulary on top of it.
// ═══════════════════════════════════════════════════════════════════════

export default async function AdminTaxonomyPage() {
  const gate = await requireSuperAdmin();
  if (!gate.ok) {
    return (
      <Forbidden403 reason="The GoI taxonomy is restricted to national / super-admins." />
    );
  }

  const rows = await getGovTaxonomy({ includeInactive: true });
  return <TaxonomyAdminClient initialRows={rows} />;
}
