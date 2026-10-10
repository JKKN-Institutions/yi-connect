"use client";

import { useState } from "react";
import { grantTeamRole, revokeTeamRole } from "../../../actions/admin-people";
import { RX_ROLES } from "@/lib/recognitions/constants";
import { ConfirmDialog, ResultLine } from "../../../_ui/client";
import { useAction } from "../_lib/use-action";

type TeamRole =
  | typeof RX_ROLES.superAdmin
  | typeof RX_ROLES.nationalLeadership
  | typeof RX_ROLES.regionalChair
  | typeof RX_ROLES.chapterRep;

export function GrantRoleForm({
  roles,
  chapters,
  regions,
}: {
  roles: Array<{ value: string; label: string }>;
  chapters: Array<{ id: string; name: string }>;
  regions: string[];
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(RX_ROLES.nationalLeadership);
  const [chapterId, setChapterId] = useState("");
  const [zone, setZone] = useState("");
  const { pending, result, run } = useAction();
  const needsChapter = role === RX_ROLES.chapterRep;
  // A Regional Chair is scoped to one region; no region, no role (the server refuses too).
  const needsZone = role === RX_ROLES.regionalChair;

  return (
    <form
      className="rx-stack"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            grantTeamRole({
              email,
              role: role as TeamRole,
              chapterId: needsChapter ? chapterId : null,
              zone: needsZone ? zone : null,
            }),
          (r) => r.success && setEmail("")
        );
      }}
    >
      <div className="rx-ad-fields">
        <div>
          <label className="rx-label" htmlFor="tm-email">Email in the Yi directory</label>
          <input id="tm-email" type="email" className="rx-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" />
        </div>
        <div>
          <label className="rx-label" htmlFor="tm-role">Role</label>
          <select id="tm-role" className="rx-select" value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        {needsChapter ? (
          <div>
            <label className="rx-label" htmlFor="tm-chapter">Chapter</label>
            <select id="tm-chapter" className="rx-select" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
              <option value="">Choose a chapter</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        ) : null}
        {needsZone ? (
          <div>
            <label className="rx-label" htmlFor="tm-zone">Region</label>
            <select id="tm-zone" className="rx-select" value={zone} onChange={(e) => setZone(e.target.value)} required>
              <option value="">Choose a region</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        ) : null}
      </div>
      <p className="rx-help">If no one in the Yi directory has that email, nothing is created — they need a Yi account first.</p>
      <div>
        <button type="submit" className="rx-btn" disabled={pending || email.trim() === "" || (needsChapter && chapterId === "") || (needsZone && zone === "")}>
          {pending ? "Saving…" : "Give role"}
        </button>
      </div>
      <ResultLine result={result} />
    </form>
  );
}

export function RevokeRoleButton({ assignmentId, who, roleLabel }: { assignmentId: string; who: string; roleLabel: string }) {
  const [open, setOpen] = useState(false);
  const { pending, result, run } = useAction();
  return (
    <>
      <button type="button" className="rx-btn rx-btn-danger rx-btn-sm" onClick={() => setOpen(true)}>
        Revoke
      </button>
      <ResultLine result={result} />
      <ConfirmDialog
        open={open}
        title={`Revoke ${roleLabel} from ${who}?`}
        confirmLabel="Revoke role"
        tone="danger"
        busy={pending}
        onClose={() => setOpen(false)}
        onConfirm={() => run(() => revokeTeamRole(assignmentId), (r) => r.success && setOpen(false))}
      >
        <p>They lose this access at their next page load. The role row is kept in the Yi directory as inactive, so the history stays.</p>
      </ConfirmDialog>
    </>
  );
}
