"use client";

/**
 * Inline fill-in control for Section 2 (Chief Guests & Jury). Rendered ONLY when
 * canManage is true. Lets the organiser add chief guests, edit them, mark which
 * is the valedictory-session guest, and remove one. Hidden from the printout
 * (`print:hidden`) — the saved guests render as normal report text above.
 *
 * Mirrors the OverviewOathFill capture pattern: a small "use client" child that
 * calls its section's server actions and refreshes the route on success.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Award, X } from "lucide-react";
import {
  addReportChiefGuest,
  updateReportChiefGuest,
  setReportGuestValedictory,
  removeReportChiefGuest,
} from "@/app/yip/actions/report-guests-jury";

type EditableGuest = {
  id: string;
  name: string;
  designation: string | null;
  organization: string | null;
  isValedictory: boolean;
};

export function GuestsJuryFill({
  eventId,
  guests,
}: {
  eventId: string;
  guests: EditableGuest[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Add-form state
  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [organization, setOrganization] = useState("");
  const [isValedictory, setIsValedictory] = useState(false);

  function resetAddForm() {
    setName("");
    setDesignation("");
    setOrganization("");
    setIsValedictory(false);
  }

  function submitAdd() {
    setError(null);
    startTransition(async () => {
      const res = await addReportChiefGuest(eventId, {
        name,
        designation,
        organization,
        isValedictory,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      resetAddForm();
      setAdding(false);
      router.refresh();
    });
  }

  function toggleValedictory(guest: EditableGuest) {
    setError(null);
    startTransition(async () => {
      const res = await setReportGuestValedictory(
        eventId,
        guest.id,
        !guest.isValedictory
      );
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function removeGuest(guest: EditableGuest) {
    setError(null);
    startTransition(async () => {
      const res = await removeReportChiefGuest(eventId, guest.id);
      if (!res.success) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="print:hidden mt-3 space-y-2">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Edit existing guests (mark valedictory / edit / remove) */}
      {guests.length > 0 && (
        <ul className="space-y-1.5">
          {guests.map((g) =>
            editingId === g.id ? (
              <li key={g.id}>
                <GuestEditRow
                  eventId={eventId}
                  guest={g}
                  pending={pending}
                  onDone={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onCancel={() => setEditingId(null)}
                  onError={setError}
                  startTransition={startTransition}
                />
              </li>
            ) : (
              <li
                key={g.id}
                className="flex items-center justify-between gap-2 rounded-md border border-[#1a1a3e]/10 bg-white px-2.5 py-1.5"
              >
                <span className="min-w-0 truncate text-xs text-[#1a1a3e]">
                  <span className="font-medium">{g.name}</span>
                  {(g.designation || g.organization) && (
                    <span className="text-[#1a1a3e]/55">
                      {" — "}
                      {[g.designation, g.organization]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                  {g.isValedictory && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded bg-[#D4A843]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#8a6d1f]">
                      <Award className="size-2.5" /> Valedictory
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleValedictory(g)}
                    disabled={pending}
                    title={
                      g.isValedictory
                        ? "Unmark valedictory guest"
                        : "Mark as valedictory guest"
                    }
                    className={`rounded p-1 transition-colors disabled:opacity-50 ${
                      g.isValedictory
                        ? "text-[#D4A843] hover:bg-[#D4A843]/10"
                        : "text-[#1a1a3e]/40 hover:bg-[#1a1a3e]/5 hover:text-[#1a1a3e]/70"
                    }`}
                  >
                    <Award className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(g.id)}
                    disabled={pending}
                    title="Edit guest"
                    className="rounded p-1 text-[#1a1a3e]/40 transition-colors hover:bg-[#1a1a3e]/5 hover:text-[#1a1a3e]/70 disabled:opacity-50"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGuest(g)}
                    disabled={pending}
                    title="Remove guest"
                    className="rounded p-1 text-[#1a1a3e]/40 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </li>
            )
          )}
        </ul>
      )}

      {/* Add a new guest */}
      {adding ? (
        <div className="space-y-2 rounded-lg border border-[#FF9933]/30 bg-[#FF9933]/5 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guest name *"
            className="w-full rounded-md border border-[#1a1a3e]/15 bg-white px-2.5 py-1.5 text-xs text-[#1a1a3e] focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Designation"
              className="w-full rounded-md border border-[#1a1a3e]/15 bg-white px-2.5 py-1.5 text-xs text-[#1a1a3e] focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
            />
            <input
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="Organization"
              className="w-full rounded-md border border-[#1a1a3e]/15 bg-white px-2.5 py-1.5 text-xs text-[#1a1a3e] focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-[#1a1a3e]/80">
            <input
              type="checkbox"
              checked={isValedictory}
              onChange={(e) => setIsValedictory(e.target.checked)}
              className="size-3.5 rounded border-[#1a1a3e]/30 text-[#D4A843] focus:ring-[#D4A843]/40"
            />
            Guest at the valedictory session
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitAdd}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-md bg-[#1a1a3e] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a1a3e]/90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Add guest"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                resetAddForm();
                setError(null);
              }}
              disabled={pending}
              className="inline-flex items-center justify-center rounded-md border border-[#1a1a3e]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#1a1a3e] transition-colors hover:bg-[#1a1a3e]/5 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#FF9933]/40 bg-[#FF9933]/5 px-2.5 py-1 text-xs font-medium text-[#FF9933] transition-colors hover:bg-[#FF9933]/10"
        >
          <Plus className="size-3" />
          Add a chief guest
        </button>
      )}
    </div>
  );
}

/** Inline edit row for a single guest (name / designation / organization). */
function GuestEditRow({
  eventId,
  guest,
  pending,
  onDone,
  onCancel,
  onError,
  startTransition,
}: {
  eventId: string;
  guest: EditableGuest;
  pending: boolean;
  onDone: () => void;
  onCancel: () => void;
  onError: (msg: string | null) => void;
  startTransition: (cb: () => void) => void;
}) {
  const [name, setName] = useState(guest.name);
  const [designation, setDesignation] = useState(guest.designation ?? "");
  const [organization, setOrganization] = useState(guest.organization ?? "");

  function save() {
    onError(null);
    startTransition(async () => {
      const res = await updateReportChiefGuest(eventId, guest.id, {
        name,
        designation,
        organization,
      });
      if (!res.success) {
        onError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div className="space-y-2 rounded-lg border border-[#1a1a3e]/15 bg-white p-2.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Guest name *"
        className="w-full rounded-md border border-[#1a1a3e]/15 bg-white px-2.5 py-1.5 text-xs text-[#1a1a3e] focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          placeholder="Designation"
          className="w-full rounded-md border border-[#1a1a3e]/15 bg-white px-2.5 py-1.5 text-xs text-[#1a1a3e] focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
        />
        <input
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          placeholder="Organization"
          className="w-full rounded-md border border-[#1a1a3e]/15 bg-white px-2.5 py-1.5 text-xs text-[#1a1a3e] focus:border-[#FF9933] focus:outline-none focus:ring-2 focus:ring-[#FF9933]/30"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-md bg-[#1a1a3e] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#1a1a3e]/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-[#1a1a3e]/15 bg-white px-3 py-1.5 text-xs font-medium text-[#1a1a3e] transition-colors hover:bg-[#1a1a3e]/5 disabled:opacity-50"
        >
          <X className="size-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}
