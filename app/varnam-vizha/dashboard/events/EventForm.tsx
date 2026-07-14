"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  createEvent,
  updateEvent,
  type ManageEventState,
} from "@/lib/varnam/actions/manage-events";

const INITIAL: ManageEventState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";
const labelCls = "mb-1 block text-sm font-medium text-[#2B0A33]";
const checkboxCls = "size-4 rounded border-[#3B0A45]/20 accent-[#D6336C]";

// UI options — the allowed set is enforced server-side in manage-events.ts.
const CATEGORIES = [
  { value: "cultural", label: "Cultural" },
  { value: "sports", label: "Sports" },
  { value: "workshop", label: "Workshop" },
  { value: "other", label: "Other" },
] as const;

export type EventFormInitial = {
  id: string;
  title: string;
  description: string;
  category: string;
  startsAtLocal: string; // "YYYY-MM-DDTHH:mm" in IST
  endsAtLocal: string;
  venueAddress: string;
  maxCapacity: string;
  waitlistEnabled: boolean;
  isFeatured: boolean;
  isPaid: boolean;
  ticketUrl: string;
};

export function EventForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: EventFormInitial;
}) {
  const [state, action, pending] = useActionState(
    mode === "create" ? createEvent : updateEvent,
    INITIAL
  );
  const [isPaid, setIsPaid] = useState(initial?.isPaid ?? false);

  if (state.ok && mode === "create") {
    return (
      <div className="rounded-2xl border border-[#0CA4A5]/30 bg-[#0CA4A5]/5 p-8 text-center">
        <CheckCircle2 className="mx-auto size-9 text-[#0a8485]" />
        <p className="mt-3 font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#0a8485]">
          {state.message}
        </p>
        <Link
          href="/varnam-vizha/dashboard/events"
          className="mt-5 inline-flex rounded-full bg-[#3B0A45] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33]"
        >
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm"
    >
      {mode === "edit" && initial && (
        <input type="hidden" name="event_id" value={initial.id} />
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="title" className={labelCls}>
            Event title <span className="text-[#D6336C]">*</span>
          </label>
          <input
            id="title"
            name="title"
            required
            minLength={3}
            maxLength={120}
            defaultValue={initial?.title ?? ""}
            placeholder="e.g. Kolam Contest"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="category" className={labelCls}>
            Category <span className="text-[#D6336C]">*</span>
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={initial?.category ?? "cultural"}
            className={inputCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="starts_at" className={labelCls}>
              Starts <span className="text-[#D6336C]">*</span>
            </label>
            <input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={initial?.startsAtLocal ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="ends_at" className={labelCls}>
              Ends{" "}
              <span className="text-[#2B0A33]/40">
                (blank = 2 hours after start)
              </span>
            </label>
            <input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              defaultValue={initial?.endsAtLocal ?? ""}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label htmlFor="venue_address" className={labelCls}>
            Venue
          </label>
          <input
            id="venue_address"
            name="venue_address"
            defaultValue={initial?.venueAddress ?? ""}
            placeholder="e.g. VOC Park Grounds, Erode"
            className={inputCls}
          />
        </div>
      </div>

      <details className="mt-5 rounded-xl border border-[#3B0A45]/10 bg-[#FFF9F0] p-4 open:pb-5">
        <summary className="cursor-pointer text-sm font-semibold text-[#3B0A45]">
          More options
        </summary>
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="max_capacity" className={labelCls}>
                Capacity <span className="text-[#2B0A33]/40">(blank = unlimited)</span>
              </label>
              <input
                id="max_capacity"
                name="max_capacity"
                type="number"
                min={1}
                step={1}
                defaultValue={initial?.maxCapacity ?? ""}
                placeholder="e.g. 200"
                className={inputCls}
              />
            </div>
            <label className="flex items-center gap-2 pt-6 text-sm text-[#2B0A33]">
              <input
                type="checkbox"
                name="waitlist_enabled"
                defaultChecked={initial?.waitlistEnabled ?? false}
                className={checkboxCls}
              />
              Waitlist when full
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-[#2B0A33]">
            <input
              type="checkbox"
              name="is_featured"
              defaultChecked={initial?.isFeatured ?? false}
              className={checkboxCls}
            />
            Feature this event on the home page
          </label>

          <div>
            <label className="flex items-center gap-2 text-sm text-[#2B0A33]">
              <input
                type="checkbox"
                name="is_paid"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className={checkboxCls}
              />
              Ticketed (paid) event
            </label>
            {isPaid && (
              <div className="mt-3">
                <label htmlFor="ticket_url" className={labelCls}>
                  Ticket link <span className="text-[#2B0A33]/40">(https://…)</span>
                </label>
                <input
                  id="ticket_url"
                  name="ticket_url"
                  type="url"
                  defaultValue={initial?.ticketUrl ?? ""}
                  placeholder="https://in.bookmyshow.com/…"
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-[#2B0A33]/45">
                  Visitors are sent to this link instead of the free registration form.
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="description" className={labelCls}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={initial?.description ?? ""}
              placeholder="What is this event, who is it for, anything visitors should know…"
              className={inputCls}
            />
          </div>
        </div>
      </details>

      {state.message && !state.ok && (
        <p className="mt-4 text-sm font-medium text-[#D6336C]">{state.message}</p>
      )}
      {state.message && state.ok && mode === "edit" && (
        <p className="mt-4 text-sm font-medium text-[#0a8485]">{state.message}</p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-[#3B0A45] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
        >
          {pending
            ? "Saving…"
            : mode === "create"
              ? "Create event"
              : "Save changes"}
        </button>
        <Link
          href="/varnam-vizha/dashboard/events"
          className="text-sm font-medium text-[#0CA4A5] hover:underline"
        >
          Back to events
        </Link>
      </div>
    </form>
  );
}
