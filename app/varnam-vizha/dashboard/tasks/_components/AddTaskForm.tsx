"use client";

import { useActionState, useEffect, useState } from "react";
import { addTask, type TaskActionState } from "@/lib/varnam/actions/manage-tasks";

const INITIAL: TaskActionState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-[#3B0A45]/15 bg-white px-3 py-2.5 text-sm text-[#2B0A33] outline-none transition focus:border-[#D6336C] focus:ring-2 focus:ring-[#D6336C]/20";
const labelCls = "mb-1 block text-sm font-medium text-[#2B0A33]";

export function AddTaskForm({
  events,
}: {
  events: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(addTask, INITIAL);

  // Controlled inputs — React 19 resets uncontrolled fields after server
  // actions, so we own the values and clear them only on success.
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [eventId, setEventId] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (state.ok) {
      setTitle("");
      setOwnerName("");
      setDueDate("");
      setEventId("");
      setDetails("");
    }
  }, [state]);

  return (
    <form
      action={action}
      className="rounded-2xl border border-[#3B0A45]/10 bg-white p-6 shadow-sm"
    >
      <h2 className="font-[family-name:var(--font-vv-display)] text-lg font-bold text-[#3B0A45]">
        Add a follow-up
      </h2>
      <p className="mt-0.5 mb-4 text-sm text-[#2B0A33]/60">
        Who&apos;s doing what, by when — write it here instead of scrolling
        WhatsApp for it later.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="task-title" className={labelCls}>
            What needs to happen? <span className="text-[#D6336C]">*</span>
          </label>
          <input
            id="task-title"
            name="title"
            required
            minLength={3}
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Follow up with Rotary on the stage sponsorship"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="task-owner" className={labelCls}>
            Who&apos;s on it?
          </label>
          <input
            id="task-owner"
            name="owner_name"
            maxLength={120}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="Name (they don't need an account)"
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="task-due" className={labelCls}>
            Due date
          </label>
          <input
            id="task-due"
            name="due_date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label htmlFor="task-event" className={labelCls}>
            Related event (optional)
          </label>
          <select
            id="task-event"
            name="event_id"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className={inputCls}
          >
            <option value="">— No specific event —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="task-details" className={labelCls}>
            Notes (optional)
          </label>
          <input
            id="task-details"
            name="details"
            maxLength={2000}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Phone number, context, amount…"
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
        className="mt-4 rounded-full bg-[#3B0A45] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#2B0A33] disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add to the board"}
      </button>
    </form>
  );
}
