"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addChiefGuest,
  deleteChiefGuest,
  updateEventSocial,
} from "@/app/yip/actions/reporting-extras";
import type { ChiefGuest } from "@/app/yip/actions/reporting-extras";
import { UserStar, Share2, Plus, X, Loader2, Save } from "lucide-react";

export function EventReportingCard({
  eventId,
  canManage,
  initialChiefGuests,
  initialSocialLinks,
  initialReach,
}: {
  eventId: string;
  canManage: boolean;
  initialChiefGuests: ChiefGuest[];
  initialSocialLinks: string[];
  initialReach: number | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Chief-guest add form
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [organization, setOrganization] = useState("");

  // Social form
  const [linksText, setLinksText] = useState(initialSocialLinks.join("\n"));
  const [reach, setReach] = useState<string>(
    initialReach == null ? "" : String(initialReach)
  );

  async function handleAddGuest() {
    if (!name.trim()) {
      setErr("A guest name is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await addChiefGuest(eventId, { name, designation, organization });
    setBusy(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    setName("");
    setDesignation("");
    setOrganization("");
    router.refresh();
  }

  async function handleDeleteGuest(id: string) {
    setBusy(true);
    setErr(null);
    const res = await deleteChiefGuest(eventId, id);
    setBusy(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    router.refresh();
  }

  async function handleSaveSocial() {
    setBusy(true);
    setErr(null);
    const links = linksText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const reachNum = reach.trim() === "" ? null : Number(reach);
    const res = await updateEventSocial(eventId, {
      social_links: links,
      social_reach_count: reachNum,
    });
    setBusy(false);
    if (!res.success) {
      setErr(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Chief Guests */}
      <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#1a1a3e]/5 p-5">
          <UserStar className="size-5 text-[#FF9933]" />
          <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[#1a1a3e]">
            Chief Guests
          </h2>
        </div>
        <div className="space-y-3 p-5">
          {initialChiefGuests.length === 0 && (
            <p className="text-sm text-[#1a1a3e]/40">No chief guests added yet.</p>
          )}
          {initialChiefGuests.map((g) => (
            <div
              key={g.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[#1a1a3e]/5 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1a1a3e]">{g.name}</p>
                <p className="text-xs text-[#1a1a3e]/50">
                  {[g.designation, g.organization].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleDeleteGuest(g.id)}
                  className="shrink-0 rounded-md p-1 text-red-500 hover:bg-red-50"
                  aria-label="Remove guest"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}

          {canManage && (
            <div className="space-y-2 border-t border-[#1a1a3e]/5 pt-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name *"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Designation"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  placeholder="Organization"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleAddGuest}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#FF9933] px-3 py-2 text-sm font-medium text-white hover:bg-[#E68A2E] disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Add guest
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Social reach */}
      <div className="overflow-hidden rounded-xl border border-[#1a1a3e]/5 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-[#1a1a3e]/5 p-5">
          <Share2 className="size-5 text-[#138808]" />
          <h2 className="font-[family-name:var(--font-heading)] text-base font-semibold text-[#1a1a3e]">
            Social Coverage
          </h2>
        </div>
        <div className="space-y-3 p-5">
          {!canManage ? (
            <>
              <div>
                <p className="text-xs font-medium text-[#1a1a3e]/40">
                  Post links
                </p>
                {initialSocialLinks.length === 0 ? (
                  <p className="text-sm text-[#1a1a3e]/40">None added.</p>
                ) : (
                  <ul className="mt-1 space-y-1">
                    {initialSocialLinks.map((l) => (
                      <li key={l} className="truncate text-sm text-[#138808]">
                        <a href={l} target="_blank" rel="noopener noreferrer">
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-medium text-[#1a1a3e]/40">
                  Total reach
                </p>
                <p className="text-sm font-medium text-[#1a1a3e]">
                  {initialReach == null
                    ? "—"
                    : initialReach.toLocaleString("en-IN")}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/50">
                  Post links (one URL per line)
                </label>
                <textarea
                  value={linksText}
                  onChange={(e) => setLinksText(e.target.value)}
                  rows={4}
                  placeholder="https://instagram.com/p/...&#10;https://x.com/..."
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#1a1a3e]/50">
                  Total reach / impressions
                </label>
                <input
                  type="number"
                  min={0}
                  value={reach}
                  onChange={(e) => setReach(e.target.value)}
                  placeholder="e.g. 12500"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveSocial}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#138808] px-3 py-2 text-sm font-medium text-white hover:bg-[#0f6606] disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {err && (
        <p className="lg:col-span-2 text-sm text-red-600">{err}</p>
      )}
    </div>
  );
}
