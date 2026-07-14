/**
 * One-tap reports data — read-only aggregation for the current edition.
 *
 * Why: the 2025 edition never produced a P&L (blind spot #4 in the committee's
 * own retro) and every Yi Health Card needs a submission per sub-event
 * (rec #10). This module turns live rows into (a) an edition money summary,
 * (b) per-event report rows, and (c) copy-ready plain-text drafts — zero new
 * schema, zero invented figures.
 *
 * Reads via the admin client (the reports pages are role-gated) and mirrors
 * lib/varnam/data/dashboard.ts in style. Queries against yi_connect.expenses
 * are wrapped defensively — the table lives outside the varnam vertical.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentEdition, type Edition } from "./editions";

// ── Formatting helpers (IST, en-IN) ─────────────────────────────────────────

const fmtDateIST = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

const inrPlain = (n: number): string =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

/** Public festival site (for the sponsor snippet). */
const PUBLIC_SITE_URL = `${
  process.env.NEXT_PUBLIC_APP_URL ?? "https://yi-connect-app.vercel.app"
}/varnam-vizha`;

// ── Edition finance ──────────────────────────────────────────────────────────

export type AllocationLine = {
  vertical: string;
  allocated: number;
  spent: number;
};

export type DealLine = {
  name: string;
  stage: string | null;
  committed: number;
  received: number;
};

export type EditionFinance = {
  edition: Edition | null;
  budget: { total: number; allocated: number; spent: number } | null;
  allocations: AllocationLine[];
  sponsorship: {
    committedTotal: number;
    receivedTotal: number;
    deals: DealLine[];
  };
  /**
   * committed + received − spent. Honest by construction: ticket revenue is
   * not in our database, so it is NOT in this number — see ticketNote.
   */
  netPosition: number;
  /** The caveat line to render right next to the net position. */
  ticketNote: string;
};

const EMPTY_FINANCE: EditionFinance = {
  edition: null,
  budget: null,
  allocations: [],
  sponsorship: { committedTotal: 0, receivedTotal: 0, deals: [] },
  netPosition: 0,
  ticketNote:
    "Sponsorship committed minus spend — ticket revenue tracked externally on the ticketing partner.",
};

/** Money summary for the live edition: budget, allocations, sponsorship, net. */
export async function getEditionFinance(): Promise<EditionFinance> {
  const sb = createAdminSupabaseClient();
  const edition = await getCurrentEdition();
  if (!edition) return EMPTY_FINANCE;

  const { data: edFull } = await sb
    .schema("yi_connect")
    .from("festival_editions")
    .select("id, chapter_id, budget_id")
    .eq("id", edition.id)
    .maybeSingle();
  const edRow = (edFull ?? null) as {
    chapter_id?: string | null;
    budget_id?: string | null;
  } | null;
  const chapterId = edRow?.chapter_id ?? null;
  const budgetId = edRow?.budget_id ?? null;

  // Budget + allocations (via edition.budget_id).
  let budget: EditionFinance["budget"] = null;
  let allocations: AllocationLine[] = [];
  if (budgetId) {
    const { data: bRaw } = await sb
      .schema("yi_connect")
      .from("budgets")
      .select("total_amount, allocated_amount, spent_amount")
      .eq("id", budgetId)
      .maybeSingle();
    if (bRaw) {
      const b = bRaw as {
        total_amount: number | null;
        allocated_amount: number | null;
        spent_amount: number | null;
      };
      budget = {
        total: Number(b.total_amount) || 0,
        allocated: Number(b.allocated_amount) || 0,
        spent: Number(b.spent_amount) || 0,
      };
    }
    const { data: allocsRaw } = await sb
      .schema("yi_connect")
      .from("budget_allocations")
      .select("vertical_name, allocated_amount, spent_amount")
      .eq("budget_id", budgetId);
    allocations = ((allocsRaw ?? []) as {
      vertical_name: string;
      allocated_amount: number | null;
      spent_amount: number | null;
    }[])
      .map((a) => ({
        vertical: a.vertical_name,
        allocated: Number(a.allocated_amount) || 0,
        spent: Number(a.spent_amount) || 0,
      }))
      .sort((x, y) => y.allocated - x.allocated);
  }

  // Sponsorship deals (fiscal year 2026, the edition's chapter).
  let deals: DealLine[] = [];
  if (chapterId) {
    const { data: dealsRaw } = await sb
      .schema("yi_connect")
      .from("sponsorship_deals")
      .select("deal_name, deal_stage, committed_amount, received_amount")
      .eq("chapter_id", chapterId)
      .eq("fiscal_year", 2026);
    deals = ((dealsRaw ?? []) as {
      deal_name: string;
      deal_stage: string | null;
      committed_amount: number | null;
      received_amount: number | null;
    }[]).map((d) => ({
      name: d.deal_name,
      stage: d.deal_stage,
      committed: Number(d.committed_amount) || 0,
      received: Number(d.received_amount) || 0,
    }));
  }
  const committedTotal = deals.reduce((s, d) => s + d.committed, 0);
  const receivedTotal = deals.reduce((s, d) => s + d.received, 0);

  const spent = budget?.spent ?? 0;
  return {
    edition,
    budget,
    allocations,
    sponsorship: { committedTotal, receivedTotal, deals },
    netPosition: committedTotal + receivedTotal - spent,
    ticketNote: EMPTY_FINANCE.ticketNote,
  };
}

// ── Per-event reports ────────────────────────────────────────────────────────

export type ExpenseLine = {
  id: string;
  title: string;
  amount: number;
  status: string | null;
  expenseDate: string | null;
  vendor: string | null;
};

