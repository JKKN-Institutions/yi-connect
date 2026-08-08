"use client";

/**
 * Volunteer roster for the run-sheet page — the table everyone reads on event
 * day (phone numbers are tap-to-call), plus an add-row form and per-row Remove
 * for organisers. Actions call the "use server" file (which re-checks
 * authorization); revalidatePath there refreshes the rows.
 *
 * Inputs are CONTROLLED — React 19 resets uncontrolled fields after server
 * actions, which wipes what the organiser was typing.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import {
  addRosterEntry,
  removeRosterEntry,
  type RosterActionState,
} from "@/lib/varnam/actions/manage-roster";

export type RosterRow = {
  id: string;
  person_name: string;
  phone: string | null;
  duty: string | null;
  station: string | null;
  notes: string | null;
};

const INITIAL: RosterActionState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

/** Digits (and +) only, for a usable tel: href; falls back to the raw text. */
function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned || phone}`;
}

function AddRosterForm({ eventId }: { eventId: string }) {
  const [state, action, pending] = useActionState(addRosterEntry, INITIAL);

  // Controlled fields; cleared only after a confirmed successful add.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [duty, setDuty] = useState("");
  const [station, setStation] = useState("");
  const lastOk = useRef(false);
  useEffect(() => {
    if (state.ok && !lastOk.current) {
      setName("");
      setPhone("");
      setDuty("");
      setStation("");
    }
    lastOk.current = state.ok;
  }, [state]);

  return (
    <form
      action={action}
      className="vv-no-print mt-4 rounded-2xl border border-[#3B0A45]/10 bg-white p-4 shadow-sm"
    >
      <p className="mb-3 text-sm font-semibold text-[#3B0A45]">
        Add a volunteer
      </p>
      <input type="hidden" name="event_id" value={eventId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          name="person_name"
          placeholder="Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
        <input
          name="phone"
          type="tel"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={inputCls}
        />
        <input
          name="duty"
          placeholder="Duty (e.g. First aid, Stage manager)"
          value={duty}
          onChange={(e) => setDuty(e.target.value)}
          className={inputCls}
        />
        <input
          name="station"
          placeholder="Station (e.g. Main gate, Ambulance 1)"
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className={inputCls}
        />
      </div>

      {state.message && (
        <p
          className={`mt-3 text-sm font-medium ${
            state.ok ? "text-[#0a8485]" : "text-[#D6336C]"
          }`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 w-full rounded-full bg-[#3B0A45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Adding…" : "Add to roster"}
      </button>
    </form>
  );
}

export function RosterSection({
  eventId,
  rows,
  canManage,
}: {
  eventId: string;
  rows: RosterRow[];
  canManage: boolean;
}) {
  const [notice, setNotice] = useState<RosterActionState | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const remove = (id: string) => {
    setNotice(null);
    setPendingId(id);
    startTransition(async () => {
      const result = await removeRosterEntry(id);
      setNotice(result.ok ? null : result);
      setPendingId(null);
    });
  };

  return (
    <div>
      {notice && !notice.ok && (
        <p className="vv-no-print mb-3 rounded-lg border border-[#D6336C]/25 bg-[#D6336C]/5 px-3 py-2 text-sm font-medium text-[#D6336C]">
          {notice.message}
        </p>
      )}

      <section className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[#2B0A33]/50">
            No volunteers on the roster yet
            {canManage ? " — add the first one below." : "."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Duty</th>
                  <th className="px-4 py-3 font-semibold">Station</th>
                  {canManage && (
                    <th className="vv-no-print px-4 py-3 text-right font-semibold">
                      &nbsp;
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const rowPending = pendingId === r.id;
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]"
                    >
                      <td className="px-4 py-3 font-medium text-[#2B0A33]">
                        {r.person_name}
                        {r.notes ? (
                          <span className="block text-xs font-normal text-[#2B0A33]/50">
                            {r.notes}
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.phone ? (
                          <a
                            href={telHref(r.phone)}
                            className="font-medium text-[#0CA4A5] hover:underline"
                          >
                            {r.phone}
                          </a>
                        ) : (
                          <span className="text-[#2B0A33]/35">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#2B0A33]/70">
                        {r.duty ?? <span className="text-[#2B0A33]/35">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[#2B0A33]/70">
                        {r.station ?? (
                          <span className="text-[#2B0A33]/35">—</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="vv-no-print whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={rowPending}
                            onClick={() => remove(r.id)}
                            className="rounded-full border border-[#3B0A45]/15 bg-white px-3 py-1 text-xs font-medium text-[#3B0A45] transition hover:border-[#D6336C]/40 hover:text-[#D6336C] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {rowPending ? "Removing…" : "Remove"}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManage && <AddRosterForm eventId={eventId} />}
    </div>
  );
}
