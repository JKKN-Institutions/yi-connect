"use client";

import { useState, useTransition, useActionState } from "react";
import {
  updateSponsor,
  removeSponsor,
  type BoardActionState,
} from "@/lib/varnam/actions/manage-sponsors";
import type { SponsorBoardRow } from "@/lib/varnam/data/manage-boards-data";

const INITIAL: BoardActionState = { ok: false, message: "" };

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

const labelCls = "mb-1 block text-xs font-semibold text-[#2B0A33]/60";

function EditSponsorForm({
  sponsor,
  onClose,
}: {
  sponsor: SponsorBoardRow;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(updateSponsor, INITIAL);
  const [removeState, setRemoveState] = useState<BoardActionState | null>(null);
  const [removing, startRemove] = useTransition();

  return (
    <div className="bg-[#FFF9F0] px-4 py-4">
      <form action={action}>
        <input type="hidden" name="sponsor_id" value={sponsor.id} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className={labelCls} htmlFor={`st-${sponsor.id}`}>
              Relationship status
            </label>
            <select
              id={`st-${sponsor.id}`}
              name="relationship_status"
              defaultValue={sponsor.relationshipStatus ?? "prospect"}
              className={inputCls}
            >
              <option value="prospect">Prospect</option>
              <option value="contacted">Contacted</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor={`pr-${sponsor.id}`}>
              Priority
            </label>
            <select
              id={`pr-${sponsor.id}`}
              name="priority"
              defaultValue={sponsor.priority ?? "medium"}
              className={inputCls}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor={`am-${sponsor.id}`}>
              This year&rsquo;s amount (₹)
            </label>
            <input
              id={`am-${sponsor.id}`}
              name="current_year_amount"
              type="number"
              min={0}
              step="1"
              defaultValue={sponsor.currentYearAmount ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor={`cn-${sponsor.id}`}>
              Contact person
            </label>
            <input
              id={`cn-${sponsor.id}`}
              name="contact_person_name"
              defaultValue={sponsor.contactPersonName ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor={`cp-${sponsor.id}`}>
              Contact phone
            </label>
            <input
              id={`cp-${sponsor.id}`}
              name="contact_phone"
              defaultValue={sponsor.contactPhone ?? ""}
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls} htmlFor={`no-${sponsor.id}`}>
              Notes
            </label>
            <textarea
              id={`no-${sponsor.id}`}
              name="notes"
              rows={2}
              defaultValue={sponsor.notes ?? ""}
              className={inputCls}
            />
          </div>
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
        {removeState && !removeState.ok && (
          <p className="mt-3 text-sm font-medium text-[#D6336C]">
            {removeState.message}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[#3B0A45] px-6 py-2 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[#3B0A45]/15 bg-white px-5 py-2 text-sm font-medium text-[#2B0A33]/70 transition hover:border-[#3B0A45]/30"
          >
            Close
          </button>
          <button
            type="button"
            disabled={removing}
            onClick={() => {
              if (
                !window.confirm(
                  `Remove ${sponsor.organizationName} from the pipeline? Its history is kept.`
                )
              ) {
                return;
              }
              startRemove(async () => {
                const result = await removeSponsor(sponsor.id);
                setRemoveState(result);
              });
            }}
            className="ml-auto rounded-full border border-[#D6336C]/30 bg-white px-5 py-2 text-sm font-medium text-[#D6336C] transition hover:bg-[#D6336C]/5 disabled:opacity-60"
          >
            {removing ? "Removing…" : "Remove sponsor"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Sponsors table with an inline per-row editor when canManage. */
export function SponsorsTable({
  sponsors,
  canManage,
}: {
  sponsors: SponsorBoardRow[];
  canManage: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (sponsors.length === 0) {
    return <p className="p-6 text-sm text-[#2B0A33]/50">No active sponsors yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
            <th className="px-4 py-3 font-semibold">Sponsor</th>
            <th className="px-4 py-3 font-semibold">Industry</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Priority</th>
            <th className="px-4 py-3 text-right font-semibold">This year</th>
            <th className="px-4 py-3 text-right font-semibold">Committed</th>
            {canManage ? <th className="px-4 py-3" /> : null}
          </tr>
        </thead>
        <tbody>
          {sponsors.map((s) => (
            <SponsorRows
              key={s.id}
              sponsor={s}
              canManage={canManage}
              editing={editingId === s.id}
              onToggle={() =>
                setEditingId((cur) => (cur === s.id ? null : s.id))
              }
              onClose={() => setEditingId(null)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SponsorRows({
  sponsor: s,
  canManage,
  editing,
  onToggle,
  onClose,
}: {
  sponsor: SponsorBoardRow;
  canManage: boolean;
  editing: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const colCount = canManage ? 7 : 6;
  return (
    <>
      <tr className="border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0]">
        <td className="px-4 py-3 font-medium text-[#2B0A33]">
          {s.organizationName}
        </td>
        <td className="px-4 py-3 text-[#2B0A33]/70">
          {s.industry ?? <span className="text-[#2B0A33]/35">—</span>}
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex rounded-full bg-[#3B0A45]/8 px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#3B0A45]/70">
            {s.relationshipStatus ?? "prospect"}
          </span>
        </td>
        <td className="px-4 py-3">
          {s.priority ? (
            <span className="inline-flex rounded-full bg-[#F4A300]/15 px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#a06b00]">
              {s.priority}
            </span>
          ) : (
            <span className="text-[#2B0A33]/35">—</span>
          )}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-[#2B0A33]/70">
          {s.currentYearAmount ? inr(s.currentYearAmount) : "—"}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-[#0a8485]">
          {s.committed ? inr(s.committed) : "—"}
        </td>
        {canManage ? (
          <td className="px-4 py-3 text-right">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-full border border-[#3B0A45]/15 bg-white px-3.5 py-1 text-xs font-semibold text-[#3B0A45] transition hover:border-[#D6336C]/40 hover:text-[#b02a59]"
            >
              {editing ? "Close" : "Edit"}
            </button>
          </td>
        ) : null}
      </tr>
      {canManage && editing ? (
        <tr className="border-b border-[#3B0A45]/6 last:border-0">
          <td colSpan={colCount} className="p-0">
            <EditSponsorForm sponsor={s} onClose={onClose} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
