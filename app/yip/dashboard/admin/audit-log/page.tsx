import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/yip/auth/require-super-admin";
import { createServiceClient } from "@/lib/yip/supabase/server";
import { AuditLogClient, type AuditLogRow, type EventOption } from "./audit-log-client";

type SearchParams = {
  action_type?: string;
  target_event_id?: string;
  target_table?: string;
  page?: string;
};

const PAGE_SIZE = 100;

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) redirect("/yip/dashboard");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const svc = await createServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (svc.from("admin_audit_log" as any) as any)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (params.action_type) q = q.eq("action_type", params.action_type);
  if (params.target_event_id) q = q.eq("target_event_id", params.target_event_id);
  if (params.target_table) q = q.eq("target_table", params.target_table);

  const { data: rows, count } = await q;

  // Fetch event names for any target_event_ids present
  const eventIds = Array.from(
    new Set(
      ((rows ?? []) as AuditLogRow[])
        .map((r) => r.target_event_id)
        .filter((x): x is string => !!x)
    )
  );

  let eventNameById: Record<string, string> = {};
  if (eventIds.length > 0) {
    const { data: events } = await svc
      .from("events")
      .select("id, name, chapter_name")
      .in("id", eventIds);
    eventNameById = Object.fromEntries(
      (events ?? []).map((e) => [
        e.id,
        e.chapter_name ? `${e.name} — ${e.chapter_name}` : e.name,
      ])
    );
  }

  // For the event filter dropdown — show recent events
  const { data: allEvents } = await svc
    .from("events")
    .select("id, name, chapter_name, day1_date")
    .order("day1_date", { ascending: false })
    .limit(50);

  const eventOptions: EventOption[] = (allEvents ?? []).map((e) => ({
    id: e.id,
    label: e.chapter_name ? `${e.name} — ${e.chapter_name}` : e.name,
  }));

  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6">
      <AuditLogClient
        rows={(rows ?? []) as AuditLogRow[]}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        eventNameById={eventNameById}
        eventOptions={eventOptions}
        filters={{
          action_type: params.action_type ?? "",
          target_event_id: params.target_event_id ?? "",
          target_table: params.target_table ?? "",
        }}
      />
    </div>
  );
}
