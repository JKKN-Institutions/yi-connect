"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import {
  addSponsor,
  type BoardActionState,
} from "@/lib/varnam/actions/manage-sponsors";

const INITIAL: BoardActionState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";

const labelCls = "mb-1 block text-xs font-semibold text-[#2B0A33]/60";

/** Expanding "Add sponsor" panel — canManage-gated by the server page. */
export function AddSponsorPanel() {
  const [state, action, pending] = useActionState(addSponsor, INITIAL);

  return (
    <details className="group mb-6 overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2 font-[family-name:var(--font-vv-display)] text-base font-bold text-[#3B0A45]">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#3B0A45] text-white">
            <Plus className="size-4" />
          </span>
          Add sponsor
        </span>
        <span className="text-xs font-medium text-[#2B0A33]/45 group-open:hidden">
          Expand
        </span>
        <span className="hidden text-xs font-medium text-[#2B0A33]/45 group-open:inline">
          Collapse
        </span>
      </summary>

      <form action={action} className="border-t border-[#3B0A45]/8 px-5 pb-5 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="add-sp-name">
              Organisation name *
            </label>
            <input
              id="add-sp-name"
              name="organization_name"
              required
              minLength={2}
              maxLength={120}
              placeholder="e.g. Sakthi Masala"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="add-sp-industry">
              Industry
            </label>
            <input
              id="add-sp-industry"
              name="industry"
              placeholder="e.g. FMCG"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="add-sp-amount">
              This year&rsquo;s amount (₹)
            </label>
            <input
              id="add-sp-amount"
              name="current_year_amount"
              type="number"
              min={0}
              step="1"
              placeholder="e.g. 50000"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="add-sp-status">
              Relationship status
            </label>
            <select
              id="add-sp-status"
              name="relationship_status"
              defaultValue="prospect"
              className={inputCls}
            >
              <option value="prospect">Prospect</option>
              <option value="contacted">Contacted</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="add-sp-priority">
              Priority
            </label>
            <select
              id="add-sp-priority"
              name="priority"
              defaultValue="medium"
              className={inputCls}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="add-sp-contact">
              Contact person
            </label>
            <input
              id="add-sp-contact"
              name="contact_person_name"
              placeholder="Name"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="add-sp-phone">
              Contact phone
            </label>
            <input
              id="add-sp-phone"
              name="contact_phone"
              placeholder="Phone"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="add-sp-notes">
              Notes
            </label>
            <textarea
              id="add-sp-notes"
              name="notes"
              rows={2}
              placeholder="Anything the committee should know"
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

        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-full bg-[#3B0A45] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add sponsor"}
        </button>
      </form>
    </details>
  );
}
