import { requireRxSuperAdmin } from "@/lib/recognitions/auth";
import { getCurrentCycle, getPeople, listAudit, listAwards } from "@/lib/recognitions/data";
import { NoAccess, PageHead, formatWhen } from "../../../_ui/primitives";

export const metadata = { title: "Audit trail" };

const ACTION_WORD: Record<string, string> = {
  create: "created",
  update: "updated",
  make_current: "made current",
  assign: "assigned",
  remove: "removed",
  edit_conflicts: "changed declared conflicts on",
  grant: "granted",
  revoke: "revoked",
  paste: "pasted",
  upload: "uploaded",
  apply_layer1: "applied Layer 1 scores from",
  set_layer1_manual: "typed a Layer 1 score for",
  force_open_stage2: "forced Stage 2 open on",
  edit: "edited",
  submit: "submitted",
  lock: "locked",
  decide: "decided on",
  unlock: "unlocked",
};

function words(s: string) {
  return s.replace(/_/g, " ");
}

function detailText(d: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(d ?? {})) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    const val = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${words(k)}: ${val.length > 160 ? `${val.slice(0, 160)}…` : val}`);
    if (parts.length >= 6) break;
  }
  return parts.join(" · ");
}

export default async function AuditPage() {
  const gate = await requireRxSuperAdmin();
  if (!gate.ok) return <NoAccess reason={gate.error} />;
  const cycle = await getCurrentCycle();
  if (!cycle) {
    return (
      <div className="rx-stack-lg">
        <PageHead eyebrow="Control room" title="Audit trail" />
        <div className="rx-plate"><p>Open a cycle first; the audit trail is kept per cycle.</p></div>
      </div>
    );
  }
  const [rows, awards] = await Promise.all([listAudit({ cycleId: cycle.id, limit: 200 }), listAwards(cycle.id, true)]);
  const people = await getPeople(rows.map((r) => r.actor_person_id ?? "").filter(Boolean));
  const awardTitle = new Map(awards.map((a) => [a.id, a.title]));

  return (
    <div className="rx-stack-lg">
      <PageHead eyebrow={`Control room · ${cycle.name}`} title="Audit trail">
        <p className="rx-mute">The latest 200 actions in this cycle, newest first. Nothing here can be edited or deleted.</p>
      </PageHead>
      {rows.length === 0 ? (
        <div className="rx-plate"><p>No actions recorded yet. Every change made in Recognitions will appear here.</p></div>
      ) : (
        <div className="rx-ledger-wrap">
          <table className="rx-ledger">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>What</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="rx-small rx-num" style={{ whiteSpace: "nowrap" }}>{formatWhen(r.at)}</td>
                  <td className="rx-small">{r.actor_person_id ? people.get(r.actor_person_id)?.full_name ?? "Unknown person" : "System"}</td>
                  <td className="rx-small">
                    {ACTION_WORD[r.action] ?? words(r.action)} {words(r.entity)}
                    {r.award_id ? <div className="rx-ad-mini">{awardTitle.get(r.award_id) ?? "an award"}</div> : null}
                  </td>
                  <td className="rx-small rx-ad-pre" style={{ minWidth: 240 }}>{detailText(r.detail)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
