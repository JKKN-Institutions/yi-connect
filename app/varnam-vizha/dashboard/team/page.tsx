import type { Metadata } from "next";
import { getVarnamAccess, VARNAM_ROLE } from "@/lib/varnam/auth/access";
import { Forbidden403 } from "@/app/varnam-vizha/_components/Forbidden403";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { AddMemberForm } from "./_components/AddMemberForm";
import { DeactivateButton } from "./_components/DeactivateButton";

export const metadata: Metadata = { title: "Team" };

// Display labels + badge tints per committee role.
const ROLE_META: Record<string, { label: string; cls: string }> = {
  [VARNAM_ROLE.superAdmin]: {
    label: "Festival admin",
    cls: "bg-[#3B0A45]/10 text-[#3B0A45]",
  },
  [VARNAM_ROLE.chair]: {
    label: "Chair",
    cls: "bg-[#D6336C]/10 text-[#b02a59]",
  },
  [VARNAM_ROLE.coChair]: {
    label: "Co-chair",
    cls: "bg-[#D6336C]/10 text-[#b02a59]",
  },
  [VARNAM_ROLE.organizer]: {
    label: "Organizer",
    cls: "bg-[#0CA4A5]/10 text-[#0a8485]",
  },
  [VARNAM_ROLE.forumLead]: {
    label: "Forum lead",
    cls: "bg-[#F4A300]/15 text-[#8a5d00]",
  },
  [VARNAM_ROLE.viewer]: {
    label: "Viewer",
    cls: "bg-[#3B0A45]/8 text-[#3B0A45]/70",
  },
};

const ROLE_SORT: string[] = [
  VARNAM_ROLE.superAdmin,
  VARNAM_ROLE.chair,
  VARNAM_ROLE.coChair,
  VARNAM_ROLE.organizer,
  VARNAM_ROLE.forumLead,
  VARNAM_ROLE.viewer,
];

type TeamMember = {
  assignmentId: string;
  name: string;
  email: string | null;
  role: string;
  title: string | null;
  isActive: boolean;
  loginLinked: boolean;
};

/**
 * Current committee: role_assignments (app='varnam') joined manually to
 * yi_directory.people — two reads + a JS join (yi_directory has no generated
 * types / FK expansion here).
 */
async function getCommittee(): Promise<TeamMember[]> {
  const sb = createAdminSupabaseClient();

  const { data: rolesRaw } = await sb
    .schema("yi_directory")
    .from("role_assignments")
    .select("id, person_id, role, title, is_active, created_at")
    .eq("app", "varnam")
    .order("created_at", { ascending: true });
  const roles = (rolesRaw ?? []) as {
    id: string;
    person_id: string;
    role: string;
    title: string | null;
    is_active: boolean | null;
    created_at: string | null;
  }[];
  if (roles.length === 0) return [];

  const personIds = Array.from(new Set(roles.map((r) => r.person_id)));
  const { data: peopleRaw } = await sb
    .schema("yi_directory")
    .from("people")
    .select("id, full_name, email, user_id")
    .in("id", personIds);
  const people = new Map(
    ((peopleRaw ?? []) as {
      id: string;
      full_name: string | null;
      email: string | null;
      user_id: string | null;
    }[]).map((p) => [p.id, p])
  );

  const members: TeamMember[] = roles.map((r) => {
    const p = people.get(r.person_id);
    return {
      assignmentId: r.id,
      name: p?.full_name ?? "Unknown member",
      email: p?.email ?? null,
      role: r.role,
      title: r.title,
      isActive: r.is_active ?? false,
      loginLinked: !!p?.user_id,
    };
  });

  // Active first, then by role seniority, then by name.
  members.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const ra = ROLE_SORT.indexOf(a.role);
    const rb = ROLE_SORT.indexOf(b.role);
    if (ra !== rb) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
    return a.name.localeCompare(b.name);
  });
  return members;
}

export default async function TeamManagementPage() {
  const access = await getVarnamAccess();
  if (!access.canView) return <Forbidden403 reason={access.reason} />;

  const isTeamAdmin =
    access.canAdmin ||
    access.role === VARNAM_ROLE.chair ||
    access.role === VARNAM_ROLE.coChair;
  if (!isTeamAdmin) {
    return (
      <Forbidden403 reason="Only the festival chair or co-chair can manage the committee. Ask them if someone needs to be added or removed." />
    );
  }

  const members = await getCommittee();
  const activeCount = members.filter((m) => m.isActive).length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="font-[family-name:var(--font-vv-display)] text-3xl font-bold text-[#3B0A45]">
          Team
        </h1>
        <p className="mt-1 text-sm text-[#2B0A33]/60">
          {activeCount} active committee member{activeCount === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Committee table */}
        <section className="overflow-hidden rounded-2xl border border-[#3B0A45]/10 bg-white shadow-sm">
          {members.length === 0 ? (
            <p className="p-6 text-sm text-[#2B0A33]/50">
              No committee members yet — add the first one with the form.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#3B0A45]/10 text-xs uppercase tracking-wide text-[#2B0A33]/50">
                    <th className="px-4 py-3 font-semibold">Member</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const meta = ROLE_META[m.role] ?? {
                      label: m.role.replace(/_/g, " "),
                      cls: "bg-[#3B0A45]/8 text-[#3B0A45]/70",
                    };
                    return (
                      <tr
                        key={m.assignmentId}
                        className={`border-b border-[#3B0A45]/6 last:border-0 hover:bg-[#FFF9F0] ${
                          m.isActive ? "" : "opacity-55"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="font-medium text-[#2B0A33]">
                            {m.name}
                          </span>
                          {m.email ? (
                            <span className="mt-0.5 block truncate text-xs text-[#2B0A33]/45">
                              {m.email}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                          {m.title ? (
                            <span className="mt-0.5 block text-xs text-[#2B0A33]/45">
                              {m.title}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          {m.isActive ? (
                            <span className="inline-flex rounded-full bg-[#0CA4A5]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#0a8485]">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-[#3B0A45]/8 px-2.5 py-0.5 text-[11px] font-medium text-[#3B0A45]/50">
                              Removed
                            </span>
                          )}
                          {m.isActive && !m.loginLinked ? (
                            <span className="mt-0.5 block text-[11px] text-[#F4A300]">
                              Awaiting account link
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {m.isActive ? (
                            <DeactivateButton
                              assignmentId={m.assignmentId}
                              memberName={m.name}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Add member */}
        <AddMemberForm />
      </div>
    </div>
  );
}