export type EventReport = {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  venue_address: string | null;
  category: string | null;
  status: string | null;
  confirmed: number;
  waitlisted: number;
  checkedIn: number;
  /** Sum of non-rejected expense totals for this event. */
  expensesTotal: number;
  expenses: ExpenseLine[];
};

/** All events of the current edition with registration + expense numbers. */
export async function getEventReports(): Promise<EventReport[]> {
  const sb = createAdminSupabaseClient();
  const edition = await getCurrentEdition();
  if (!edition) return [];

  const { data: eventsRaw } = await sb
    .schema("yi_connect")
    .from("events")
    .select("id, title, description, start_date, venue_address, category, status")
    .eq("festival_edition_id", edition.id)
    .order("start_date", { ascending: true });
  const events = (eventsRaw ?? []) as {
    id: string;
    title: string;
    description: string | null;
    start_date: string | null;
    venue_address: string | null;
    category: string | null;
    status: string | null;
  }[];
  if (events.length === 0) return [];
  const eventIds = events.map((e) => e.id);

  // Registrations, grouped per event.
  const confirmed = new Map<string, number>();
  const waitlisted = new Map<string, number>();
  const checkedIn = new Map<string, number>();
  const { data: rsvpsRaw } = await sb
    .schema("yi_connect")
    .from("guest_rsvps")
    .select("event_id, status, checked_in_at")
    .in("event_id", eventIds);
  for (const r of (rsvpsRaw ?? []) as {
    event_id: string;
    status: string | null;
    checked_in_at: string | null;
  }[]) {
    if (r.status === "waitlist") {
      waitlisted.set(r.event_id, (waitlisted.get(r.event_id) ?? 0) + 1);
    } else {
      confirmed.set(r.event_id, (confirmed.get(r.event_id) ?? 0) + 1);
    }
    if (r.checked_in_at) {
      checkedIn.set(r.event_id, (checkedIn.get(r.event_id) ?? 0) + 1);
    }
  }

  // Expenses per event — defensive: the table lives outside this vertical and
  // may be empty / shaped differently; any failure degrades to "no expenses".
  const expensesByEvent = new Map<string, ExpenseLine[]>();
  try {
    const { data: expRaw } = await sb
      .schema("yi_connect")
      .from("expenses")
      .select(
        "id, event_id, title, amount, total_amount, status, expense_date, vendor_name"
      )
      .in("event_id", eventIds)
      .order("expense_date", { ascending: false });
    for (const e of (expRaw ?? []) as {
      id: string;
      event_id: string | null;
      title: string | null;
      amount: number | null;
      total_amount: number | null;
      status: string | null;
      expense_date: string | null;
      vendor_name: string | null;
    }[]) {
      if (!e.event_id) continue;
      const line: ExpenseLine = {
        id: e.id,
        title: e.title ?? "Expense",
        amount: Number(e.total_amount ?? e.amount) || 0,
        status: e.status,
        expenseDate: e.expense_date,
        vendor: e.vendor_name,
      };
      const list = expensesByEvent.get(e.event_id) ?? [];
      list.push(line);
      expensesByEvent.set(e.event_id, list);
    }
  } catch {
    // Leave every event with an empty expense list.
  }

  return events.map((e) => {
    const expenses = expensesByEvent.get(e.id) ?? [];
    return {
      id: e.id,
      title: e.title,
      description: e.description,
      start_date: e.start_date,
      venue_address: e.venue_address,
      category: e.category,
      status: e.status,
      confirmed: confirmed.get(e.id) ?? 0,
      waitlisted: waitlisted.get(e.id) ?? 0,
      checkedIn: checkedIn.get(e.id) ?? 0,
      expensesTotal: expenses
        .filter((x) => x.status !== "rejected")
        .reduce((s, x) => s + x.amount, 0),
      expenses,
    };
  });
}

// ── Copy-ready text drafts ───────────────────────────────────────────────────

/**
 * Yi Health Card draft for one sub-event — plain text an organiser can paste
 * straight into the Health Card form. Every number comes from the live DB;
 * the impact line is a fill-in (we never invent outcomes).
 */
export function buildHealthCardDraft(
  report: EventReport,
  edition: Edition | null
): string {
  const registered = report.confirmed + report.waitlisted;
  const editionName = edition?.name ?? "Varnam Vizha";
  return [
    `Event: ${report.title}`,
    `Vertical: Varnam Vizha (Yi Erode flagship)`,
    `Date: ${fmtDateIST(report.start_date)}`,
    `Venue: ${report.venue_address ?? "—"}`,
    `Participants: ${registered} registered, ${report.checkedIn} attended (checked-in)`,
    `Description: ${report.description ?? "—"}`,
    `Impact: [one line — what changed for the audience? fill in before submitting]`,
    `Part of ${editionName}, culminating on Erode Day (Sept 16).`,
  ].join("\n");
}

/**
 * Sponsor impact snippet — edition-wide reach numbers a sponsor cares about,
 * ready to paste into WhatsApp or an email.
 */
export function buildSponsorImpactSnippet(
  events: EventReport[],
  edition: Edition | null
): string {
  const editionName = edition?.name ?? "Varnam Vizha";
  const totalRegistered = events.reduce(
    (s, e) => s + e.confirmed + e.waitlisted,
    0
  );
  const totalCheckedIn = events.reduce((s, e) => s + e.checkedIn, 0);
  return [
    `${editionName} — Yi Erode's flagship festival of colour`,
    ``,
    `• ${events.length} events across the edition`,
    `• ${totalRegistered} total registrations`,
    `• ${totalCheckedIn} attendees checked in on the ground`,
    ``,
    `See the festival live: ${PUBLIC_SITE_URL}`,
  ].join("\n");
}

/** Currency formatter shared by the report pages (en-IN, no paise). */
export const formatINR = inrPlain;
